import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategorizedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  confidence: 'high' | 'low';
  originalLine: string;
}

export interface CategorizeResponse {
  transactions: CategorizedTransaction[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfers: number;
    transactionCount: number;
  };
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expenses: number;
  transfers: number;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface SheetRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: string;
  account: string;
}

export interface AnalyticsResponse {
  rows: SheetRow[];
  monthlyTotals: MonthlyTotal[];
  categoryTotals: CategoryTotal[];
}

export function useCategorizeTransactions() {
  return useMutation({
    mutationFn: async ({ rawText, account }: { rawText: string; account: string }) => {
      const { data, error } = await supabase.functions.invoke('categorize-transactions', {
        body: { rawText, account },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as CategorizeResponse;
    },
  });
}

export function useWriteToSheets() {
  return useMutation({
    mutationFn: async ({
      transactions,
      account,
      month,
    }: {
      transactions: CategorizedTransaction[];
      account: string;
      month: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('write-to-sheets', {
        body: { transactions, account, month },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; rowsWritten: number; tabs: string[] };
    },
  });
}

export function useFinanceAnalytics(months: number = 12) {
  return useQuery({
    queryKey: ['finance-analytics', months],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('read-sheets-data', {
        body: { months },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AnalyticsResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
