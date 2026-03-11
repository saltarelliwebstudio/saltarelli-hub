import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, PhoneCall, Eye, EyeOff, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { generatePassword } from '@/lib/utils';
import {
  useCreateAdminLead,
  useUpdateAdminLead,
  useDeleteAdminLead,
  useCreateClient,
  type AdminLead,
} from '@/hooks/useSupabaseData';

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: AdminLead | null;
}

const STATUS_OPTIONS = [
  { value: 'cold', label: 'Cold' },
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
  { value: 'followed_up', label: 'Followed Up' },
  { value: 'replied', label: 'Replied' },
  { value: 'demo_booked', label: 'Demo Booked' },
  { value: 'closed', label: 'Closed' },
  { value: 'client', label: 'Client' },
  { value: 'do_not_contact', label: 'Do Not Contact' },
] as const;

type LeadStatus = AdminLead['status'];

export function LeadModal({ open, onOpenChange, lead }: LeadModalProps) {
  const navigate = useNavigate();
  const createLead = useCreateAdminLead();
  const updateLead = useUpdateAdminLead();
  const deleteLead = useDeleteAdminLead();
  const createClient = useCreateClient();

  const isEditing = !!lead;

  // Form state
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [serviceInterest, setServiceInterest] = useState('');
  const [status, setStatus] = useState<LeadStatus>('cold');
  const [notes, setNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState<Date | undefined>();
  const [followupDate, setFollowupDate] = useState<Date | undefined>();
  const [lastContactedDate, setLastContactedDate] = useState<Date | undefined>();

  // Client promotion state
  const [showClientConfirm, setShowClientConfirm] = useState(false);
  const [clientPassword, setClientPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<LeadStatus>('cold');

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      setName(lead.name);
      setBusinessName(lead.business_name || '');
      setPhone(lead.phone || '');
      setEmail(lead.email || '');
      setSource(lead.source || '');
      setServiceInterest(lead.service_interest || '');
      setStatus(lead.status);
      setPreviousStatus(lead.status);
      setNotes(lead.notes || '');
      setNextFollowupDate(lead.next_followup_date ? new Date(lead.next_followup_date + 'T00:00:00') : undefined);
      setFollowupDate(lead.followup_date ? new Date(lead.followup_date + 'T00:00:00') : undefined);
      setLastContactedDate(lead.last_contacted_date ? new Date(lead.last_contacted_date + 'T00:00:00') : undefined);
    } else {
      setName('');
      setBusinessName('');
      setPhone('');
      setEmail('');
      setSource('');
      setServiceInterest('');
      setStatus('cold');
      setPreviousStatus('cold');
      setNotes('');
      setNextFollowupDate(undefined);
      setFollowupDate(undefined);
      setLastContactedDate(undefined);
    }
    setClientPassword('');
    setShowPassword(false);
  }, [lead, open]);

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === 'client') {
      setPreviousStatus(status);
      setShowClientConfirm(true);
    } else {
      setStatus(newStatus);
    }
  };

  const handleClientConfirmCancel = () => {
    setShowClientConfirm(false);
    setClientPassword('');
    setShowPassword(false);
  };

  const handleClientConfirm = async () => {
    if (!clientPassword || clientPassword.length < 8) return;

    try {
      await createClient.mutateAsync({
        email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@placeholder.com`,
        password: clientPassword,
        full_name: name,
        phone: phone || undefined,
        company_name: businessName || undefined,
      });

      if (lead) {
        await deleteLead.mutateAsync(lead.id);
      }

      setShowClientConfirm(false);
      setClientPassword('');
      onOpenChange(false);
      navigate('/admin/clients');
    } catch {
      // Error handled by mutations
    }
  };

  const handleLogContact = () => {
    setLastContactedDate(new Date());
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const data: Record<string, any> = {
      name: name.trim(),
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      source: source.trim() || null,
      service_interest: serviceInterest.trim() || null,
      status,
      notes: notes.trim() || null,
      next_followup_date: nextFollowupDate ? format(nextFollowupDate, 'yyyy-MM-dd') : null,
      followup_date: status === 'followed_up' && followupDate ? format(followupDate, 'yyyy-MM-dd') : null,
      last_contacted_date: lastContactedDate ? format(lastContactedDate, 'yyyy-MM-dd') : null,
    };

    try {
      if (isEditing && lead) {
        await updateLead.mutateAsync({ id: lead.id, updates: data });
      } else {
        await createLead.mutateAsync(data as any);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutations
    }
  };

  const isSaving = createLead.isPending || updateLead.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update lead information and status.' : 'Add a new sales lead to track.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
            <div className="space-y-4 pb-1">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="lead-name">Name *</Label>
                <Input
                  id="lead-name"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="lead-business">Business Name</Label>
                <Input
                  id="lead-business"
                  placeholder="Acme Corp"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Phone</Label>
                  <Input
                    id="lead-phone"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="john@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Source & Service Interest */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-source">Source</Label>
                  <Input
                    id="lead-source"
                    placeholder="Referral, Website, etc."
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-service">Service Interest</Label>
                  <Input
                    id="lead-service"
                    placeholder="Voice Agent, Automations, etc."
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow-up date when status = followed_up */}
              {status === 'followed_up' && (
                <div className="space-y-2 pl-3 border-l-2 border-blue-500/30">
                  <Label>Follow-up date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !followupDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {followupDate ? format(followupDate, 'MMM d, yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={followupDate}
                        onSelect={setFollowupDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Next Follow-Up Date */}
              <div className="space-y-2">
                <Label>Next Follow-Up Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !nextFollowupDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextFollowupDate ? format(nextFollowupDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextFollowupDate}
                      onSelect={setNextFollowupDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="lead-notes">Notes</Label>
                <Textarea
                  id="lead-notes"
                  placeholder="Add any notes about this lead..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Log Contact button (edit mode only) */}
              {isEditing && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLogContact}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Log Contact
                  </Button>
                  {lastContactedDate && (
                    <span className="text-sm text-muted-foreground">
                      Last contacted: {format(lastContactedDate, 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="gradient-orange text-white shadow-glow-orange"
                  disabled={!name.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : isEditing ? (
                    'Save Changes'
                  ) : (
                    'Add Lead'
                  )}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Client Promotion Confirmation */}
      <AlertDialog open={showClientConfirm} onOpenChange={(open) => {
        if (!open) handleClientConfirmCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move lead to Clients?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new client account for <strong>{name}</strong> and remove them from your leads list. Set a password for their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Label>Client Password *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={clientPassword}
                  onChange={(e) => setClientPassword(e.target.value)}
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
                className="h-10 flex-shrink-0"
                onClick={() => {
                  setClientPassword(generatePassword());
                  setShowPassword(true);
                }}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </div>
            {clientPassword && clientPassword.length < 8 && (
              <p className="text-sm text-destructive">Password must be at least 8 characters</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClientConfirmCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClientConfirm}
              disabled={!clientPassword || clientPassword.length < 8 || createClient.isPending}
              className="gradient-orange text-white"
            >
              {createClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
