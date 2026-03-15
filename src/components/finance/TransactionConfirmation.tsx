import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import type { CategorizedTransaction, CategorizeResponse } from '@/hooks/useFinanceData';
import TransactionTable from './TransactionTable';

interface TransactionConfirmationProps {
  data: CategorizeResponse;
  account: string;
  onApprove: (transactions: CategorizedTransaction[]) => void;
  onBack: () => void;
  isWriting: boolean;
}

export default function TransactionConfirmation({
  data,
  account,
  onApprove,
  onBack,
  isWriting,
}: TransactionConfirmationProps) {
  const [transactions, setTransactions] = useState<CategorizedTransaction[]>(data.transactions);

  const handleCategoryChange = (globalIndex: number, category: string) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === globalIndex ? { ...t, category } : t))
    );
  };

  const income = transactions.filter((t) => t.type === 'income');
  const expenses = transactions.filter((t) => t.type === 'expense');
  const transfers = transactions.filter((t) => t.type === 'transfer');

  // Map filtered indices back to global indices
  const getGlobalIndex = (type: string, localIndex: number): number => {
    let count = 0;
    for (let i = 0; i < transactions.length; i++) {
      if (transactions[i].type === type) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  };

  const lowConfidenceCount = transactions.filter((t) => t.confidence === 'low').length;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Categorized Transactions</CardTitle>
              <CardDescription>
                {transactions.length} transactions found
                {lowConfidenceCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                    ({lowConfidenceCount} need review)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="text-right text-sm space-y-1">
              <div className="text-green-500">Income: ${data.summary.totalIncome.toFixed(2)}</div>
              <div className="text-red-500">Expenses: ${data.summary.totalExpenses.toFixed(2)}</div>
              {data.summary.totalTransfers > 0 && (
                <div className="text-muted-foreground">Transfers: ${data.summary.totalTransfers.toFixed(2)}</div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Income table */}
      {income.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <TransactionTable
              transactions={income}
              account={account}
              onCategoryChange={(localIdx, cat) => handleCategoryChange(getGlobalIndex('income', localIdx), cat)}
              title="Income"
            />
          </CardContent>
        </Card>
      )}

      {/* Expenses table */}
      {expenses.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <TransactionTable
              transactions={expenses}
              account={account}
              onCategoryChange={(localIdx, cat) => handleCategoryChange(getGlobalIndex('expense', localIdx), cat)}
              title="Expenses"
            />
          </CardContent>
        </Card>
      )}

      {/* Transfers table */}
      {transfers.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <TransactionTable
              transactions={transfers}
              account={account}
              onCategoryChange={(localIdx, cat) => handleCategoryChange(getGlobalIndex('transfer', localIdx), cat)}
              title="Internal Transfers"
            />
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isWriting}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => onApprove(transactions)}
          disabled={isWriting}
          className="flex-1"
          size="lg"
        >
          {isWriting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Writing to Google Sheets...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Approve & Write to Sheets
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
