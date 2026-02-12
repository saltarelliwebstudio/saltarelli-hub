import { Globe, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMyPod } from '@/hooks/useSupabaseData';

export default function Website() {
  const { data: myPod, isLoading } = useMyPod();

  const websiteUrl = myPod?.pod_settings?.website_url;
  const googleSheetUrl = myPod?.pod_settings?.google_sheet_url;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Website</h1>
          <p className="text-muted-foreground mt-1">Your website and analytics</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="animate-pulse"><CardContent className="pt-6 h-48" /></Card>
          <Card className="animate-pulse"><CardContent className="pt-6 h-48" /></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website</h1>
        <p className="text-muted-foreground mt-1">Your website and analytics</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Website Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/15 p-2.5">
                <Globe className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Website</CardTitle>
                <CardDescription>Visit your live website</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {websiteUrl ? (
              <>
                <p className="text-sm text-muted-foreground mb-4 break-all">{websiteUrl}</p>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gradient-orange text-white shadow-glow-orange">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Visit Website
                  </Button>
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your website link hasn't been set up yet. Contact support if you have questions.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Google Sheet Analytics Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/15 p-2.5">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Analytics</CardTitle>
                <CardDescription>View your analytics spreadsheet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {googleSheetUrl ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">Your analytics data is available in Google Sheets.</p>
                <a href={googleSheetUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Google Sheet
                  </Button>
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your analytics sheet hasn't been set up yet. Contact support if you have questions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
