import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, User, Shield } from 'lucide-react';

export default function AdminSettings() {
  const { userWithRole } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-accent" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={userWithRole?.full_name || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={userWithRole?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <Button className="gradient-orange text-white">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" />
            </div>
            <Button variant="outline">Update Password</Button>
          </CardContent>
        </Card>

        {/* Admin Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-accent" />
              <CardTitle>Admin Status</CardTitle>
            </div>
            <CardDescription>Your administrative privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="rounded-full bg-accent/10 p-3">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium">Administrator</p>
                <p className="text-sm text-muted-foreground">
                  You have full access to manage all client pods, settings, and billing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
