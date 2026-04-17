import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { GraduationCap, Download, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface WorkshopSignup {
  id: string;
  created_at: string;
  name: string;
  email: string;
  workshop_name: string;
  workshop_date: string | null;
  source: string;
  attended: boolean;
  notes: string | null;
}

export default function AdminWorkshopSignups() {
  const [signups, setSignups] = useState<WorkshopSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workshop_signups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Failed to load workshop signups',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSignups((data ?? []) as WorkshopSignup[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAttended = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('workshop_signups')
      .update({ attended: !current })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setSignups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attended: !current } : s))
    );
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this signup? This cannot be undone.')) return;
    const { error } = await supabase
      .from('workshop_signups')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setSignups((prev) => prev.filter((s) => s.id !== id));
  };

  const exportCsv = () => {
    if (!signups.length) return;
    const headers = ['Signed up', 'Name', 'Email', 'Workshop', 'Date', 'Source', 'Attended'];
    const rows = signups.map((s) => [
      s.created_at,
      s.name,
      s.email,
      s.workshop_name,
      s.workshop_date ?? '',
      s.source,
      s.attended ? 'yes' : 'no',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-signups-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const attendedCount = signups.filter((s) => s.attended).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Workshop Signups</h1>
          </div>
          <p className="text-muted-foreground">
            Registrations from the workshop page on saltarelliwebstudio.ca. Separate
            from leads so you can run the session list without noise.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!signups.length}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Total signups
          </p>
          <p className="text-2xl font-bold">{signups.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Marked attended
          </p>
          <p className="text-2xl font-bold">{attendedCount}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">Here</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Workshop</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[56px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : signups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No workshop signups yet. They'll show up here as soon as someone
                  fills out the form on saltarelliwebstudio.ca/workshop.
                </TableCell>
              </TableRow>
            ) : (
              signups.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleAttended(s.id, s.attended)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label={s.attended ? 'Mark absent' : 'Mark attended'}
                    >
                      {s.attended ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <a
                      href={`mailto:${s.email}`}
                      className="text-primary hover:underline"
                    >
                      {s.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{s.workshop_name}</span>
                      {s.workshop_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(s.workshop_date + 'T00:00:00'), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(s.created_at), 'MMM d, h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {s.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s.id)}
                      aria-label="Delete signup"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
