import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export type Pod = Tables<'pods'>;

export interface AdminLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  service_interest: string | null;
  status: 'cold' | 'warm' | 'hot' | 'followed_up' | 'replied' | 'demo_booked' | 'closed' | 'client' | 'do_not_contact';
  notes: string | null;
  last_contacted_date: string | null;
  next_followup_date: string | null;
  followup_date: string | null;
  date_added: string;
  closed_at: string | null;
  created_at: string;
  drip_active: boolean;
  drip_paused_at: string | null;
  drip_step: number;
}

export interface SmsDripLog {
  id: string;
  lead_id: string;
  step: number;
  sent_at: string;
  message_body: string;
  status: string;
  openphone_message_id: string | null;
  error_message: string | null;
}
export type PodSettings = Tables<'pod_settings'>;
export type CallLog = Tables<'call_logs'>;
export type AutomationLog = Tables<'automation_logs'>;
export type RetellAccount = {
  id: string;
  pod_id: string;
  label: string;
  retell_api_key: string;
  retell_agent_id: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  google_sheet_url: string | null;
};
export type AdminNote = Tables<'admin_notes'>;
export type Profile = Tables<'profiles'>;

export interface PodWithSettings extends Pod {
  pod_settings: PodSettings | null;
  profiles?: Profile | null;
}

