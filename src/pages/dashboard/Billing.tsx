import { ExternalLink, CreditCard, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Mock data
const mockSubscription = {
  plan_name: 'Voice Agent - Premium',
  amount: 299,
  billing_cycle: 'monthly',
  status: 'active',
  current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
};

const mockInvoices = [
  {
    id: '1',
    invoice_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    amount: 299,
    status: 'paid',
    invoice_url: 'https://stripe.com/invoice/1',
  },
  {
    id: '2',
    invoice_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    amount: 299,
    status: 'paid',
    invoice_url: 'https://stripe.com/invoice/2',
  },
  {
    id: '3',
    invoice_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
    amount: 299,
    status: 'paid',
    invoice_url: 'https://stripe.com/invoice/3',
  },
  {
    id: '4',
    invoice_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
    amount: 249,
    status: 'paid',
    invoice_url: 'https://stripe.com/invoice/4',
  },
];

const statusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  past_due: 'bg-warning/10 text-warning border-warning/20',
  canceled: 'bg-destructive/10 text-destructive border-destructive/20',
  trialing: 'bg-accent/10 text-accent border-accent/20',
  paid: 'bg-success/10 text-success border-success/20',
  open: 'bg-warning/10 text-warning border-warning/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function Billing() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and view invoice history</p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{mockSubscription.plan_name}</h3>
                <Badge
                  variant="outline"
                  className={cn('capitalize', statusStyles[mockSubscription.status])}
                >
                  {mockSubscription.status}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-xl font-semibold text-gradient-orange">
                    ${mockSubscription.amount}/{mockSubscription.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Payment</p>
                  <p className="text-lg font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(mockSubscription.current_period_end, 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>

            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Update Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Invoice History
          </CardTitle>
          <CardDescription>View and download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <p className="text-muted-foreground">No invoices yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                mockInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {format(invoice.invoice_date, 'MMMM d, yyyy')}
                    </TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusStyles[invoice.status])}
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(invoice.invoice_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
