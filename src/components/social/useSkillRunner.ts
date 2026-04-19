import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SkillDefinition, SkillRunState } from "./types";

const LOCAL_STORAGE_KEY = "smm-last-runs";

// localStorage fallback for simulated skills
function readLocalLastRuns(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalLastRun(skillId: string) {
  const runs = readLocalLastRuns();
  runs[skillId] = new Date().toISOString();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(runs));
  return runs;
}

export function useSkillRunner() {
  const [runState, setRunState] = useState<SkillRunState | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, string>>(readLocalLastRuns);
  const [isSheetOpen, setSheetOpen] = useState(false);

  // Refs for simulated runs
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  const skillRef = useRef<SkillDefinition | null>(null);

  // Ref for realtime channel cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Fetch last runs from DB on mount (for skills with edge functions)
  useEffect(() => {
    async function fetchDbLastRuns() {
      const { data } = await supabase
        .from("skill_runs")
        .select("skill_id, started_at")
        .eq("status", "completed")
        .order("started_at", { ascending: false });

      if (data && data.length > 0) {
        const dbRuns: Record<string, string> = {};
        for (const row of data) {
          if (!dbRuns[row.skill_id]) {
            dbRuns[row.skill_id] = row.started_at;
          }
        }
        // Merge DB runs with localStorage runs (DB takes priority)
        setLastRuns((prev) => ({ ...prev, ...dbRuns }));
      }
    }
    fetchDbLastRuns();
  }, []);

  // --- Simulated run logic (for skills without edgeFunctionName) ---
  const scheduleNext = useCallback(() => {
    const skill = skillRef.current;
    if (!skill) return;

    const delay = Math.random() * 400 + 400;
    timeoutRef.current = setTimeout(() => {
      const idx = indexRef.current;
      if (idx >= skill.logMessages.length) {
        const updated = writeLocalLastRun(skill.id);
        setLastRuns((prev) => ({ ...prev, ...updated }));
        setRunState((prev) =>
          prev ? { ...prev, status: "completed", progress: 100 } : prev
        );
        return;
      }

      indexRef.current = idx + 1;
      setRunState((prev) => {
        if (!prev) return prev;
        const newLogs = [...prev.logs, skill.logMessages[idx]];
        const progress = Math.round(
          (newLogs.length / skill.logMessages.length) * 100
        );
        return { ...prev, logs: newLogs, progress };
      });

      scheduleNext();
    }, delay);
  }, []);

  const startSimulatedRun = useCallback(
    (skill: SkillDefinition) => {
      clearTimer();
      skillRef.current = skill;
      indexRef.current = 0;
      setRunState({
        skillId: skill.id,
        status: "running",
        logs: [],
        progress: 0,
      });
      setSheetOpen(true);
      timeoutRef.current = setTimeout(() => scheduleNext(), 300);
    },
    [clearTimer, scheduleNext]
  );

  // --- Real run logic (for skills with edgeFunctionName) ---
  const startRealRun = useCallback(
    async (skill: SkillDefinition) => {
      cleanupChannel();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert skill_runs row
      const { data: row, error } = await supabase
        .from("skill_runs")
        .insert({
          skill_id: skill.id,
          status: "running",
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !row) {
        console.error("Failed to create skill run:", error);
        return;
      }

      const runId = row.id;

      setRunState({
        skillId: skill.id,
        status: "running",
        logs: [],
        progress: 0,
        runId,
      });
      setSheetOpen(true);

      // Subscribe to realtime updates on this specific row
      const channel = supabase
        .channel(`skill-run-${runId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "skill_runs",
            filter: `id=eq.${runId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            const newLogs: string[] = updated.logs || [];
            const newStatus = updated.status as SkillRunState["status"];

            setRunState((prev) => {
              if (!prev || prev.runId !== runId) return prev;
              // Estimate progress: assume ~12 log lines per skill
              const progress = newStatus === "completed" ? 100
                : newStatus === "failed" ? 100
                : Math.min(95, Math.round((newLogs.length / 12) * 100));
              return {
                ...prev,
                logs: newLogs,
                status: newStatus,
                progress,
              };
            });

            // If terminal status, update lastRuns and cleanup
            if (newStatus === "completed" || newStatus === "failed" || newStatus === "stopped") {
              if (newStatus === "completed") {
                setLastRuns((prev) => ({
                  ...prev,
                  [skill.id]: updated.started_at || new Date().toISOString(),
                }));
              }
              // Delay cleanup slightly so final state renders
              setTimeout(() => {
                supabase.removeChannel(channel);
              }, 500);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Fire-and-forget the Edge Function
      supabase.functions.invoke(skill.edgeFunctionName!, {
        body: { run_id: runId },
      });
    },
    [cleanupChannel]
  );

  // --- Public API ---
  const startRun = useCallback(
    (skill: SkillDefinition) => {
      if (skill.edgeFunctionName) {
        startRealRun(skill);
      } else {
        startSimulatedRun(skill);
      }
    },
    [startRealRun, startSimulatedRun]
  );

  const stopRun = useCallback(async () => {
    const current = runState;
    if (!current) return;

    if (current.runId) {
      // Real run — update DB status
      await supabase
        .from("skill_runs")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", current.runId);
      cleanupChannel();
      setRunState((prev) =>
        prev
          ? {
              ...prev,
              status: "stopped",
              logs: [...prev.logs, "[STOPPED] Run cancelled by user."],
            }
          : prev
      );
    } else {
      // Simulated run
      clearTimer();
      setRunState((prev) =>
        prev
          ? {
              ...prev,
              status: "stopped",
              logs: [...prev.logs, "[STOPPED] Run cancelled by user."],
            }
          : prev
      );
    }
  }, [runState, clearTimer, cleanupChannel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      cleanupChannel();
    };
  }, [clearTimer, cleanupChannel]);

  return {
    runState,
    lastRuns,
    startRun,
    stopRun,
    isSheetOpen,
    setSheetOpen,
  };
}
