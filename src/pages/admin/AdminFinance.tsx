import { useState } from 'react';
import { Wallet, ClipboardEdit, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useCategorizeTransactions,
  useWriteToSheets,
  type CategorizedTransaction,
  type CategorizeResponse,
} from '@/hooks/useFinanceData';
import TransactionInput from '@/components/finance/TransactionInput';
import TransactionConfirmation from '@/components/finance/TransactionConfirmation';
import FinanceAnalytics from '@/components/finance/FinanceAnalytics';
import { cn } from '@/lib/utils';

type Tab = 'input' | 'analytics';
type InputStep = 'paste' | 'confirm';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminFinance() {
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [inputStep, setInputStep] = useState<InputStep>('paste');
  const [categorizedData, setCategorizedData] = useState<CategorizeResponse | null>(null);
  const [currentAccount, setCurrentAccount] = useState('personal');
  const { toast } = useToast();

  const categorize = useCategorizeTransactions();
  const writeToSheets = useWriteToSheets();

  const handleProcess = (rawText: string, account: string) => {
    setCurrentAccount(account);
    categorize.mutate(
      { rawText, account },
      {
        onSuccess: (data) => {
          setCategorizedData(data);
          setInputStep('confirm');
          toast({
            title: 'Transactions categorized',
            description: `${data.transactions.length} transactions processed`,
          });
        },
        onError: (error) => {
          toast({
            title: 'Categorization failed',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleApprove = (transactions: CategorizedTransaction[]) => {
    // Determine month from first transaction date
    const firstDate = transactions[0]?.date;
    let month = `${SHORT_MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
    if (firstDate) {
      const d = new Date(firstDate);
      if (!isNaN(d.getTime())) {
        month = `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    writeToSheets.mutate(
      { transactions, account: currentAccount, month },
      {
        onSuccess: (data) => {
          toast({
            title: 'Written to Google Sheets',
            description: `${data.rowsWritten} rows added to ${data.tabs.join(' & ')}`,
          });
          // Reset to paste step
          setInputStep('paste');
          setCategorizedData(null);
        },
        onError: (error) => {
          toast({
            title: 'Write failed',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const tabs = [
    { key: 'input' as Tab, label: 'Input', icon: ClipboardEdit },
    { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-8 w-8 text-accent" />
          Finance Tracker
        </h1>
        <p className="text-muted-foreground">AI-powered transaction categorization & analytics</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'input' && (
        <>
          {inputStep === 'paste' && (
            <TransactionInput
              onProcess={handleProcess}
              isProcessing={categorize.isPending}
            />
          )}
          {inputStep === 'confirm' && categorizedData && (
            <TransactionConfirmation
              data={categorizedData}
              account={currentAccount}
              onApprove={handleApprove}
              onBack={() => {
                setInputStep('paste');
                setCategorizedData(null);
              }}
              isWriting={writeToSheets.isPending}
            />
          )}
        </>
      )}

      {activeTab === 'analytics' && <FinanceAnalytics />}
    </div>
  );
}
