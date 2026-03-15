import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Loader2, Save, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IntegrationSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

const SETTING_GROUPS = [
  {
    title: 'Retell AI',
    description: 'Default API key used when creating new client accounts',
    icon: '🤖',
    keys: ['retell_default_api_key'],
  },
  {
    title: 'Twilio',
    description: 'SMS messaging credentials and phone number',
    icon: '💬',
    keys: ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'],
  },
  {
    title: 'OpenPhone',
    description: 'SMS drip campaign credentials — used for automated lead follow-ups',
    icon: '📱',
    keys: ['openphone_api_key', 'openphone_phone_number_id'],
  },
  {
    title: 'Modal',
    description: 'Backend API endpoint and authentication',
    icon: '⚡',
    keys: ['modal_api_url', 'modal_auth_token'],
  },
  {
    title: 'Zen Planner',
    description: 'Attendance and member management integration for gym clients',
    icon: '🏋️',
    keys: ['zen_planner_subdomain', 'zen_planner_username', 'zen_planner_password'],
  },
];

const SENSITIVE_KEYS = ['retell_default_api_key', 'twilio_auth_token', 'modal_auth_token', 'openphone_api_key', 'zen_planner_password'];

function useIntegrationSettings() {
  return useQuery({
    queryKey: ['integration-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      return data as IntegrationSetting[];
    },
  });
}

function useUpdateIntegrationSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('integration_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
      toast({ title: 'Setting saved', description: 'Integration setting updated successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });
}

function SettingField({
  setting,
  onSave,
  isSaving,
}: {
  setting: IntegrationSetting;
  onSave: (key: string, value: string) => void;
  isSaving: boolean;
}) {
  const [value, setValue] = useState(setting.value);
  const [revealed, setRevealed] = useState(false);
  const isSensitive = SENSITIVE_KEYS.includes(setting.key);
  const isDirty = value !== setting.value;

  useEffect(() => {
    setValue(setting.value);
  }, [setting.value]);

  const label = setting.key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-2">
      <Label htmlFor={setting.key}>{label}</Label>
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={setting.key}
            type={isSensitive && !revealed ? 'password' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          {isSensitive && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {isDirty && (
          <Button
            size="sm"
            onClick={() => onSave(setting.key, value)}
            disabled={isSaving}
            className="gradient-orange text-white"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationSettings() {
  const { data: settings, isLoading } = useIntegrationSettings();
  const updateSetting = useUpdateIntegrationSetting();

  const handleSave = (key: string, value: string) => {
    updateSetting.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  const settingsMap = new Map(settings?.map(s => [s.key, s]) || []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">Manage API keys and service connections</p>
      </div>

      {SETTING_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-xl">{group.icon}</span>
              <CardTitle>{group.title}</CardTitle>
            </div>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.keys.map((key) => {
              const setting = settingsMap.get(key);
              if (!setting) return null;
              return (
                <SettingField
                  key={key}
                  setting={setting}
                  onSave={handleSave}
                  isSaving={updateSetting.isPending}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="rounded-full bg-accent/10 p-3 h-fit">
              <Plug className="h-5 w-5 text-accent" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">About Integration Settings</h4>
              <p className="text-sm text-muted-foreground">
                These credentials are stored securely in the database and used by backend functions.
                Per-client Retell AI keys are managed in each client's detail page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
