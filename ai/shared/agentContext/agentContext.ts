import type { ChatMessage } from "@/ai/shared/llm/types";
import type {
  AgentContext,
  AgentContextDependencies,
  AgentContextSpec,
  AppendReceipt,
  ContextEvent,
  ContextProjection,
  NewContextEvent,
  ProjectionRequest,
  ProviderObservation,
} from "./types";
import { inferToolSemantics } from "./toolSemantics";

const COMPLETION_RESERVES = { control: 8_192, code: 16_384 } as const;
const SAFETY_RESERVE = 1_024;
const MIN_COMPLETION_TOKENS = 1_024;
const VISION_TOKEN_ESTIMATE = { low: 1_024, auto: 2_048, high: 4_096 } as const;

function estimateTextTokens(value: string): number {
  let ascii = 0;
  let nonAscii = 0;
  for (const character of value) {
    if (character.codePointAt(0)! <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 3 + nonAscii);
}

function estimateMessageTokens(message: ChatMessage): number {
  const { content, ...metadata } = message;
  let estimate = estimateTextTokens(JSON.stringify(metadata));
  if (typeof content === "string") return estimate + estimateTextTokens(content);
  if (!Array.isArray(content)) return estimate;
  for (const part of content) {
    estimate += part.type === "text"
      ? estimateTextTokens(part.text)
      : VISION_TOKEN_ESTIMATE[part.image_url.detail ?? "auto"];
  }
  return estimate;
}

function parsedValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function containsDiagnostics(value: unknown): boolean {
  const parsed = parsedValue(value);
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.diagnostics) && record.diagnostics.length > 0) return true;
  return record.output !== undefined && containsDiagnostics(record.output);
}

function succeededWithoutDiagnostics(event: Extract<ContextEvent, { kind: "tool_result" }>): boolean {
  const parsed = parsedValue(event.result);
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      (parsed as Record<string, unknown>).success === true &&
      !containsDiagnostics(parsed),
  );
}

function semanticsFor(event: Extract<ContextEvent, { kind: "tool_result" }>) {
  return event.semantics ?? inferToolSemantics(event.toolName, event.arguments, event.result);
}

interface EventProjection {
  events: readonly ContextEvent[];
  summaries: readonly { sequence: number; message: ChatMessage }[];
  includedEventIds: readonly string[];
  summarizedEventIds: readonly string[];
  omittedEventIds: readonly string[];
  removedPayloadBytes: number;
  usedMutationReceipts: boolean;
  usedSupersededObservations: boolean;
  usedTypedCheckpoint: boolean;
  usedCondensation: boolean;
}

function nestedResultRecord(
  event: Extract<ContextEvent, { kind: "tool_result" }>,
): { root: Record<string, unknown>; output: Record<string, unknown>; meta: Record<string, unknown> } {
  const parsed = parsedValue(event.result);
  const root = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const outputValue = parsedValue(root.output);
  const output = outputValue && typeof outputValue === "object"
    ? outputValue as Record<string, unknown>
    : {};
  const meta = root.meta && typeof root.meta === "object"
    ? root.meta as Record<string, unknown>
    : {};
  return { root, output, meta };
}

function mutationIdentity(
  event: Extract<ContextEvent, { kind: "tool_result" }>,
  parsedArgs: Record<string, unknown>,
): { path?: string; revision?: string } {
  const args = event.arguments && typeof event.arguments === "object"
    ? event.arguments as Record<string, unknown>
    : {};
  const { output, meta } = nestedResultRecord(event);
  const path = [args.path, parsedArgs.path, meta.path, output.path]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  const revision = [meta.revision, output.revision]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  return { ...(path ? { path } : {}), ...(revision ? { revision } : {}) };
}