// Fetch all pods (admin only)
export function usePods() {
  return useQuery({
    queryKey: ['pods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pods')
        .select(`
          *,
          pod_settings (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PodWithSettings[];
    },
  });
}

// Fetch single pod with all related data
export function usePod(podId: string | undefined) {
  return useQuery({
    queryKey: ['pod', podId],
    queryFn: async () => {
      if (!podId) return null;

      const { data, error } = await supabase
        .from('pods')
        .select(`
          *,
          pod_settings (*)
        `)
        .eq('id', podId)
        .single();

      if (error) throw error;
      return data as PodWithSettings;
    },
    enabled: !!podId,
  });
}

// Fetch user's own pod (for clients)
export function useMyPod() {
  return useQuery({
    queryKey: ['my-pod'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('pods')
        .select(`
          *,
          pod_settings (*)
        `)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PodWithSettings | null;
    },
  });
}

// Fetch profile by user ID
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });
}

// Fetch Retell accounts for a pod
export function useRetellAccounts(podId: string | undefined) {
  return useQuery({
    queryKey: ['retell-accounts', podId],
    queryFn: async () => {
      if (!podId) return [];

      const { data, error } = await supabase
        .from('retell_accounts')
        .select('*')
        .eq('pod_id', podId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as RetellAccount[];
    },
    enabled: !!podId,
  });
}

// Fetch call logs for a pod (simple version with optional limit)
export function useCallLogs(podId: string | undefined, options?: {
  limit?: number;
  status?: string;
  direction?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}) {
  return useQuery({
    queryKey: ['call-logs', podId, options],
    queryFn: async () => {
      if (!podId) return [];

      let query = supabase
        .from('call_logs')
        .select('*')
        .eq('pod_id', podId)
        .order('call_started_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.status && options.status !== 'all') {
        query = query.eq('call_status', options.status as 'completed' | 'failed' | 'missed' | 'voicemail');
      }

      if (options?.direction && options.direction !== 'all') {
        query = query.eq('direction', options.direction as 'inbound' | 'outbound');
      }

      if (options?.startDate) {
        query = query.gte('call_started_at', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('call_started_at', options.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filter by search if provided (client-side for now)
      if (options?.search && data) {
        const searchLower = options.search.toLowerCase();
        return data.filter(call => 
          call.caller_number?.toLowerCase().includes(searchLower) ||
          call.called_number?.toLowerCase().includes(searchLower) ||
          call.transcript?.toLowerCase().includes(searchLower)
        );
      }

      return data as CallLog[];
    },
    enabled: !!podId,
  });
}

// Fetch call logs with pagination (for full history)
export function useCallLogsPaginated(podId: string | undefined, options: {
  page: number;
  pageSize: number;
  status?: string;
  direction?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['call-logs-paginated', podId, options],
    queryFn: async () => {
      if (!podId) return { data: [], count: 0 };

      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;

      let query = supabase
        .from('call_logs')
        .select('*', { count: 'exact' })
        .eq('pod_id', podId)
        .order('call_started_at', { ascending: false })
        .range(from, to);

      if (options.status && options.status !== 'all') {
        query = query.eq('call_status', options.status as 'completed' | 'failed' | 'missed' | 'voicemail');
      }

      if (options.direction && options.direction !== 'all') {
        query = query.eq('direction', options.direction as 'inbound' | 'outbound');
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      // Filter by search if provided (client-side)
      let filteredData = data as CallLog[];
      if (options.search && filteredData) {
        const searchLower = options.search.toLowerCase();
        filteredData = filteredData.filter(call => 
          call.caller_number?.toLowerCase().includes(searchLower) ||
          call.called_number?.toLowerCase().includes(searchLower) ||
          call.transcript?.toLowerCase().includes(searchLower)
        );
      }

      return { data: filteredData, count: count || 0 };
    },
    enabled: !!podId,
    placeholderData: (previousData) => previousData,
  });
}

// Fetch all call logs (admin)
export function useAllCallLogs(options?: { limit?: number }) {
  return useQuery({
    queryKey: ['all-call-logs', options],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select('*, pods(name, company_name)')
        .order('call_started_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

// Fetch automation logs for a pod
export function useAutomationLogs(podId: string | undefined, options?: {
  limit?: number;
  moduleType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ['automation-logs', podId, options],
    queryFn: async () => {
      if (!podId) return [];

      let query = supabase
        .from('automation_logs')
        .select('*')
        .eq('pod_id', podId)
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.moduleType && options.moduleType !== 'all') {
        query = query.eq('module_type', options.moduleType as 'bookings' | 'custom' | 'leads' | 'sms' | 'workflow');
      }

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status as 'failed' | 'pending' | 'success');
      }

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AutomationLog[];
    },
    enabled: !!podId,
  });
}

// Fetch all automation logs (admin)
export function useAllAutomationLogs(options?: { limit?: number }) {
  return useQuery({
    queryKey: ['all-automation-logs', options],
    queryFn: async () => {
      let query = supabase
        .from('automation_logs')
        .select('*, pods(name, company_name)')
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

// Fetch admin notes for a pod
export function useAdminNotes(podId: string | undefined) {
  return useQuery({
    queryKey: ['admin-notes', podId],
    queryFn: async () => {
      if (!podId) return [];

      const { data: notes, error } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('pod_id', podId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!notes || notes.length === 0) return [];

      // Fetch author profiles separately since author_id FK targets auth.users, not profiles
      const authorIds = [...new Set(notes.map(n => n.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return notes.map(note => ({
        ...note,
        profiles: profileMap.get(note.author_id) || null,
      }));
    },
    enabled: !!podId,
  });
}

// Server-side count for a pod's table (accurate, no row limit)
export function usePodCount(podId: string | undefined, table: 'call_logs' | 'automation_logs') {
  return useQuery({
    queryKey: ['pod-count', podId, table],
    queryFn: async () => {
      if (!podId) return 0;
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('pod_id', podId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!podId,
  });
}

// Server-side sum of call duration for a pod (in seconds)
export function usePodTotalMinutes(podId: string | undefined) {
  return useQuery({
    queryKey: ['pod-total-minutes', podId],
    queryFn: async () => {
      if (!podId) return 0;
      // Fetch all duration_seconds values; use pagination to handle >1000 calls
      let total = 0;
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('call_logs')
          .select('duration_seconds')
          .eq('pod_id', podId)
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (data) {
          for (const row of data) {
            total += row.duration_seconds || 0;
          }
          if (data.length < pageSize) hasMore = false;
          else offset += pageSize;
        } else {
          hasMore = false;
        }
      }
      return Math.round(total / 60);
    },
    enabled: !!podId,
  });
}

// Dashboard stats
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [podsResult, callsResult, automationsResult, retellResult] = await Promise.all([
        supabase.from('pods').select('id', { count: 'exact', head: true }),
        supabase.from('call_logs').select('id', { count: 'exact', head: true }),
        supabase.from('automation_logs').select('id', { count: 'exact', head: true }),
        supabase.from('retell_accounts').select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalClients: podsResult.count || 0,
        totalCalls: callsResult.count || 0,
        totalAutomations: automationsResult.count || 0,
        totalRetellAgents: retellResult.count || 0,
      };
    },
  });
}

// Client dashboard stats
export function useClientStats(podId: string | undefined) {
  return useQuery({
    queryKey: ['client-stats', podId],
    queryFn: async () => {
      if (!podId) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [callsResult, missedCallsResult, automationsResult, successAutomationsResult, failedAutomationsResult] = await Promise.all([
        supabase
          .from('call_logs')
          .select('duration_seconds')
          .eq('pod_id', podId)
          .gte('call_started_at', startOfMonth.toISOString()),
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('pod_id', podId)
          .eq('call_status', 'missed')
          .gte('call_started_at', startOfMonth.toISOString()),
        supabase
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('pod_id', podId)
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('pod_id', podId)
          .eq('status', 'success')
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('pod_id', podId)
          .eq('status', 'failed')
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const calls = callsResult.data || [];
      const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const avgDuration = calls.length > 0 ? Math.round(totalDuration / calls.length) : 0;

      return {
        totalCalls: calls.length,
        missedCalls: missedCallsResult.count || 0,
        avgDuration,
        totalAutomations: automationsResult.count || 0,
        successfulAutomations: successAutomationsResult.count || 0,
        failedAutomations: failedAutomationsResult.count || 0,
      };
    },
    enabled: !!podId,
  });
}

// Fetch leads for a pod
export function useLeads(podId: string | undefined, options?: {
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['leads', podId, options],
    queryFn: async () => {
      if (!podId) return [];

      let query = supabase
        .from('leads')
        .select('*')
        .eq('pod_id', podId)
        .order('created_at', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!podId,
  });
}

// Create lead mutation
export function useCreateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      pod_id: string;
      name: string;
      phone?: string;
      email?: string;
      source?: string;
      notes?: string;
      call_log_id?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('leads')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { pod_id }) => {
      queryClient.invalidateQueries({ queryKey: ['leads', pod_id] });
      toast({
        title: 'Lead added',
        description: 'The lead has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update lead mutation
export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, podId, updates }: { id: string; podId: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['leads', podId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete lead mutation
export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, podId }: { id: string; podId: string }) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['leads', podId] });
      toast({
        title: 'Lead deleted',
        description: 'The lead has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch support requests for a pod (or all for admin)
export function useSupportRequests(podId?: string) {
  return useQuery({
    queryKey: ['support-requests', podId],
    queryFn: async () => {
      let query = supabase
        .from('support_requests')
        .select('*, pods(name, company_name)')
        .order('created_at', { ascending: false });

      if (podId) {
        query = query.eq('pod_id', podId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Create support request mutation
export function useCreateSupportRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { pod_id: string; user_id: string; subject: string; message: string }) => {
      const { data: result, error } = await supabase
        .from('support_requests')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { pod_id }) => {
      queryClient.invalidateQueries({ queryKey: ['support-requests', pod_id] });
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast({
        title: 'Request submitted',
        description: 'We\'ll get back to you as soon as possible.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to submit request',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch pod members with profiles
export function usePodMembers(podId: string | undefined) {
  return useQuery({
    queryKey: ['pod-members', podId],
    queryFn: async () => {
      if (!podId) return [];

      const { data, error } = await supabase
        .from('pod_members')
        .select('*, profiles:user_id(full_name, email)')
        .eq('pod_id', podId)
        .order('role', { ascending: true })
        .order('invited_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!podId,
  });
}

// Invite team member mutation
export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ podId, email, fullName }: { podId: string; email: string; fullName?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('invite-team-member', {
        body: { pod_id: podId, email, full_name: fullName },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, { podId }) => {
      queryClient.invalidateQueries({ queryKey: ['pod-members', podId] });
      toast({
        title: 'Member invited',
        description: 'The team member has been added to your workspace.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to invite member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Remove team member mutation
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ memberId, podId }: { memberId: string; podId: string }) => {
      const { error } = await supabase
        .from('pod_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      return { podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['pod-members', podId] });
      toast({
        title: 'Member removed',
        description: 'The team member has been removed from your workspace.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update own profile mutation
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, full_name }: { userId: string; full_name: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update own password mutation
export function useUpdatePassword() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ newPassword }: { newPassword: string }) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update password',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Create client mutation
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      company_name?: string;
      address?: string;
      voice_enabled?: boolean;
      automations_enabled?: boolean;
      website_enabled?: boolean;
      website_url?: string;
      google_sheet_url?: string;
      retell_accounts?: Array<{
        label: string;
        retell_api_key: string;
        retell_agent_id: string;
        google_sheet_url?: string | null;
      }>;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('create-client', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({
        title: 'Client created',
        description: 'The client account has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete client mutation
export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (podId: string) => {
      const { data: result, error } = await supabase.functions.invoke('delete-client', {
        body: { pod_id: podId },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({
        title: 'Client deleted',
        description: 'The client and all their data have been permanently deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Reset client password mutation
export function useResetClientPassword() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data: result, error } = await supabase.functions.invoke('reset-client-password', {
        body: { user_id: userId, new_password: newPassword },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Password reset',
        description: 'The client password has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to reset password',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update pod mutation
export function useUpdatePod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ podId, updates }: { podId: string; updates: Partial<Pod> }) => {
      const { data, error } = await supabase
        .from('pods')
        .update(updates)
        .eq('id', podId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { podId }) => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['pod', podId] });
      toast({
        title: 'Client updated',
        description: 'The client details have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update pod settings mutation
export function useUpdatePodSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ podId, updates }: { podId: string; updates: Partial<PodSettings> }) => {
      const { data, error } = await supabase
        .from('pod_settings')
        .update(updates)
        .eq('pod_id', podId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { podId }) => {
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['pod', podId] });
      queryClient.invalidateQueries({ queryKey: ['my-pod'] });
      toast({
        title: 'Settings updated',
        description: 'The module settings have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Sync Retell calls mutation
export function useSyncRetellCalls() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (podId?: string) => {
      const { data: result, error } = await supabase.functions.invoke('sync-retell-calls', {
        body: podId ? { pod_id: podId } : {},
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result, podId) => {
      if (podId) {
        queryClient.invalidateQueries({ queryKey: ['call-logs', podId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['call-logs'] });
        queryClient.invalidateQueries({ queryKey: ['all-call-logs'] });
      }
      queryClient.invalidateQueries({ queryKey: ['retell-accounts'] });
      toast({
        title: 'Calls synced',
        description: `Synced ${result.calls_synced} new calls, updated ${result.calls_updated} existing calls.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Add admin note mutation
export function useAddAdminNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ podId, content }: { podId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('admin_notes')
        .insert({
          pod_id: podId,
          author_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { podId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes', podId] });
      toast({
        title: 'Note added',
        description: 'Your note has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete admin note mutation
export function useDeleteAdminNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, podId }: { noteId: string; podId: string }) => {
      const { error } = await supabase
        .from('admin_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      return { podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes', podId] });
      toast({
        title: 'Note deleted',
        description: 'The note has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Add retell account mutation
export function useAddRetellAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      pod_id: string;
      label: string;
      retell_api_key: string;
      retell_agent_id: string;
      google_sheet_url?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('retell_accounts')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { pod_id }) => {
      queryClient.invalidateQueries({ queryKey: ['retell-accounts', pod_id] });
      toast({
        title: 'Retell account added',
        description: 'The Retell agent has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add Retell account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update retell account mutation
export function useUpdateRetellAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, podId, updates }: { id: string; podId: string; updates: Partial<RetellAccount> }) => {
      const { data, error } = await supabase
        .from('retell_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['retell-accounts', podId] });
      toast({
        title: 'Retell account updated',
        description: 'The changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update Retell account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch analytics config for a client (admin)
export function useAnalyticsConfig(clientId: string | undefined) {
  return useQuery({
    queryKey: ['analytics-config', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_analytics_config')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

// Fetch cached analytics data for a client
export function useAnalyticsData(clientId: string | undefined, dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['analytics-data', clientId, dateRange],
    queryFn: async () => {
      if (!clientId) return [];

      let query = supabase
        .from('client_analytics_data')
        .select('*')
        .eq('client_id', clientId)
        .order('period_start', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('period_start', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('period_end', dateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

// Sync analytics mutation
export function useSyncAnalytics() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data: result, error } = await supabase.functions.invoke('sync-analytics', {
        body: { client_id: clientId },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['analytics-data', clientId] });
      toast({
        title: 'Analytics synced',
        description: `Synced ${result.metrics_synced} metrics.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update analytics config mutation (admin)
export function useUpdateAnalyticsConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, clientId, updates }: { id: string; clientId: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('client_analytics_config')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, clientId };
    },
    onSuccess: ({ clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['analytics-config', clientId] });
      toast({
        title: 'Analytics config updated',
        description: 'The configuration has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update config',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Create analytics config mutation (admin)
export function useCreateAnalyticsConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { client_id: string; source_type: string; config?: Record<string, any> }) => {
      const { data: result, error } = await supabase
        .from('client_analytics_config')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { client_id }) => {
      queryClient.invalidateQueries({ queryKey: ['analytics-config', client_id] });
      toast({
        title: 'Analytics config created',
        description: 'The analytics source has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create config',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Monthly admin stats (date-filtered)
export function useAdminStatsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['admin-stats-month', month, year],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();

      const [callsResult, automationsResult] = await Promise.all([
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .gte('call_started_at', start)
          .lt('call_started_at', end),
        supabase
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', start)
          .lt('created_at', end),
      ]);

      return {
        totalCalls: callsResult.count || 0,
        totalAutomations: automationsResult.count || 0,
      };
    },
  });
}

// Monthly lead stats
export function useAllLeadStatsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['all-lead-stats-month', month, year],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();

      const [totalResult, newResult, qualifiedResult] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new').gte('created_at', start).lt('created_at', end),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified').gte('created_at', start).lt('created_at', end),
      ]);
      return {
        total: totalResult.count || 0,
        new: newResult.count || 0,
        qualified: qualifiedResult.count || 0,
      };
    },
  });
}

// Monthly support stats
export function useSupportStatsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['support-stats-month', month, year],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();

      const [totalResult, openResult] = await Promise.all([
        supabase.from('support_requests').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
        supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('created_at', start).lt('created_at', end),
      ]);
      return {
        total: totalResult.count || 0,
        open: openResult.count || 0,
      };
    },
  });
}

// Monthly per-pod stats
export function usePerPodStatsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['per-pod-stats-month', month, year],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();

      const { data: pods, error: podsError } = await supabase
        .from('pods')
        .select('id, name, company_name')
        .order('created_at', { ascending: false });

      if (podsError) throw podsError;
      if (!pods) return [];

      const stats = await Promise.all(
        pods.map(async (pod) => {
          const [callsResult, automationsResult, leadsResult] = await Promise.all([
            supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id).gte('call_started_at', start).lt('call_started_at', end),
            supabase.from('automation_logs').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id).gte('created_at', start).lt('created_at', end),
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('pod_id', pod.id).gte('created_at', start).lt('created_at', end),
          ]);
          return {
            podId: pod.id,
            name: pod.company_name || pod.name,
            calls: callsResult.count || 0,
            automations: automationsResult.count || 0,
            leads: leadsResult.count || 0,
          };
        })
      );

      return stats.sort((a, b) => b.calls - a.calls);
    },
  });
}

// Monthly call logs for breakdown
export function useAllCallLogsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['all-call-logs-month', month, year],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();

      const { data, error } = await supabase
        .from('call_logs')
        .select('*, pods(name, company_name)')
        .gte('call_started_at', start)
        .lt('call_started_at', end)
        .order('call_started_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Monthly history summaries (past 12 months)
export function useMonthlyHistorySummaries() {
  return useQuery({
    queryKey: ['monthly-history-summaries'],
    queryFn: async () => {
      const now = new Date();
      const months: { month: number; year: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: d.getMonth(), year: d.getFullYear() });
      }

      const summaries = await Promise.all(
        months.map(async ({ month, year }) => {
          const start = new Date(year, month, 1).toISOString();
          const end = new Date(year, month + 1, 1).toISOString();

          const [callsResult, automationsResult, leadsResult] = await Promise.all([
            supabase.from('call_logs').select('id', { count: 'exact', head: true }).gte('call_started_at', start).lt('call_started_at', end),
            supabase.from('automation_logs').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
            supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
          ]);

          return {
            month,
            year,
            calls: callsResult.count || 0,
            automations: automationsResult.count || 0,
            leads: leadsResult.count || 0,
          };
        })
      );

      return summaries;
    },
  });
}

// Call volume stats (past week / past month with trends)
export function useCallVolumeStats() {
  return useQuery({
    queryKey: ['call-volume-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [thisWeekResult, lastWeekResult, thisMonthResult, lastMonthResult] = await Promise.all([
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .gte('call_started_at', startOfThisWeek.toISOString()),
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .gte('call_started_at', startOfLastWeek.toISOString())
          .lt('call_started_at', startOfThisWeek.toISOString()),
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .gte('call_started_at', startOfThisMonth.toISOString()),
        supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .gte('call_started_at', startOfLastMonth.toISOString())
          .lt('call_started_at', startOfThisMonth.toISOString()),
      ]);

      const thisWeek = thisWeekResult.count || 0;
      const lastWeek = lastWeekResult.count || 0;
      const thisMonth = thisMonthResult.count || 0;
      const lastMonth = lastMonthResult.count || 0;

      const weekTrend = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
      const monthTrend = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

      return {
        thisWeek,
        lastWeek,
        thisMonth,
        lastMonth,
        weekTrend,
        monthTrend,
      };
    },
  });
}

// Per-client monthly stats (for client analytics tab)
export function useClientMonthlyStats(podId: string | undefined, monthCount = 6) {
  return useQuery({
    queryKey: ['client-monthly-stats', podId, monthCount],
    queryFn: async () => {
      if (!podId) return [];

      const now = new Date();
      const months: { month: number; year: number }[] = [];
      for (let i = 0; i < monthCount; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: d.getMonth(), year: d.getFullYear() });
      }

      const summaries = await Promise.all(
        months.map(async ({ month, year }) => {
          const start = new Date(year, month, 1).toISOString();
          const end = new Date(year, month + 1, 1).toISOString();

          const [callsResult, missedCallsResult, minutesResult, automationsResult, leadsResult] = await Promise.all([
            supabase.from('call_logs').select('id', { count: 'exact', head: true })
              .eq('pod_id', podId).gte('call_started_at', start).lt('call_started_at', end),
            supabase.from('call_logs').select('id', { count: 'exact', head: true })
              .eq('pod_id', podId).eq('call_status', 'missed').gte('call_started_at', start).lt('call_started_at', end),
            supabase.from('call_logs').select('duration_seconds')
              .eq('pod_id', podId).gte('call_started_at', start).lt('call_started_at', end),
            supabase.from('automation_logs').select('id', { count: 'exact', head: true })
              .eq('pod_id', podId).gte('created_at', start).lt('created_at', end),
            supabase.from('leads').select('id', { count: 'exact', head: true })
              .eq('pod_id', podId).gte('created_at', start).lt('created_at', end),
          ]);

          const totalMinutes = Math.round(
            (minutesResult.data || []).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60
          );

          return {
            month,
            year,
            calls: callsResult.count || 0,
            missedCalls: missedCallsResult.count || 0,
            totalMinutes,
            automations: automationsResult.count || 0,
            leads: leadsResult.count || 0,
          };
        })
      );

      // Return in chronological order (oldest first)
      return summaries.reverse();
    },
    enabled: !!podId,
  });
}

// Fetch Google Sheet URLs from active Retell accounts for a pod
export function useRetellGoogleSheets(podId: string | undefined) {
  return useQuery({
    queryKey: ['retell-google-sheets', podId],
    queryFn: async () => {
      if (!podId) return [];

      const { data, error } = await supabase
        .from('retell_accounts')
        .select('id, label, google_sheet_url')
        .eq('pod_id', podId)
        .eq('is_active', true)
        .not('google_sheet_url', 'is', null);

      if (error) throw error;
      return data as { id: string; label: string; google_sheet_url: string }[];
    },
    enabled: !!podId,
  });
}

// Delete retell account mutation
export function useDeleteRetellAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, podId }: { id: string; podId: string }) => {
      const { error } = await supabase
        .from('retell_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { podId };
    },
    onSuccess: ({ podId }) => {
      queryClient.invalidateQueries({ queryKey: ['retell-accounts', podId] });
      toast({
        title: 'Retell account deleted',
        description: 'The Retell agent has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete Retell account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// --- Direct Messaging Hooks ---

export type DirectMessage = Tables<'direct_messages'>;

// Get the admin user ID (cached)
export function useAdminUserId() {
  return useQuery({
    queryKey: ['admin-user-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (error) throw error;
      return data.user_id;
    },
    staleTime: Infinity,
  });
}

// Fetch direct messages for a conversation (between current user and another user, in a pod)
export function useDirectMessages(podId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['direct-messages', podId, otherUserId],
    queryFn: async () => {
      if (!podId || !otherUserId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('pod_id', podId)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as DirectMessage[];
    },
    enabled: !!podId && !!otherUserId,
  });
}

// Send a direct message
export function useSendDirectMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      recipient_id: string;
      pod_id: string;
      content: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: result, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          recipient_id: data.recipient_id,
          pod_id: data.pod_id,
          content: data.content,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { pod_id, recipient_id }) => {
      queryClient.invalidateQueries({ queryKey: ['direct-messages', pod_id, recipient_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    },
  });
}

// Get unread message count for current user
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ['unread-message-count'],
    retry: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }
      return count || 0;
    },
  });
}

// Get admin conversations (grouped by pod, with latest message)
export function useAdminConversations() {
  return useQuery({
    queryKey: ['admin-conversations'],
    retry: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch all messages involving admin
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*, pods(name, company_name)')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        throw error;
      }
      if (!messages || messages.length === 0) return [];

      // Group by pod_id, take latest message per pod
      const podMap = new Map<string, any>();
      for (const msg of messages) {
        if (!podMap.has(msg.pod_id)) {
          const unreadCount = messages.filter(
            m => m.pod_id === msg.pod_id && m.recipient_id === user.id && !m.read
          ).length;

          podMap.set(msg.pod_id, {
            podId: msg.pod_id,
            podName: (msg as any).pods?.company_name || (msg as any).pods?.name || 'Unknown',
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount,
            otherUserId: msg.sender_id === user.id ? msg.recipient_id : msg.sender_id,
          });
        }
      }

      return Array.from(podMap.values());
    },
  });
}

// Mark messages as read
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ podId, senderId }: { podId: string; senderId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('direct_messages')
        .update({ read: true })
        .eq('pod_id', podId)
        .eq('sender_id', senderId)
        .eq('recipient_id', user.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    },
  });
}

// Realtime subscription for direct messages
export function useDirectMessageSubscription(podId: string | undefined, onNewMessage?: () => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!podId) return;

    const channel = supabase
      .channel(`direct-messages-${podId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `pod_id=eq.${podId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['direct-messages', podId] });
          queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
          queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
          onNewMessage?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [podId, queryClient, onNewMessage]);
}

// Realtime subscription for unread count (used by NotificationBell)
export function useUnreadMessageSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('direct-messages-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
          queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// --- Admin Leads Hooks ---

// Fetch all admin leads
export function useAdminLeads() {
  return useQuery({
    queryKey: ['admin-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdminLead[];
    },
  });
}

// Create admin lead mutation
export function useCreateAdminLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<AdminLead, 'id' | 'created_at' | 'date_added'> & { date_added?: string }) => {
      const { data: result, error } = await supabase
        .from('admin_leads')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as AdminLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-followups-due'] });
      toast({
        title: 'Lead added',
        description: 'The lead has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update admin lead mutation
export function useUpdateAdminLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdminLead> }) => {
      if (updates.status === 'closed' || updates.status === 'client') {
        updates.closed_at = updates.closed_at ?? new Date().toISOString();
      }
      const { data, error } = await supabase
        .from('admin_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AdminLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-followups-due'] });
      toast({
        title: 'Lead updated',
        description: 'The lead has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete admin lead mutation
export function useDeleteAdminLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-followups-due'] });
      toast({
        title: 'Lead deleted',
        description: 'The lead has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch admin leads with follow-ups due today or overdue
export function useAdminFollowupsDue() {
  return useQuery({
    queryKey: ['admin-followups-due'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('admin_leads')
        .select('*')
        .lte('next_followup_date', today)
        .not('status', 'in', '("closed","client","do_not_contact")')
        .order('next_followup_date', { ascending: true });

      if (error) throw error;
      return data as AdminLead[];
    },
  });
}

// Fetch drip log for a specific lead
export function useLeadDripLog(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-drip-log', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('sms_drip_log')
        .select('*')
        .eq('lead_id', leadId)
        .order('step', { ascending: true });

      if (error) throw error;
      return data as SmsDripLog[];
    },
    enabled: !!leadId,
  });
}

// Toggle drip active/paused for a lead
export function useToggleLeadDrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, drip_active, pause }: { id: string; drip_active?: boolean; pause?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (typeof drip_active === 'boolean') {
        updates.drip_active = drip_active;
        if (drip_active) {
          updates.drip_paused_at = null;
        }
      }
      if (pause === true) {
        updates.drip_paused_at = new Date().toISOString();
      } else if (pause === false) {
        updates.drip_paused_at = null;
      }

      const { data, error } = await supabase
        .from('admin_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AdminLead;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      const action = variables.pause ? 'paused' : variables.drip_active ? 'activated' : 'deactivated';
      toast({
        title: `Drip ${action}`,
        description: `SMS drip campaign has been ${action}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update drip',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch leads with invalid phone numbers (have phone but not valid E.164)
export function useLeadsWithInvalidPhone() {
  return useQuery({
    queryKey: ['leads-invalid-phone'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_leads')
        .select('*')
        .not('phone', 'is', null)
        .not('status', 'in', '("closed","client","do_not_contact")')
        .order('name');

      if (error) throw error;

      // Filter client-side: phone doesn't match 10-digit or 1+10-digit pattern
      return (data as AdminLead[]).filter((lead) => {
        if (!lead.phone) return false;
        const digits = lead.phone.replace(/[^\d]/g, '');
        if (digits.length === 10) return false;
        if (digits.length === 11 && digits.startsWith('1')) return false;
        return true; // invalid
      });
    },
  });
}

// Fetch Zen Planner attendance data from client_analytics_data
export function useZenPlannerAttendance(
  clientId: string | undefined,
  dateRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ['zen-planner-attendance', clientId, dateRange],
    queryFn: async () => {
      if (!clientId) return [];

      let query = supabase
        .from('client_analytics_data')
        .select('*')
        .eq('client_id', clientId)
        .eq('source_type', 'zen_planner')
        .order('period_start', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('period_start', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('period_end', dateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

// ── Website Analytics (page_views table) ──

export interface PageViewStats {
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  devices: { device: string; views: number }[];
  browsers: { browser: string; views: number }[];
  dailyViews: { date: string; views: number; visitors: number }[];
}

export function usePageViewStats(days: number = 30) {
  return useQuery({
    queryKey: ['page-view-stats', days],
    queryFn: async (): Promise<PageViewStats> => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('page_views')
        .select('path, referrer, device, browser, session_id, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];

      const totalViews = rows.length;

      const uniqueSessions = new Set(rows.map((r: any) => r.session_id).filter(Boolean));
      const uniqueVisitors = uniqueSessions.size || totalViews;

      // Top pages
      const pageCounts: Record<string, number> = {};
      for (const r of rows) {
        pageCounts[r.path] = (pageCounts[r.path] || 0) + 1;
      }
      const topPages = Object.entries(pageCounts)
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Top referrers
      const refCounts: Record<string, number> = {};
      for (const r of rows) {
        if (r.referrer) {
          try {
            const host = new URL(r.referrer).hostname.replace(/^www\./, '');
            refCounts[host] = (refCounts[host] || 0) + 1;
          } catch {
            refCounts[r.referrer] = (refCounts[r.referrer] || 0) + 1;
          }
        }
      }
      const topReferrers = Object.entries(refCounts)
        .map(([referrer, views]) => ({ referrer, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Devices
      const deviceCounts: Record<string, number> = {};
      for (const r of rows) {
        const d = r.device || 'unknown';
        deviceCounts[d] = (deviceCounts[d] || 0) + 1;
      }
      const devices = Object.entries(deviceCounts)
        .map(([device, views]) => ({ device, views }))
        .sort((a, b) => b.views - a.views);

      // Browsers
      const browserCounts: Record<string, number> = {};
      for (const r of rows) {
        const b = r.browser || 'unknown';
        browserCounts[b] = (browserCounts[b] || 0) + 1;
      }
      const browsers = Object.entries(browserCounts)
        .map(([browser, views]) => ({ browser, views }))
        .sort((a, b) => b.views - a.views);

      // Daily views
      const dailyMap: Record<string, { views: number; sessions: Set<string> }> = {};
      for (const r of rows) {
        const date = r.created_at.split('T')[0];
        if (!dailyMap[date]) dailyMap[date] = { views: 0, sessions: new Set() };
        dailyMap[date].views++;
        if (r.session_id) dailyMap[date].sessions.add(r.session_id);
      }
      const dailyViews = Object.entries(dailyMap)
        .map(([date, d]) => ({ date, views: d.views, visitors: d.sessions.size || d.views }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalViews, uniqueVisitors, topPages, topReferrers, devices, browsers, dailyViews };
    },
  });
}

export interface SiteEventStats {
  auditStarts: number;
  auditCompletes: number;
  calendlyClicks: number;
  ctaClicks: number;
  avgTimeOnPage: number; // seconds (from heartbeat milestones)
  sectionViews: Record<string, number>;
  conversionRate: number; // audit_complete / unique visitors %
  auditToBooking: number; // calendly_click / audit_complete %
}

export function useSiteEventStats(days: number = 30) {
  return useQuery({
    queryKey: ['site-event-stats', days],
    queryFn: async (): Promise<SiteEventStats> => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('site_events')
        .select('event, metadata, session_id, created_at')
        .gte('created_at', since.toISOString());

      if (error) throw error;
      const rows = data || [];

      const auditStarts = rows.filter(r => r.event === 'audit_start').length;
      const auditCompletes = rows.filter(r => r.event === 'audit_complete').length;
      const calendlyClicks = rows.filter(r => r.event === 'calendly_click').length;
      const ctaClicks = rows.filter(r => r.event === 'cta_click').length;

      // Avg time on page from heartbeat events (take max milestone per session)
      const heartbeats = rows.filter(r => r.event === 'time_on_page');
      const sessionMaxTime: Record<string, number> = {};
      for (const hb of heartbeats) {
        const sid = hb.session_id || 'unknown';
        const seconds = (hb.metadata as any)?.seconds || 0;
        if (!sessionMaxTime[sid] || seconds > sessionMaxTime[sid]) {
          sessionMaxTime[sid] = seconds;
        }
      }
      const timeValues = Object.values(sessionMaxTime);
      const avgTimeOnPage = timeValues.length > 0
        ? Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length)
        : 0;

      // Section views
      const sectionEvents = rows.filter(r => r.event === 'scroll_section');
      const sectionViews: Record<string, number> = {};
      for (const se of sectionEvents) {
        const section = (se.metadata as any)?.section || 'unknown';
        sectionViews[section] = (sectionViews[section] || 0) + 1;
      }

      // Get unique visitors from page_views for conversion rate
      const { data: pvData } = await supabase
        .from('page_views')
        .select('session_id')
        .gte('created_at', since.toISOString());

      const uniqueVisitors = new Set((pvData || []).map((r: any) => r.session_id).filter(Boolean)).size || 1;

      const conversionRate = Math.round((auditCompletes / uniqueVisitors) * 100);
      const auditToBooking = auditCompletes > 0
        ? Math.round((calendlyClicks / auditCompletes) * 100)
        : 0;

      return {
        auditStarts,
        auditCompletes,
        calendlyClicks,
        ctaClicks,
        avgTimeOnPage,
        sectionViews,
        conversionRate,
        auditToBooking,
      };
    },
  });
}
