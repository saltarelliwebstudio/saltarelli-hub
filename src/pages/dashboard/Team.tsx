import { useState } from 'react';
import { UserPlus, Users, Mail, Trash2, Crown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Mock data
const mockTeamMembers = [
  {
    id: '1',
    email: 'john@acme.com',
    full_name: 'John Smith',
    role: 'owner',
    accepted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
  },
  {
    id: '2',
    email: 'sarah@acme.com',
    full_name: 'Sarah Johnson',
    role: 'member',
    accepted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
  {
    id: '3',
    email: 'mike@acme.com',
    full_name: 'Mike Wilson',
    role: 'member',
    accepted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
];

export default function Team() {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: 'Invitation sent!',
      description: `An invite has been sent to ${inviteEmail}`,
    });

    setInviteEmail('');
    setInviteDialogOpen(false);
    setIsInviting(false);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    toast({
      title: 'Member removed',
      description: `${memberName} has been removed from the team`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team members and invitations</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-orange text-white shadow-glow-orange">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your workspace. They'll receive a magic link via email.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="gradient-orange text-white" disabled={isInviting}>
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Members Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Team Members
          </CardTitle>
          <CardDescription>
            {mockTeamMembers.length} member{mockTeamMembers.length !== 1 ? 's' : ''} in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTeamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {member.role === 'owner' ? (
                          <Crown className="h-5 w-5 text-accent" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={member.role === 'owner' ? 'bg-accent/10 text-accent border-accent/20' : ''}
                    >
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(member.accepted_at, 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id, member.full_name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="rounded-full bg-accent/10 p-3 h-fit">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">About Team Access</h4>
              <p className="text-sm text-muted-foreground">
                Team members can view your call logs, automation events, and billing information but cannot make changes. 
                Only the account owner can modify settings, manage team members, and update billing details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
