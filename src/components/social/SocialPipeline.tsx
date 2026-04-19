import { ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PHASES } from "./data";
import { PhaseColumn } from "./PhaseColumn";
import { SkillRunPanel } from "./SkillRunPanel";
import { useSkillRunner } from "./useSkillRunner";

export function SocialPipeline() {
  const { runState, lastRuns, startRun, stopRun, isSheetOpen, setSheetOpen } =
    useSkillRunner();

  const allActiveSkills = PHASES.flatMap((p) =>
    p.skills.filter((s) => s.status !== "coming-soon")
  );
  const completedCount = allActiveSkills.filter(
    (s) => lastRuns[s.id]
  ).length;
  const progressPercent =
    allActiveSkills.length > 0
      ? Math.round((completedCount / allActiveSkills.length) * 100)
      : 0;

  const runningSkillName =
    runState &&
    PHASES.flatMap((p) => p.skills).find((s) => s.id === runState.skillId)
      ?.name;

  return (
    <div className="space-y-8">
      {/* Pipeline Progress */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">
            Pipeline Progress
          </span>
          <span className="font-semibold">
            {completedCount}/{allActiveSkills.length} skills completed
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Phase Pipeline */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-3">
        {PHASES.map((phase, idx) => (
          <div key={phase.number} className="contents">
            <PhaseColumn
              phase={phase}
              lastRuns={lastRuns}
              runningSkillId={runState?.status === "running" ? runState.skillId : null}
              onRunSkill={startRun}
            />
            {idx < PHASES.length - 1 && (
              <div className="hidden lg:flex items-center justify-center pt-14 shrink-0">
                <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Skill Run Panel */}
      <SkillRunPanel
        isOpen={isSheetOpen}
        onOpenChange={setSheetOpen}
        runState={runState}
        skillName={runningSkillName || ""}
        onStop={stopRun}
      />
    </div>
  );
}