function compactCompletedMutations(events: readonly ContextEvent[]): EventProjection {
  const resultsByCallId = new Map(
    events
      .filter((event): event is Extract<ContextEvent, { kind: "tool_result" }> => event.kind === "tool_result")
      .map((event) => [event.callId, event]),
  );
  const omitted = new Set<string>();
  const summarized = new Set<string>();
  const summaries: Array<{ sequence: number; message: ChatMessage }> = [];
  let removedPayloadBytes = 0;
  const condensationEvents = events.filter(
    (event): event is Extract<ContextEvent, { kind: "condensation" }> => event.kind === "condensation",
  );
  const forgottenByCondensation = new Set(condensationEvents.flatMap((event) => event.condensation.forgottenEventIds));
  for (const event of events) {
    if (!forgottenByCondensation.has(event.id) || event.kind === "condensation") continue;
    omitted.add(event.id);
    removedPayloadBytes += JSON.stringify(event).length;
  }

  const taskStates = events.filter((event) => event.kind === "task_state");
  for (const state of taskStates.slice(0, -1)) {
    if (omitted.has(state.id)) continue;
    omitted.add(state.id);
    removedPayloadBytes += JSON.stringify(state).length;
  }

  // Condensation can only remove whole provider protocol units.
  for (const event of events) {
    if (event.kind !== "assistant_tool_calls") continue;
    const results = event.calls.map((call) => resultsByCallId.get(call.id));
    if (!omitted.has(event.id) && !results.some((result) => result && omitted.has(result.id))) continue;
    omitted.add(event.id);
    for (const result of results) if (result) omitted.add(result.id);
  }

  // A provider protocol unit is all-or-nothing. A crash may leave a canonical
  // call with only some results; keep it auditable but never replay it.
  for (const event of events) {
    if (event.kind !== "assistant_tool_calls") continue;
    const results = event.calls.map((call) => resultsByCallId.get(call.id));
    if (results.every((result) => result !== undefined)) continue;
    omitted.add(event.id);
    removedPayloadBytes += JSON.stringify(event).length;
    for (const result of results) {
      if (!result) continue;
      omitted.add(result.id);
      removedPayloadBytes += JSON.stringify(result).length;
    }
  }

  for (const event of events) {
    if (event.kind !== "assistant_tool_calls" || event.calls.length === 0 || omitted.has(event.id)) continue;
    const results = event.calls.map((call) => resultsByCallId.get(call.id));
    const canReplace =
      results.every((result) => result !== undefined) &&
      results.every((result) => result !== undefined && semanticsFor(result).effect === "mutate") &&
      results.every((result) => result !== undefined && semanticsFor(result).outcome === "success" &&
        semanticsFor(result).diagnostics?.state !== "unresolved" && succeededWithoutDiagnostics(result));
    if (!canReplace) continue;

    const operations = event.calls.map((call, index) => {
      const result = results[index]!;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.argumentsJson) as Record<string, unknown>;
      } catch {
        // The canonical payload remains available; the receipt can omit malformed details.
      }
      const identity = mutationIdentity(result, parsedArgs);
      return `${call.name}${identity.path ? ` ${identity.path}` : ""}: succeeded${
        identity.revision ? ` @ ${identity.revision}` : ""
      }`;
    });
    summaries.push({
      sequence: event.sequence,
      message: {
        role: "system",
        content: `[Completed tool operations] ${operations.join("; ")}. Source arguments omitted; re-read the workspace if needed.`,
      },
    });
    omitted.add(event.id);
    summarized.add(event.id);
    removedPayloadBytes += JSON.stringify(event).length;
    for (const result of results) {
      omitted.add(result!.id);
      summarized.add(result!.id);
      removedPayloadBytes += JSON.stringify(result).length;
    }
  }

  // Failed mutations remain visible, but carrying a rejected full source body
  // forward is not recovery context. Keep the target/error/next action and
  // leave the attempted payload in canonical event history.
  for (const event of events) {
    if (event.kind !== "assistant_tool_calls" || omitted.has(event.id) || event.calls.length === 0) continue;
    const results = event.calls.map((call) => resultsByCallId.get(call.id));
    const mutationBatch = results.every((result) => result && semanticsFor(result).effect === "mutate");
    const hasFailure = results.some((result) => result && semanticsFor(result).outcome === "failure");
    const oversized = event.calls.some((call) => call.argumentsJson.length > 8_000);
    if (!mutationBatch || !hasFailure || !oversized || results.some((result) => !result)) continue;
    const operations = event.calls.map((call, index) => {
      const result = results[index]!;
      const identity = mutationIdentity(result, {});
      const parsedResult = parsedValue(result.result);
      const error = parsedResult && typeof parsedResult === "object"
        ? String((parsedResult as Record<string, unknown>).error ?? "mutation rejected")
        : "mutation rejected";
      return `${call.name}${identity.path ? ` ${identity.path}` : ""}: ${error.slice(0, 500)}`;
    });
    summaries.push({
      sequence: event.sequence,
      message: {
        role: "system",
        content: `[Failed tool operation] ${operations.join("; ")}. Attempted source payload omitted; read the canonical workspace before retrying.`,
      },
    });
    omitted.add(event.id);
    summarized.add(event.id);
    removedPayloadBytes += JSON.stringify(event).length;
    for (const result of results) {
      omitted.add(result!.id);
      summarized.add(result!.id);
      removedPayloadBytes += JSON.stringify(result).length;
    }
  }

  const readResultsByResource = new Map<string, Array<Extract<ContextEvent, { kind: "tool_result" }>>>();
  for (const event of events) {
    if (
      event.kind !== "tool_result" ||
      omitted.has(event.id) ||
      semanticsFor(event).effect !== "observe" || !semanticsFor(event).reproducible ||
      semanticsFor(event).outcome !== "success" || !succeededWithoutDiagnostics(event)
    ) {
      continue;
    }
    const resourceKey = semanticsFor(event).resource?.key;
    if (!resourceKey) continue;
    const resourceReads = readResultsByResource.get(resourceKey) ?? [];
    resourceReads.push(event);
    readResultsByResource.set(resourceKey, resourceReads);
  }
  const supersededResultIds = new Set<string>();
  for (const reads of readResultsByResource.values()) {
    for (const read of reads.slice(0, -1)) supersededResultIds.add(read.id);
  }
  let usedSupersededObservations = false;
  for (const event of events) {
    if (event.kind !== "assistant_tool_calls" || omitted.has(event.id)) continue;
    const results = event.calls.map((call) => resultsByCallId.get(call.id));
    if (
      results.length > 0 &&
      results.every((result) => result !== undefined && supersededResultIds.has(result.id))
    ) {
      omitted.add(event.id);
      removedPayloadBytes += JSON.stringify(event).length;
      for (const result of results) {
        omitted.add(result!.id);
        removedPayloadBytes += JSON.stringify(result).length;
      }
      usedSupersededObservations = true;
    }
  }

  return {
    events: events.filter((event) => !omitted.has(event.id)),
    summaries,
    includedEventIds: events.filter((event) => !omitted.has(event.id)).map((event) => event.id),
    summarizedEventIds: [...summarized],
    omittedEventIds: [...omitted],
    removedPayloadBytes,
    usedMutationReceipts: summarized.size > 0,
    usedSupersededObservations,
    usedTypedCheckpoint: taskStates.length > 1,
    usedCondensation: forgottenByCondensation.size > 0,
  };
}

