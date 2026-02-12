import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Eye, EyeOff, Loader2, Wand2, ChevronDown } from 'lucide-react';
import { useCreateClient } from '@/hooks/useSupabaseData';
import { generatePassword } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  address: z.string().optional(),
  voice_enabled: z.boolean().default(false),
  automations_enabled: z.boolean().default(false),
  website_enabled: z.boolean().default(false),
  website_url: z.string().optional(),
  google_sheet_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RetellAccountInput {
  label: string;
  retell_api_key: string;
  retell_agent_id: string;
  google_sheet_url: string;
}

interface CreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateClientModal({ open, onOpenChange, onSuccess }: CreateClientModalProps) {
  const createClient = useCreateClient();
  const [showPassword, setShowPassword] = useState(false);
  const [retellAccounts, setRetellAccounts] = useState<RetellAccountInput[]>([]);
  const [activeTab, setActiveTab] = useState<string>('quick');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [retellOpen, setRetellOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      phone: '',
      company_name: '',
      address: '',
      voice_enabled: false,
      automations_enabled: false,
      website_enabled: false,
      website_url: '',
      google_sheet_url: '',
    },
  });

  const addRetellAccount = () => {
    setRetellAccounts([...retellAccounts, { label: '', retell_api_key: '', retell_agent_id: '', google_sheet_url: '' }]);
  };

  const removeRetellAccount = (index: number) => {
    setRetellAccounts(retellAccounts.filter((_, i) => i !== index));
  };

  const updateRetellAccount = (index: number, field: keyof RetellAccountInput, value: string) => {
    const updated = [...retellAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setRetellAccounts(updated);
  };

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    form.setValue('password', pwd, { shouldValidate: true });
    setShowPassword(true);
  };

  const onSubmit = async (data: FormData) => {
    // Validate retell accounts if voice is enabled and accounts exist
    if (data.voice_enabled && retellAccounts.length > 0) {
      const invalidAccounts = retellAccounts.some(
        acc => !acc.label || !acc.retell_api_key || !acc.retell_agent_id
      );
      if (invalidAccounts) {
        return;
      }
    }

    try {
      await createClient.mutateAsync({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone,
        company_name: data.company_name,
        address: data.address,
        voice_enabled: data.voice_enabled,
        automations_enabled: data.automations_enabled,
        website_enabled: data.website_enabled,
        website_url: data.website_url,
        google_sheet_url: data.google_sheet_url,
        retell_accounts: retellAccounts
          .filter(acc => acc.label && acc.retell_api_key && acc.retell_agent_id)
          .map(acc => ({
            label: acc.label,
            retell_api_key: acc.retell_api_key,
            retell_agent_id: acc.retell_agent_id,
            google_sheet_url: acc.google_sheet_url || null,
          })),
      });
      form.reset();
      setRetellAccounts([]);
      setActiveTab('quick');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  };

  const voiceEnabled = form.watch('voice_enabled');
  const websiteEnabled = form.watch('website_enabled');

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setRetellAccounts([]);
      setShowPassword(false);
      setActiveTab('quick');
    }
    onOpenChange(isOpen);
  };

  // Shared password field renderer
  const renderPasswordField = () => (
    <FormField
      control={form.control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Password *</FormLabel>
          <FormControl>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                className="flex-shrink-0 h-10"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(activeTab === 'quick' ? 'max-w-md' : 'max-w-2xl', 'max-h-[90vh]')}>
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Create a new client account. They will be able to log in with the email and password you set.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Add</TabsTrigger>
            <TabsTrigger value="full">Full Setup</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* Quick Add Tab */}
              <TabsContent value="quick">
                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@company.com" {...field} />
                        </FormControl>
                        <FormDescription>This will be their login email</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {renderPasswordField()}

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="gradient-orange text-white shadow-glow-orange"
                      disabled={createClient.isPending}
                    >
                      {createClient.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Client'
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Full Setup Tab */}
              <TabsContent value="full">
                <ScrollArea className="max-h-[calc(90vh-220px)] pr-4">
                  <div className="space-y-4 pt-2">
                    {/* Account Information - always visible */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Account Information</h3>

                      <FormField
                        control={form.control}
                        name="full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John Smith" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@company.com" {...field} />
                            </FormControl>
                            <FormDescription>This will be their login email</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {renderPasswordField()}
                    </div>

                    <Separator />

                    {/* Company Details - collapsible */}
                    <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
                          <h3 className="text-sm font-medium">Company Details</h3>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', companyOpen && 'rotate-180')} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-3">
                        <FormField
                          control={form.control}
                          name="company_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Corporation" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="(555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input placeholder="123 Main St, City, State 12345" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    <Separator />

                    {/* Modules - collapsible */}
                    <Collapsible open={modulesOpen} onOpenChange={setModulesOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
                          <h3 className="text-sm font-medium">Modules</h3>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', modulesOpen && 'rotate-180')} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-3">
                        <FormField
                          control={form.control}
                          name="voice_enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Voice Agent</FormLabel>
                                <FormDescription>Enable Retell AI voice agent integration</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="automations_enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Automations</FormLabel>
                                <FormDescription>Enable automation event logging</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="website_enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Website</FormLabel>
                                <FormDescription>Show website and analytics links in client dashboard</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {websiteEnabled && (
                          <div className="space-y-3 pl-3 border-l-2 border-accent/30 ml-1">
                            <FormField
                              control={form.control}
                              name="website_url"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Website URL</FormLabel>
                                  <FormControl>
                                    <Input type="url" placeholder="https://example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="google_sheet_url"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Google Sheet URL <span className="text-muted-foreground text-xs">(analytics)</span></FormLabel>
                                  <FormControl>
                                    <Input type="url" placeholder="https://docs.google.com/spreadsheets/d/..." {...field} />
                                  </FormControl>
                                  <FormDescription>Link to the client's analytics Google Sheet</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Retell Accounts - collapsible, only if voice enabled */}
                    {voiceEnabled && (
                      <>
                        <Separator />
                        <Collapsible open={retellOpen} onOpenChange={setRetellOpen}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
                              <h3 className="text-sm font-medium">Retell AI Agents</h3>
                              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', retellOpen && 'rotate-180')} />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-4 pt-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">Add one or more Retell agents for this client</p>
                              <Button type="button" variant="outline" size="sm" onClick={addRetellAccount}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Agent
                              </Button>
                            </div>

                            {retellAccounts.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                                No Retell agents added yet. Click "Add Agent" to get started.
                              </p>
                            )}

                            {retellAccounts.map((account, index) => (
                              <div key={index} className="space-y-3 p-4 border rounded-lg relative">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-2 top-2 h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeRetellAccount(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>

                                <div className="grid gap-3 pr-8">
                                  <div>
                                    <label className="text-sm font-medium">Agent Label *</label>
                                    <Input
                                      placeholder="e.g., Main Inbound Agent"
                                      value={account.label}
                                      onChange={(e) => updateRetellAccount(index, 'label', e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Retell API Key *</label>
                                    <Input
                                      type="password"
                                      placeholder="key_..."
                                      value={account.retell_api_key}
                                      onChange={(e) => updateRetellAccount(index, 'retell_api_key', e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Retell Agent ID *</label>
                                    <Input
                                      placeholder="agent_..."
                                      value={account.retell_agent_id}
                                      onChange={(e) => updateRetellAccount(index, 'retell_agent_id', e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Google Sheet URL <span className="text-muted-foreground text-xs">(optional)</span></label>
                                    <Input
                                      type="url"
                                      placeholder="https://docs.google.com/spreadsheets/d/..."
                                      value={account.google_sheet_url}
                                      onChange={(e) => updateRetellAccount(index, 'google_sheet_url', e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      </>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="gradient-orange text-white shadow-glow-orange"
                        disabled={createClient.isPending}
                      >
                        {createClient.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Client'
                        )}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
