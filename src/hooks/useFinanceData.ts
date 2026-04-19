import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategorizedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  paymentMethod: 'debit' | 'credit' | 'cash' | 'e-transfer' | 'other';
  taxDeductible: boolean;
  notes: string;
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
  paymentMethod: string;
  taxDeductible: boolean;
  notes: string;
}

export interface AnalyticsResponse {
  rows: SheetRow[];
  monthlyTotals: MonthlyTotal[];
  categoryTotals: CategoryTotal[];
}

// Split raw text into chunks of ~20 transactions to avoid edge function timeouts
function splitTransactionText(rawText: string, maxPerChunk = 20): string[] {
  // Split on date patterns (e.g. "Mar 29, 2026") that start a new transaction
  const lines = rawText.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let txCount = 0;

  for (const line of lines) {
    // Detect start of a new transaction (date line like "Mar 29, 2026" or "03/29/2026")
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/.test(line.trim()) ||
        /^\d{2}\/\d{2}\/\d{4}/.test(line.trim())) {
      if (txCount >= maxPerChunk && current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
        txCount = 0;
      }
      txCount++;
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

export function useCategorizeTransactions() {
  return useMutation({
    mutationFn: async ({ rawText, account }: { rawText: string; account: string }) => {
      const chunks = splitTransactionText(rawText);

      const allTransactions: CategorizedTransaction[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('categorize-transactions', {
          body: { rawText: chunk, account },
        });
        if (error) {
          const body = await error.context?.text?.().catch(() => '');
          throw new Error(body || error.message);
        }
        if (data?.error) throw new Error(data.error);
        allTransactions.push(...data.transactions);
      }

      // Build combined summary
      const summary = {
        totalIncome: allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        totalExpenses: allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        totalTransfers: allTransactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
        transactionCount: allTransactions.length,
      };

      return { transactions: allTransactions, summary } as CategorizeResponse;
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
