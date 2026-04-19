import { Play, Star } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ICON_MAP, SKILL_ICON_MAP } from "./data";
import { formatRelativeTime } from "./types";
import type { SkillDefinition } from "./types";

interface SkillCardProps {
  skill: SkillDefinition;
  lastRun: string | null;
  isRunning: boolean;
  onRun: (skill: SkillDefinition) => void;
}

function StatusBadge({ status }: { status: SkillDefinition["status"] }) {
  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        Running
      </Badge>
    );
  }
  if (status === "coming-soon") {
    return <Badge variant="outline">Coming Soon</Badge>;
  }
  return (
    <Badge className="bg-success/15 text-success border-success/20 hover:bg-success/20">
      Active
    </Badge>
  );
}

export function SkillCard({ skill, lastRun, isRunning, onRun }: SkillCardProps) {
  const iconKey = SKILL_ICON_MAP[skill.id];
  const Icon = iconKey ? ICON_MAP[iconKey] : null;
  const disabled = skill.status === "coming-soon" || isRunning;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-card-hover",
        skill.flagship && "border-l-4 border-l-accent"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="rounded-lg p-2 bg-accent/10">
                <Icon className="h-4 w-4 text-accent" />
              </div>
            )}
            <CardTitle className="text-base">
              {skill.name}
            </CardTitle>
            {skill.flagship && (
              <Star className="h-3.5 w-3.5 text-accent fill-accent shrink-0" />
            )}
          </div>
          <StatusBadge status={isRunning ? "running" : skill.status} />
        </div>
        <CardDescription className="mt-1">
          {skill.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-2" />

      <CardFooter className="flex items-center justify-between pt-0">
        <span className="text-xs text-muted-foreground">
          {lastRun ? `Last run: ${formatRelativeTime(lastRun)}` : "Never run"}
        </span>
        <Button
          size="sm"
          variant={skill.status === "coming-soon" ? "outline" : "default"}
          disabled={disabled}
          onClick={() => onRun(skill)}
          className="gap-1.5"
        >
          {skill.status === "coming-soon" ? (
            "Coming Soon"
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
