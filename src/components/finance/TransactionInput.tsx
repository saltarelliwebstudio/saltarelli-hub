import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';

interface TransactionInputProps {
  onProcess: (rawText: string, account: string) => void;
  isProcessing: boolean;
}

const accountOptions = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'savings', label: 'Savings' },
];

export default function TransactionInput({ onProcess, isProcessing }: TransactionInputProps) {
  const [rawText, setRawText] = useState('');
  const [account, setAccount] = useState('personal');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Paste Transactions
        </CardTitle>
        <CardDescription>
          Paste raw bank statement text below and select the account type. AI will categorize each transaction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account selector */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Account</label>
          <div className="flex gap-2">
            {accountOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAccount(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  account === opt.value
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Raw Transactions</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Paste your bank statement here...\n\nExample:\n03/01 UBER EATS -$24.50\n03/01 E-TRANSFER FROM CLIENT +$500.00\n03/02 SPOTIFY -$11.99`}
            className="w-full min-h-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
          />
        </div>

        <Button
          onClick={() => onProcess(rawText, account)}
          disabled={!rawText.trim() || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing with AI...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Process with AI
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
