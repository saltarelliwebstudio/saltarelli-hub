import type { CategorizedTransaction } from '@/hooks/useFinanceData';
import CategorySelect from './CategorySelect';
import { cn } from '@/lib/utils';

interface TransactionTableProps {
  transactions: CategorizedTransaction[];
  account: string;
  onCategoryChange: (index: number, category: string) => void;
  title: string;
  emptyMessage?: string;
}

export default function TransactionTable({
  transactions,
  account,
  onCategoryChange,
  title,
  emptyMessage = 'No transactions',
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-sm font-medium">
          ${total.toFixed(2)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Amount</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground w-40">Category</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/30',
                  t.confidence === 'low' && 'bg-yellow-500/10'
                )}
              >
                <td className="py-2 px-2 whitespace-nowrap">{t.date}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    {t.description}
                    {t.confidence === 'low' && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                        Review
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right whitespace-nowrap font-mono">
                  ${t.amount.toFixed(2)}
                </td>
                <td className="py-2 px-2">
                  <CategorySelect
                    value={t.category}
                    account={account}
                    onChange={(cat) => onCategoryChange(i, cat)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
