import { useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SkillRunState } from "./types";

interface SkillRunPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  runState: SkillRunState | null;
  skillName: string;
  onStop: () => void;
}

function StatusDot({ status }: { status: SkillRunState["status"] }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
      </span>
    );
  }
  if (status === "completed") {
    return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-success" />;
  }
  if (status === "stopped") {
    return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-warning" />;
  }
  if (status === "failed") {
    return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />;
  }
  return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground" />;
}

const statusLabel: Record<SkillRunState["status"], string> = {
  idle: "Idle",
  running: "Running...",
  completed: "Completed",
  stopped: "Stopped",
  failed: "Failed",
};

export function SkillRunPanel({
  isOpen,
  onOpenChange,
  runState,
  skillName,
  onStop,
}: SkillRunPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [runState?.logs.length]);

  const status = runState?.status || "idle";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <SheetTitle>{skillName}</SheetTitle>
          </div>
          <SheetDescription>{statusLabel[status]}</SheetDescription>
        </SheetHeader>

        {/* Log Output */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-lg bg-muted/50 border border-border p-4 my-4"
        >
          <div className="font-mono text-sm space-y-1">
            {runState?.logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("[SUCCESS]")
                    ? "text-success"
                    : line.startsWith("[ERROR]")
                    ? "text-destructive"
                    : line.startsWith("[DATA]")
                    ? "text-accent"
                    : line.startsWith("[STOPPED]")
                    ? "text-warning"
                    : "text-muted-foreground"
                }
              >
                {line}
              </div>
            ))}
            {status === "running" && (
              <span className="text-accent animate-pulse">_</span>
            )}
          </div>
        </div>

        {/* Progress */}
        <Progress value={runState?.progress || 0} className="h-2" />

        <SheetFooter className="mt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {runState ? `${runState.logs.length} lines` : ""}
            </span>
            {status === "running" ? (
              <Button variant="destructive" size="sm" onClick={onStop}>
                Stop
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
