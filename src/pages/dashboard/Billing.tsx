import { CreditCard, Shield, Banknote, Smartphone, Info, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ACCEPTED_METHODS = [
  { name: 'Visa', icon: '💳' },
  { name: 'Mastercard', icon: '💳' },
  { name: 'American Express', icon: '💳' },
  { name: 'Debit', icon: '💳' },
  { name: 'Apple Pay', icon: '📱' },
  { name: 'Google Pay', icon: '📱' },
  { name: 'Tap to Pay', icon: '📲' },
];

export default function Billing() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Payment information & accepted methods</p>
      </div>

      {/* Hero card */}
      <Card className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent" />
          <CardContent className="relative pt-8 pb-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="rounded-2xl bg-accent/10 p-5 w-fit">
                <CreditCard className="h-10 w-10 text-accent" />
              </div>
              <div className="space-y-2 flex-1">
                <h2 className="text-2xl font-bold">In-Person Payments via Stripe</h2>
                <p className="text-muted-foreground max-w-lg">
                  All payments are handled <strong>in person at the gym</strong> using our secure Stripe terminal. 
                  Quick, easy, and secure — just tap or insert your card at the front desk.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-500">Secure Payments</span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Accepted Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5 text-accent" />
            Accepted Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ACCEPTED_METHODS.map((method) => (
              <div
                key={method.name}
                className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-accent/30 transition-colors"
              >
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <p className="font-medium text-sm">{method.name}</p>
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Accepted
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cash Policy */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-500/10 p-3 h-fit flex-shrink-0">
              <Banknote className="h-5 w-5 text-amber-500" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold flex items-center gap-2">
                Cash Payments
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-xs">
                  By Approval Only
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Cash is <strong>not accepted</strong> as a standard payment method. 
                Exceptions may be made on a case-by-case basis with <strong>direct approval from Head Coach Anthony</strong>. 
                Please speak with him directly if you need to arrange a cash payment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-accent" />
            How Payments Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/30">
              <div className="rounded-full bg-accent/10 w-10 h-10 flex items-center justify-center text-accent font-bold mb-3">
                1
              </div>
              <h4 className="font-semibold text-sm mb-1">Visit the Gym</h4>
              <p className="text-xs text-muted-foreground">
                All payments are processed in person at the front desk
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/30">
              <div className="rounded-full bg-accent/10 w-10 h-10 flex items-center justify-center text-accent font-bold mb-3">
                2
              </div>
              <h4 className="font-semibold text-sm mb-1">Tap, Insert, or Swipe</h4>
              <p className="text-xs text-muted-foreground">
                Use your credit card, debit card, or mobile wallet
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/30">
              <div className="rounded-full bg-accent/10 w-10 h-10 flex items-center justify-center text-accent font-bold mb-3">
                3
              </div>
              <h4 className="font-semibold text-sm mb-1">Instant Receipt</h4>
              <p className="text-xs text-muted-foreground">
                Get a digital receipt via email or text right away
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Future: Square/Stripe integration note */}
      <p className="text-xs text-muted-foreground text-center">
        Powered by Stripe · Online payment portal coming soon
      </p>
    </div>
  );
}
