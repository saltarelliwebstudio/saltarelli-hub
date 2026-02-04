import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  retellApiKey: string;
  retellAgentId: string;
  voiceEnabled: boolean;
  automationsEnabled: boolean;
  billingEnabled: boolean;
}

export function CreateClientModal({ open, onOpenChange, onSuccess }: CreateClientModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    retellApiKey: '',
    retellAgentId: '',
    voiceEnabled: false,
    automationsEnabled: false,
    billingEnabled: false,
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      address: '',
      retellApiKey: '',
      retellAgentId: '',
      voiceEnabled: false,
      automationsEnabled: false,
      billingEnabled: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create user via Supabase Auth (magic link invite)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        email_confirm: false,
        user_metadata: { full_name: formData.fullName },
      });

      // If admin API not available, we'll use signUp with auto-confirm off
      // The user will receive a confirmation email
      let userId: string | null = null;

      if (authError) {
        // Fallback: use signInWithOtp to send magic link
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: formData.email,
          options: {
            data: { full_name: formData.fullName },
            emailRedirectTo: window.location.origin,
          },
        });

        if (otpError) throw otpError;

        // We can't get the user ID until they confirm, so we'll create the pod
        // with a placeholder approach - actually we need the user to exist first
        // Let's check if a profile already exists for this email
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .single();

        if (existingProfile) {
          userId = existingProfile.id;
        } else {
          // User doesn't exist yet - they'll need to confirm email first
          toast({
            title: 'Magic link sent!',
            description: `An invitation has been sent to ${formData.email}. The pod will be created once they confirm their email.`,
          });
          resetForm();
          onOpenChange(false);
          setLoading(false);
          return;
        }
      } else {
        userId = authData.user?.id || null;
      }

      if (!userId) {
        throw new Error('Could not create or find user');
      }

      // 2. Create the pod
      const { data: pod, error: podError } = await supabase
        .from('pods')
        .insert({
          name: formData.companyName || formData.fullName,
          owner_id: userId,
          company_name: formData.companyName,
          contact_email: formData.email,
          contact_phone: formData.phone,
          address: formData.address,
          retell_api_key: formData.retellApiKey || null,
          retell_agent_id: formData.retellAgentId || null,
          branding_label: formData.companyName || formData.fullName,
        })
        .select()
        .single();

      if (podError) throw podError;

      // 3. Update pod_settings (auto-created by trigger, so we update)
      const { error: settingsError } = await supabase
        .from('pod_settings')
        .update({
          voice_enabled: formData.voiceEnabled,
          automations_enabled: formData.automationsEnabled,
          billing_enabled: formData.billingEnabled,
          visible_modules: [
            ...(formData.voiceEnabled ? ['voice'] : []),
            ...(formData.automationsEnabled ? ['automations'] : []),
            ...(formData.billingEnabled ? ['billing'] : []),
          ],
        })
        .eq('pod_id', pod.id);

      if (settingsError) throw settingsError;

      toast({
        title: 'Client created successfully!',
        description: `${formData.companyName || formData.fullName} has been added.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: 'Failed to create client',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Add a new client pod. They will receive an email invitation to set up their account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                value={formData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, State 12345"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>

          {/* Retell Config */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Retell AI Configuration (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retellApiKey">API Key</Label>
                <Input
                  id="retellApiKey"
                  type="password"
                  placeholder="ret_..."
                  value={formData.retellApiKey}
                  onChange={(e) => updateField('retellApiKey', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retellAgentId">Agent ID</Label>
                <Input
                  id="retellAgentId"
                  placeholder="agent_..."
                  value={formData.retellAgentId}
                  onChange={(e) => updateField('retellAgentId', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Module Toggles */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Enable Modules</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="voiceEnabled"
                  checked={formData.voiceEnabled}
                  onCheckedChange={(checked) => updateField('voiceEnabled', checked === true)}
                />
                <Label htmlFor="voiceEnabled" className="cursor-pointer">Voice</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="automationsEnabled"
                  checked={formData.automationsEnabled}
                  onCheckedChange={(checked) => updateField('automationsEnabled', checked === true)}
                />
                <Label htmlFor="automationsEnabled" className="cursor-pointer">Automations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billingEnabled"
                  checked={formData.billingEnabled}
                  onCheckedChange={(checked) => updateField('billingEnabled', checked === true)}
                />
                <Label htmlFor="billingEnabled" className="cursor-pointer">Billing</Label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gradient-orange text-white shadow-glow-orange"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
