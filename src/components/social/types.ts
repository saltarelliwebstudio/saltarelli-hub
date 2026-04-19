export type SkillStatus = "active" | "running" | "coming-soon";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  phase: number;
  status: SkillStatus;
  flagship: boolean;
  logMessages: string[];
  edgeFunctionName?: string; // if set, Run triggers a real Edge Function instead of simulated logs
}

export interface PhaseDefinition {
  number: number;
  name: string;
  skills: SkillDefinition[];
}

export interface SkillRunState {
  skillId: string;
  status: "idle" | "running" | "completed" | "stopped" | "failed";
  logs: string[];
  progress: number;
  runId?: string; // DB row ID for real runs
}

export interface SkillRunRow {
  id: string;
  skill_id: string;
  status: "running" | "completed" | "failed" | "stopped";
  logs: string[];
  result: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  created_by: string;
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
