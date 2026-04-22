const ALLOWED_PHASES = [
    "setup",
    "planning",
    "execution",
    "verification",
    "finalize",
];
const ALLOWED_EVENT_TYPES = [
    "run_start",
    "run_end",
    "thought",
    "message",
    "tool_call",
    "tool_result",
    "shell_command",
    "shell_result",
    "file_patch",
    "file_snapshot",
    "test_start",
    "test_result",
    "error",
    "checkpoint",
    "repair_episode_started",
    "repair_action_started",
    "repair_action_result",
    "repair_verification_result",
    "repair_episode_finished",
];
const ALLOWED_ACTORS = ["system", "user", "agent", "tool", "evaluator"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isIsoDateString(value) {
    if (typeof value !== "string")
        return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp);
}
export function validateRunStartInput(value) {
    if (!isRecord(value)) {
        throw new Error("Body must be a JSON object");
    }
    const { task_id, goal, task_spec_ref, environment, success_criteria, meta } = value;
    if (!isNonEmptyString(task_id))
        throw new Error("Missing or invalid 'task_id'");
    if (!isNonEmptyString(goal))
        throw new Error("Missing or invalid 'goal'");
    if (task_spec_ref !== undefined && !isNonEmptyString(task_spec_ref)) {
        throw new Error("Invalid 'task_spec_ref'");
    }
    if (!isRecord(environment))
        throw new Error("Missing or invalid 'environment'");
    if (!Array.isArray(success_criteria) || success_criteria.some((v) => !isNonEmptyString(v))) {
        throw new Error("Missing or invalid 'success_criteria' (must be string[])");
    }
    if (meta !== undefined && !isRecord(meta))
        throw new Error("Invalid 'meta'");
    return {
        task_id,
        goal,
        task_spec_ref,
        environment,
        success_criteria,
        meta,
    };
}
export function validateTrajectoryEvent(value) {
    if (!isRecord(value)) {
        throw new Error("Event must be a JSON object");
    }
    const { schema_version, task_id, run_id, event_id, seq, ts, phase, event_type, actor, payload, meta, } = value;
    if (!isNonEmptyString(schema_version))
        throw new Error("Missing or invalid 'schema_version'");
    if (!isNonEmptyString(task_id))
        throw new Error("Missing or invalid 'task_id'");
    if (!isNonEmptyString(run_id))
        throw new Error("Missing or invalid 'run_id'");
    if (!isNonEmptyString(event_id))
        throw new Error("Missing or invalid 'event_id'");
    if (typeof seq !== "number" || !Number.isInteger(seq) || seq <= 0) {
        throw new Error("Missing or invalid 'seq' (must be positive integer)");
    }
    if (!isIsoDateString(ts))
        throw new Error("Missing or invalid 'ts'");
    if (!isNonEmptyString(phase) || !ALLOWED_PHASES.includes(phase)) {
        throw new Error("Missing or invalid 'phase'");
    }
    if (!isNonEmptyString(event_type) || !ALLOWED_EVENT_TYPES.includes(event_type)) {
        throw new Error("Missing or invalid 'event_type'");
    }
    if (!isNonEmptyString(actor) || !ALLOWED_ACTORS.includes(actor)) {
        throw new Error("Missing or invalid 'actor'");
    }
    if (!isRecord(payload))
        throw new Error("Missing or invalid 'payload'");
    if (meta !== undefined && !isRecord(meta))
        throw new Error("Invalid 'meta'");
    if (event_type === "shell_command") {
        const command = payload.command;
        if (!isNonEmptyString(command)) {
            throw new Error("shell_command payload.command is required");
        }
    }
    if (event_type === "shell_result") {
        const exitCode = payload.exit_code;
        if (exitCode !== undefined && (typeof exitCode !== "number" || !Number.isInteger(exitCode))) {
            throw new Error("shell_result payload.exit_code must be integer when provided");
        }
    }
    return {
        schema_version,
        task_id,
        run_id,
        event_id,
        seq,
        ts,
        phase: phase,
        event_type: event_type,
        actor: actor,
        payload,
        meta: meta,
    };
}
//# sourceMappingURL=schema.js.map