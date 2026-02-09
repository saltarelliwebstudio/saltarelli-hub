import { useState } from 'react';
import { UserPlus, Users, Mail, Trash2, Crown, User, Loader2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPod, usePodMembers, useInviteTeamMember, useRemoveTeamMember } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function Team() {
  const { userWithRole } = useAuth();
  const { data: pod, isLoading: podLoading } = useMyPod();
  const { data: members, isLoading: membersLoading } = usePodMembers(pod?.id);
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const isOwner = pod?.owner_id === userWithRole?.id;
  const isLoading = podLoading || membersLoading;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pod) return;

    inviteMember.mutate(
      { podId: pod.id, email: inviteEmail, fullName: inviteName || undefined },
      {
        onSuccess: () => {
          setInviteEmail('');
          setInviteName('');
          setInviteDialogOpen(false);
        },
      }
    );
  };

  const handleRemoveMember = (memberId: string) => {
    if (!pod) return;
    removeMember.mutate({ memberId, podId: pod.id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team members and invitations</p>
        </div>
        {isOwner && (
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
                    <Label htmlFor="invite-name">Full Name</Label>
                    <Input
                      id="invite-name"
                      placeholder="John Smith"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="invite-email"
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
                  <Button
                    type="submit"
                    className="gradient-orange text-white"
                    disabled={inviteMember.isPending}
                  >
                    {inviteMember.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team Members Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Team Members
          </CardTitle>
          <CardDescription>
            {members?.length || 0} member{(members?.length || 0) !== 1 ? 's' : ''} in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No team members yet.</p>
          ) : (
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
                {members.map((member: any) => {
                  const profile = member.profiles;
                  const name = profile?.full_name || profile?.email || 'Unknown';
                  const email = profile?.email || '';

                  return (
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
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-muted-foreground">{email}</p>
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
                        {!member.accepted_at && (
                          <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500/20">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.accepted_at
                          ? format(new Date(member.accepted_at), 'MMM d, yyyy')
                          : 'Invited ' + format(new Date(member.invited_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {member.role !== 'owner' && isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removeMember.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
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
