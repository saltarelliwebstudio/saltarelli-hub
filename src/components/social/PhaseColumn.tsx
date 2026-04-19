import { Check } from "lucide-react";
import { SkillCard } from "./SkillCard";
import type { PhaseDefinition, SkillDefinition } from "./types";

interface PhaseColumnProps {
  phase: PhaseDefinition;
  lastRuns: Record<string, string>;
  runningSkillId: string | null;
  onRunSkill: (skill: SkillDefinition) => void;
}

export function PhaseColumn({
  phase,
  lastRuns,
  runningSkillId,
  onRunSkill,
}: PhaseColumnProps) {
  const activeSkills = phase.skills.filter((s) => s.status !== "coming-soon");
  const allComplete =
    activeSkills.length > 0 &&
    activeSkills.every((s) => lastRuns[s.id]);

  return (
    <div className="flex flex-col gap-4 min-w-0 flex-1">
      {/* Phase Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-white shrink-0">
          {phase.number}
        </div>
        <h3 className="font-semibold text-lg">
          {phase.name}
        </h3>
        {allComplete && (
          <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-3 w-3 text-success" />
          </div>
        )}
      </div>

      {/* Skill Cards */}
      <div className="flex flex-col gap-3">
        {phase.skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            lastRun={lastRuns[skill.id] || null}
            isRunning={runningSkillId === skill.id}
            onRun={onRunSkill}
          />
        ))}
      </div>
    </div>
  );
}
