import {
  BarChart3,
  Eye,
  Clapperboard,
  Film,
  Send,
  Lightbulb,
  FileText,
} from "lucide-react";
import type { PhaseDefinition } from "./types";

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  Eye,
  Clapperboard,
  Film,
  Send,
  Lightbulb,
  FileText,
};

export const SKILL_ICON_MAP: Record<string, keyof typeof ICON_MAP> = {
  "ig-poll": "BarChart3",
  "competitor-analysis": "Eye",
  "content-intelligence": "Lightbulb",
  "film-today": "Clapperboard",
  "script-generator": "FileText",
  "production-placeholder": "Film",
  "post-content": "Send",
};

export const PHASES: PhaseDefinition[] = [
  {
    number: 1,
    name: "Data Research",
    skills: [
      {
        id: "ig-poll",
        name: "IG Poll",
        description: "Pull Instagram content into DB and analyze performance metrics",
        phase: 1,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-ig-poll",
        logMessages: [
          "[INFO] Connecting to Instagram Graph API...",
          "[INFO] Authenticating with access token...",
          "[INFO] Fetching recent posts (last 30 days)...",
          "[DATA] Retrieved 47 posts, 12 reels, 3 stories",
          "[INFO] Calculating engagement rates per post...",
          "[INFO] Analyzing hashtag performance across content...",
          "[DATA] Top performing: #webdesign (4.2% ER), #smallbusiness (3.8% ER)",
          "[INFO] Computing audience growth trends...",
          "[DATA] Follower delta: +127 (30d), peak day: Thursday",
          "[INFO] Ranking content by reach and saves...",
          "[INFO] Storing results in database...",
          "[SUCCESS] IG Poll complete. 62 items analyzed, 8 insights generated.",
        ],
      },
      {
        id: "competitor-analysis",
        name: "Competitor Analysis",
        description: "Scan trending hooks, formats, and gaps in your niche vs competitors",
        phase: 1,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-competitor-analysis",
        logMessages: [],
      },
      {
        id: "content-intelligence",
        name: "Content Intelligence",
        description: "Generate ranked content ideas from analytics, trends, and your Brain",
        phase: 1,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-content-intelligence",
        logMessages: [],
      },
    ],
  },
  {
    number: 2,
    name: "Ideation",
    skills: [
      {
        id: "film-today",
        name: "Film Today",
        description: "Analyze your data and tell you exactly what to film right now",
        phase: 2,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-film-today",
        logMessages: [],
      },
    ],
  },
  {
    number: 3,
    name: "Production",
    skills: [
      {
        id: "script-generator",
        name: "Script Generator",
        description: "Generate ready-to-film scripts in Adam's voice from content ideas",
        phase: 3,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-script-generator",
        logMessages: [],
      },
      {
        id: "production-placeholder",
        name: "Video Editor",
        description: "AI-assisted video editing and post-production pipeline",
        phase: 3,
        status: "coming-soon",
        flagship: false,
        logMessages: [],
      },
    ],
  },
  {
    number: 4,
    name: "Publishing",
    skills: [
      {
        id: "post-content",
        name: "Post Content",
        description: "Queue a post with AI-rephrased description to all Buffer channels",
        phase: 4,
        status: "active",
        flagship: true,
        edgeFunctionName: "run-post-content",
        logMessages: [],
      },
    ],
  },
];
