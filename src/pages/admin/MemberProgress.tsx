import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Flame, CalendarCheck, Plus } from 'lucide-react';
import { format } from 'date-fns';
import {
  usePod,
  useAllMemberProgress,
  useMarkAttendance,
  useUpdateMemberTier,
} from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const TIER_BADGE: Record<string, string> = {
  basics: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  advanced: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  sparring: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TIER_LABEL: Record<string, string> = {
  basics: 'Basics',
  advanced: 'Advanced',
  sparring: 'Sparring',
};

const CLASS_OPTIONS = [
  'Striking Basics',
  'Advanced Striking',
  'Sparring',
  'Open Mat',
  'Private Lesson',
];

export default function MemberProgress() {
  const { podId } = useParams<{ podId: string }>();
  const navigate = useNavigate();
  const { userWithRole } = useAuth();
  const { data: pod, isLoading: podLoading } = usePod(podId);
  const { data: members, isLoading: membersLoading } = useAllMemberProgress(podId);
  const markAttendance = useMarkAttendance();
  const updateTier = useUpdateMemberTier();

  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [className, setClassName] = useState('Striking Basics');
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isLoading = podLoading || membersLoading;

  const handleMarkAttendance = () => {
    if (!selectedMember || !podId || !userWithRole?.id) return;
    markAttendance.mutate(
      {
        podId,
        userId: selectedMember.user_id,
        className,
        attendedAt: attendanceDate,
        markedBy: userWithRole.id,
      },
      {
        onSuccess: () => {
          setAttendanceDialogOpen(false);
          setSelectedMember(null);
        },
      }
    );
  };

  const handleTierChange = (member: any, tier: string) => {
    updateTier.mutate({ progressId: member.id, tier });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/clients/${podId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" />
            Member Progress
          </h1>
          <p className="text-muted-foreground">{pod?.name} — Striking progression tracker</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <CalendarCheck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-orange-500/10 p-3">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members?.filter((m: any) => m.current_tier === 'advanced').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Advanced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-red-500/10 p-3">
                <Trophy className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members?.filter((m: any) => m.current_tier === 'sparring').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Sparring Eligible</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Members</CardTitle>
        </CardHeader>
        <CardContent>
          {(!members || members.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No members with striking progress yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Mark attendance to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Streak</TableHead>
                    <TableHead>Last Class</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.user_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <span className="font-bold">{member.striking_classes_attended}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={TIER_BADGE[member.current_tier] || TIER_BADGE.basics}>
                            {TIER_LABEL[member.current_tier] || 'Basics'}
                          </Badge>
                          {member.tier_override && (
                            <span className="text-xs text-muted-foreground">(override)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span>{member.current_streak || 0}w</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.last_class_date
                          ? new Date(member.last_class_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Mark Attendance */}
                          <Dialog open={attendanceDialogOpen && selectedMember?.id === member.id} onOpenChange={(open) => {
                            setAttendanceDialogOpen(open);
                            if (open) setSelectedMember(member);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedMember(member)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Attend
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Mark Attendance</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                  <Label>Class</Label>
                                  <Select value={className} onValueChange={setClassName}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CLASS_OPTIONS.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Date</Label>
                                  <Input
                                    type="date"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                  />
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={handleMarkAttendance}
                                  disabled={markAttendance.isPending}
                                >
                                  {markAttendance.isPending ? 'Saving...' : 'Mark Attendance'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Tier Override */}
                          <Select
                            value={member.current_tier}
                            onValueChange={(val) => handleTierChange(member, val)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basics">Basics</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                              <SelectItem value="sparring">Sparring</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
