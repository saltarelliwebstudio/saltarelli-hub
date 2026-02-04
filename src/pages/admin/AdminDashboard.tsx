import { Users, Phone, Zap, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { ActivityFeed, ActivityItem } from '@/components/ui/activity-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data - will be replaced with real data
const mockStats = {
  totalClients: 24,
  totalCalls: 1842,
  totalAutomations: 5621,
  paymentIssues: 2,
};

const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'call',
    title: 'Inbound call completed',
    description: '3m 42s • (555) 123-4567',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    podName: 'Acme Corp',
  },
  {
    id: '2',
    type: 'automation',
    title: 'Lead captured from website',
    description: 'john@example.com',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
    podName: 'Tech Solutions',
  },
  {
    id: '3',
    type: 'payment',
    title: 'Payment failed',
    description: 'Invoice #1234',
    status: 'failed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    podName: 'StartUp Inc',
  },
  {
    id: '4',
    type: 'call',
    title: 'Missed call',
    description: '(555) 987-6543',
    status: 'failed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    podName: 'Design Studio',
  },
  {
    id: '5',
    type: 'automation',
    title: 'SMS notification sent',
    description: 'Appointment reminder',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    podName: 'Acme Corp',
  },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all client activity and system status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={mockStats.totalClients}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Calls"
          value={mockStats.totalCalls.toLocaleString()}
          icon={Phone}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Automation Events"
          value={mockStats.totalAutomations.toLocaleString()}
          icon={Zap}
          trend={{ value: 23, isPositive: true }}
        />
        <StatCard
          title="Payment Issues"
          value={mockStats.paymentIssues}
          icon={AlertTriangle}
          variant={mockStats.paymentIssues > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events across all client pods</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={mockActivity} showPodName />
        </CardContent>
      </Card>
    </div>
  );
}
