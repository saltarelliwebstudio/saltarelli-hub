import { Share2 } from "lucide-react";
import { SocialPipeline } from "@/components/social/SocialPipeline";

export default function AdminSocialMedia() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2.5 bg-accent/10">
          <Share2 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Media Manager</h1>
          <p className="text-muted-foreground">
            AI-powered pipeline from research to publishing
          </p>
        </div>
      </div>

      {/* Pipeline */}
      <SocialPipeline />
    </div>
  );
}
