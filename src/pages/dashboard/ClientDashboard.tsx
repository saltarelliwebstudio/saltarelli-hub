import { Phone, Clock, PhoneMissed, Zap, CheckCircle, XCircle, CreditCard, Calendar } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { ActivityFeed, ActivityItem } from '@/components/ui/activity-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

// Mock data - will be replaced with real data
const mockPodSettings = {
  voice_enabled: true,
  automations_enabled: true,
  billing_enabled: true,
};

const mockVoiceStats = {
  totalCalls: 156,
  avgDuration: '2m 34s',
  missedCalls: 12,
};

const mockAutomationStats = {
  totalEvents: 423,
  successful: 398,
  failed: 25,
};

const mockBillingInfo = {
  planName: 'Voice Agent - Premium',
  nextPayment: 'Feb 15, 2026',
  amount: '$299/mo',
};

const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'call',
    title: 'Inbound call completed',
    description: '3m 42s • (555) 123-4567',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: '2',
    type: 'automation',
    title: 'Lead captured from website',
    description: 'john@example.com',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
  },
  {
    id: '3',
    type: 'automation',
    title: 'SMS notification sent',
    description: 'Appointment reminder',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: '4',
    type: 'call',
    title: 'Missed call',
    description: '(555) 987-6543',
    status: 'failed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
];

export default function ClientDashboard() {
  const { userWithRole } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, <span className="text-gradient-orange">{userWithRole?.full_name?.split(' ')[0] || 'there'}</span>
        </h1>
        <p className="text-muted-foreground">Here's what's happening with your account today</p>
      </div>

      {/* Voice Stats */}
      {mockPodSettings.voice_enabled && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            Voice Agent
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Calls This Month"
              value={mockVoiceStats.totalCalls}
              icon={Phone}
              trend={{ value: 8, isPositive: true }}
            />
            <StatCard
              title="Average Duration"
              value={mockVoiceStats.avgDuration}
              icon={Clock}
            />
            <StatCard
              title="Missed Calls"
              value={mockVoiceStats.missedCalls}
              icon={PhoneMissed}
              variant={mockVoiceStats.missedCalls > 10 ? 'warning' : 'default'}
            />
          </div>
        </div>
      )}

      {/* Automation Stats */}
      {mockPodSettings.automations_enabled && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Automations
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Events This Month"
              value={mockAutomationStats.totalEvents}
              icon={Zap}
              trend={{ value: 23, isPositive: true }}
            />
            <StatCard
              title="Successful Runs"
              value={mockAutomationStats.successful}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Failed Runs"
              value={mockAutomationStats.failed}
              icon={XCircle}
              variant={mockAutomationStats.failed > 20 ? 'destructive' : 'default'}
            />
          </div>
        </div>
      )}

      {/* Billing Summary */}
      {mockPodSettings.billing_enabled && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent" />
            Billing
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-xl font-semibold">{mockBillingInfo.planName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Next Payment</p>
                  <p className="text-xl font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {mockBillingInfo.nextPayment}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-xl font-semibold text-gradient-orange">{mockBillingInfo.amount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest events and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={mockActivity} />
        </CardContent>
      </Card>
    </div>
  );
}
