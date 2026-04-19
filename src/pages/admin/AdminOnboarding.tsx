import { useState } from 'react';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ONBOARDING_URL = 'https://sws-onboarding-deploy.vercel.app';

export default function AdminOnboarding() {
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Client Onboarding</h1>
            <p className="text-sm text-muted-foreground">
              Generate a project roadmap after every qualifying call
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKey(k => k + 1)}
          >
            New Client
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a href={`${ONBOARDING_URL}/onboarding`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in Tab
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
        <iframe
          key={key}
          src={`${ONBOARDING_URL}/onboarding`}
          className="w-full h-full border-0"
          title="Client Onboarding"
        />
      </div>
    </div>
  );
}
