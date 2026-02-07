import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export type Pod = Tables<'pods'>;
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

      const { data, error } = await supabase
        .from('admin_notes')
        .select('*, profiles:author_id(full_name, email)')
        .eq('pod_id', podId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
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

// Dashboard stats
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [podsResult, callsResult, automationsResult] = await Promise.all([
        supabase.from('pods').select('id', { count: 'exact', head: true }),
        supabase.from('call_logs').select('id', { count: 'exact', head: true }),
        supabase.from('automation_logs').select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalClients: podsResult.count || 0,
        totalCalls: callsResult.count || 0,
        totalAutomations: automationsResult.count || 0,
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