function eventMessages(
  projection: EventProjection,
  provider: ProjectionRequest["model"]["provider"],
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const callsById = new Map<string, string>();
  const summaries = [...projection.summaries].sort((a, b) => a.sequence - b.sequence);
  let summaryIndex = 0;
  for (const event of projection.events) {
    while (summaries[summaryIndex] && summaries[summaryIndex]!.sequence < event.sequence) {
      messages.push(summaries[summaryIndex]!.message);
      summaryIndex += 1;
    }
    if (event.kind === "instruction") {
      messages.push({ role: event.scope === "task" || event.scope === "recovery" ? "user" : "system", content: event.content });
      continue;
    }
    if (event.kind === "user_message") {
      messages.push({ role: "user", content: event.content });
      continue;
    }
    if (event.kind === "assistant_message") {
      messages.push({ role: "assistant", content: event.content });
      continue;
    }
    if (event.kind === "assistant_tool_calls") {
      for (const call of event.calls) {
        if (callsById.has(call.id)) throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool call id ${call.id}`);
        callsById.set(call.id, call.name);
      }
      messages.push({
        role: "assistant",
        content: event.content,
        tool_calls: event.calls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.argumentsJson },
        })),
      });
      continue;
    }
    if (event.kind === "tool_result") {
      const expectedName = callsById.get(event.callId);
      if (!expectedName) throw new Error(`INVALID_PROTOCOL_HISTORY: orphan tool result ${event.callId}`);
      if (expectedName !== event.toolName) {
        throw new Error(`INVALID_PROTOCOL_HISTORY: tool result ${event.callId} names ${event.toolName}, expected ${expectedName}`);
      }
      messages.push({
        role: "tool",
        tool_call_id: event.callId,
        content: typeof event.result === "string" ? event.result : JSON.stringify(event.result),
      });
      continue;
    }
    if (event.kind === "task_state") {
      messages.push({ role: "system", content: `[Durable task state]\n${JSON.stringify(event.state)}` });
      continue;
    }
    if (event.kind === "condensation") {
      messages.push({ role: "system", content: `[Conversation checkpoint]\n${event.condensation.summary}` });
    }
  }
  while (summaries[summaryIndex]) {
    messages.push(summaries[summaryIndex]!.message);
    summaryIndex += 1;
  }
  for (const callId of callsById.keys()) {
    if (!projection.events.some((event) => event.kind === "tool_result" && event.callId === callId)) {
      throw new Error(`INVALID_PROTOCOL_HISTORY: missing tool result ${callId}`);
    }
  }
  if (provider !== "gemini-compatible") return messages;
  return messages.map((message) => {
    if (message.role !== "system" || typeof message.content !== "string") return message;
    const derived = message.content.startsWith("[Completed tool operations]") ||
      message.content.startsWith("[Durable task state]") ||
      message.content.startsWith("[Conversation checkpoint]");
    return derived ? { ...message, role: "user" as const } : message;
  });
}

function truncateReproducibleToolOutput(
  messages: ChatMessage[],
  events: readonly ContextEvent[],
  pressure: ProjectionRequest["pressure"],
): {
  messages: ChatMessage[];
  removedBytes: number;
  changed: boolean;
} {
  const toolCount = messages.filter((message) => message.role === "tool").length;
  let toolIndex = 0;
  let removedBytes = 0;
  let changed = false;
  const semanticsByCallId = new Map(events.filter(
    (event): event is Extract<ContextEvent, { kind: "tool_result" }> => event.kind === "tool_result",
  ).map((event) => [event.callId, semanticsFor(event)]));
  const next = messages.map((message) => {
    if (message.role !== "tool" || typeof message.content !== "string") return message;
    const isOld = toolIndex < toolCount - 6;
    toolIndex += 1;
    const maxChars = pressure === "overflow_recovery" ? 24_000 : isOld ? 500 : Infinity;
    const semantics = typeof message.tool_call_id === "string" ? semanticsByCallId.get(message.tool_call_id) : undefined;
    if (!semantics?.reproducible || semantics.outcome !== "success" ||
      semantics.diagnostics?.state === "unresolved" || message.content.length <= maxChars) return message;
    changed = true;
    removedBytes += message.content.length - maxChars;
    return {
      ...message,
      content: `${message.content.slice(0, maxChars)}\n[Tool result compacted for model projection]`,
    };
  });
  return { messages: next, removedBytes, changed };
}

export function createAgentContext(
  spec: AgentContextSpec,
  dependencies: AgentContextDependencies,
): AgentContext {
  let calibrationRatio = 1;
  const estimatesByProjection = new Map<string, number>();

  return {
    async append(events: readonly NewContextEvent[]): Promise<AppendReceipt> {
      if (events.length === 0) throw new Error("AgentContext.append requires at least one event");
      const existing = await dependencies.eventStore.read(spec.sessionId);
      const calls = new Map<string, { name: string; eventId?: string }>();
      const results = new Set<string>();
      for (const event of existing) {
        if (event.kind === "assistant_tool_calls") {
          for (const call of event.calls) {
            if (calls.has(call.id)) throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool call id ${call.id}`);
            calls.set(call.id, { name: call.name, eventId: event.id });
          }
        } else if (event.kind === "tool_result") {
          if (!calls.has(event.callId)) throw new Error(`INVALID_PROTOCOL_HISTORY: orphan tool result ${event.callId}`);
          if (results.has(event.callId)) throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool result ${event.callId}`);
          results.add(event.callId);
        }
      }
      for (const event of events) {
        if (event.kind === "assistant_tool_calls") {
          for (const call of event.calls) {
            if (calls.has(call.id)) throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool call id ${call.id}`);
            calls.set(call.id, { name: call.name });
          }
        } else if (event.kind === "tool_result") {
          const call = calls.get(event.callId);
          if (!call) throw new Error(`INVALID_PROTOCOL_HISTORY: orphan tool result ${event.callId}`);
          if (call.name !== event.toolName) throw new Error(`INVALID_PROTOCOL_HISTORY: tool result name mismatch ${event.callId}`);
          if (results.has(event.callId)) throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool result ${event.callId}`);
          results.add(event.callId);
        } else if (event.kind === "condensation") {
          const byId = new Map(existing.map((candidate) => [candidate.id, candidate]));
          const forgotten = new Set(event.condensation.forgottenEventIds);
          for (const id of forgotten) {
            const candidate = byId.get(id);
            if (!candidate) throw new Error(`INVALID_CONDENSATION: unknown or non-earlier event ${id}`);
            if (candidate.sequence < event.condensation.coveredSequence.from ||
              candidate.sequence > event.condensation.coveredSequence.through) {
              throw new Error(`INVALID_CONDENSATION: event ${id} lies outside covered sequence`);
            }
          }
          for (const candidate of existing) {
            if (candidate.kind !== "assistant_tool_calls") continue;
            const unitIds = [candidate.id, ...candidate.calls.map((call) => existing.find(
              (result) => result.kind === "tool_result" && result.callId === call.id,
            )?.id).filter((id): id is string => Boolean(id))];
            if (unitIds.some((id) => forgotten.has(id)) && !unitIds.every((id) => forgotten.has(id))) {
              throw new Error(`INVALID_CONDENSATION: protocol unit ${candidate.id} is only partially covered`);
            }
          }
        }
      }
      const appended = await dependencies.eventStore.append(spec.sessionId, events);
      return {
        eventIds: appended.map((event) => event.id),
        throughEventId: appended.at(-1)!.id,
      };
    },

    async project(request: ProjectionRequest): Promise<ContextProjection> {
      const events = await dependencies.eventStore.read(spec.sessionId);
      if (events.length === 0) throw new Error("AgentContext cannot project an empty session");
      const eventProjection = compactCompletedMutations(events);
      const rawMessages = eventMessages(eventProjection, request.model.provider);
      const truncated = truncateReproducibleToolOutput(rawMessages, eventProjection.events, request.pressure);
      const messages = truncated.messages;
      const profileReserve = COMPLETION_RESERVES[request.completionProfile];
      const toolSchemaTokens = estimateTextTokens(JSON.stringify(request.tools));
      const rawEstimatedInputTokens = messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
      const estimatedInputTokens = Math.ceil(rawEstimatedInputTokens * calibrationRatio);
      const completionReserve = profileReserve;
      const inputCeiling = request.model.contextWindow - completionReserve - SAFETY_RESERVE - toolSchemaTokens;
      if (estimatedInputTokens > inputCeiling) {
        throw new Error(
          `Insufficient completion budget: CONTEXT_EXHAUSTED estimated_input_tokens=${estimatedInputTokens}, ` +
            `input_ceiling=${inputCeiling}, completion_reserve=${completionReserve}, minimum=${MIN_COMPLETION_TOKENS}`,
        );
      }
      const last = messages.findLast((message) => message.role !== "system");
      if (last?.role === "assistant") {
        throw new Error("INVALID_PROTOCOL_HISTORY: request ends with an assistant/model turn");
      }
      estimatesByProjection.set(events.at(-1)!.id, rawEstimatedInputTokens);
      return {
        messages,
        maxCompletionTokens: completionReserve,
        throughEventId: events.at(-1)!.id,
        provenance: {
          includedEventIds: eventProjection.includedEventIds,
          summarizedEventIds: eventProjection.summarizedEventIds,
          omittedEventIds: eventProjection.omittedEventIds,
          condensationEventIds: events.filter((event) => event.kind === "condensation").map((event) => event.id),
        },
        budget: {
          contextWindow: request.model.contextWindow,
          estimatedInputTokens,
          toolSchemaTokens,
          completionReserve,
          safetyReserve: SAFETY_RESERVE,
        },
        compaction: {
          stages: [
            ...(eventProjection.usedMutationReceipts ? ["mutation_receipts" as const] : []),
            ...(eventProjection.usedSupersededObservations ? ["superseded_observations" as const] : []),
            ...(eventProjection.usedTypedCheckpoint ? ["typed_checkpoint" as const] : []),
            ...(truncated.changed ? ["truncate_reproducible_output" as const] : []),
            ...(eventProjection.usedCondensation ? ["semantic_condensation" as const] : []),
          ],
          estimatedTokensBefore: estimateTextTokens(JSON.stringify(events)),
          estimatedTokensAfter: estimatedInputTokens,
          removedPayloadBytes: eventProjection.removedPayloadBytes + truncated.removedBytes,
        },
      };
    },

    async observe(observation: ProviderObservation): Promise<void> {
      const estimate = estimatesByProjection.get(observation.throughEventId);
      if (!estimate || !observation.usage || observation.usage.promptTokens <= 0) return;
      const measured = Math.max(0.5, Math.min(2, observation.usage.promptTokens / estimate));
      calibrationRatio = calibrationRatio * 0.8 + measured * 0.2;
    },
  };
}
