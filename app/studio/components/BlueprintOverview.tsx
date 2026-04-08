import type { PlannedProjectBlueprint } from "../../studio/types/build-studio";
import { blueprintToViewModel } from "../mappers/blueprintToViewModel";

export function BlueprintOverview({ blueprint }: { blueprint: PlannedProjectBlueprint }) {
    const view = blueprintToViewModel(blueprint);

    return (
        <div className="space-y-4 text-[12px]">
            {/* Project */}
            <div className="space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Project</div>
                <div className="text-[13px] font-medium text-foreground">{view.brief.projectTitle}</div>
                <div className="leading-5 text-muted-foreground">{view.brief.projectDescription}</div>
            </div>

            <div className="h-px bg-white/6" />

            {/* Scope */}
            <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Scope</div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/4 px-3 py-2">
                        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400/80">In scope</div>
                        <ul className="space-y-1">
                            {view.brief.productScope.inScope.map((item, i) => (
                                <li key={i} className="flex gap-1.5 leading-4 text-muted-foreground">
                                    <span className="mt-0.5 shrink-0 text-emerald-400/60">+</span>{item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-xl bg-white/4 px-3 py-2">
                        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-red-400/80">Out of scope</div>
                        <ul className="space-y-1">
                            {view.brief.productScope.outOfScope.map((item, i) => (
                                <li key={i} className="flex gap-1.5 leading-4 text-muted-foreground">
                                    <span className="mt-0.5 shrink-0 text-red-400/60">–</span>{item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/6" />

            {/* Capabilities */}
            <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Capabilities</div>
                <div className="space-y-2">
                    {view.brief.capabilities.map((cap) => (
                        <div key={cap.capabilityId} className="rounded-xl bg-white/4 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{cap.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${cap.priority === "must-have" ? "bg-primary/15 text-primary" : "bg-white/8 text-muted-foreground"}`}>
                                    {cap.priority}
                                </span>
                            </div>
                            {cap.summary && (
                                <div className="mt-1 leading-5 text-muted-foreground">{cap.summary}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-px bg-white/6" />

            {/* User Roles */}
            {view.brief.roles.length > 0 && (
                <div className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">User Roles</div>
                    {view.brief.roles.map((role) => (
                        <div key={role.roleId} className="rounded-xl bg-white/4 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{role.roleName}</span>
                                {role.priority === "primary" && (
                                    <span className="rounded-full bg-accent-tertiary/15 px-2 py-0.5 text-[10px] font-mono text-accent-tertiary">primary</span>
                                )}
                            </div>
                            {role.summary && <div className="mt-1 leading-5 text-muted-foreground">{role.summary}</div>}
                            {role.goals?.length > 0 && (
                                <div className="mt-2">
                                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">Goals</div>
                                    <ul className="space-y-0.5">
                                        {role.goals.map((g, i) => (
                                            <li key={i} className="flex gap-1.5 leading-5 text-muted-foreground">
                                                <span className="shrink-0 text-primary/50">›</span>{g}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="h-px bg-white/6" />

            {/* Task Loops */}
            {view.brief.taskLoops.length > 0 && (
                <div className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Task Loops</div>
                    {view.brief.taskLoops.map((loop) => (
                        <div key={loop.loopId} className="rounded-xl bg-white/4 px-3 py-2">
                            <div className="font-medium text-foreground">{loop.name}</div>
                            {loop.summary && <div className="mt-1 leading-5 text-muted-foreground">{loop.summary}</div>}
                            {loop.steps?.length > 0 && (
                                <ol className="mt-2 space-y-0.5">
                                    {loop.steps.map((s, i) => (
                                        <li key={i} className="flex gap-2 leading-5 text-muted-foreground">
                                            <span className="shrink-0 font-mono text-[10px] text-primary/50">{i + 1}.</span>{s}
                                        </li>
                                    ))}
                                </ol>
                            )}
                            {loop.successState && (
                                <div className="mt-2 flex gap-1.5 rounded-lg bg-emerald-400/8 px-2 py-1.5 text-[11px] text-emerald-300/80">
                                    <span className="shrink-0">✓</span>{loop.successState}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="h-px bg-white/6" />

            {/* Design Intent */}
            <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Design Intent</div>
                <div className="rounded-xl bg-white/4 px-3 py-2 space-y-2">
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Style · </span>
                        <span className="text-muted-foreground">{view.experience.designIntent.style}</span>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Colors · </span>
                        <span className="text-muted-foreground">{view.experience.designIntent.colorDirection}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {view.experience.designIntent.mood.map((m) => (
                            <span key={m} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-foreground/70">{m}</span>
                        ))}
                        {view.experience.designIntent.keywords.map((k) => (
                            <span key={k} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary/70">{k}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/6" />

            {/* Pages */}
            <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
                    Site · {view.site.pages.length} pages
                </div>
                <div className="space-y-2">
                    {view.site.pages.map((page) => (
                        <div key={page.slug} className="rounded-xl bg-white/4 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{page.title}</span>
                                <span className="font-mono text-[10px] text-muted-foreground/60">/{page.slug}</span>
                            </div>
                            {page.description && (
                                <div className="mt-1 leading-5 text-muted-foreground">{page.description}</div>
                            )}
                            {page.sections.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                    {page.sections.map((section, idx) => (
                                        <div key={`${section.fileName}-${idx}`} className="rounded-lg bg-black/20 px-2.5 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[11px] text-accent-tertiary">{section.fileName}</span>
                                                <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{section.type}</span>
                                            </div>
                                            {section.intent && (
                                                <div className="mt-1 leading-4 text-[11px] text-muted-foreground">{section.intent}</div>
                                            )}
                                            {section.designPlan?.rationale && (
                                                <div className="mt-1.5 flex gap-1.5 rounded bg-white/4 px-2 py-1 text-[11px] leading-4 text-muted-foreground/70">
                                                    <span className="shrink-0 text-primary/40">↳</span>
                                                    {section.designPlan.rationale}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
