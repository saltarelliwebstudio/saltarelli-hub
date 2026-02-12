import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, Zap, Monitor, MoreVertical, Building2, Trash2 } from 'lucide-react';
import { CreateClientModal } from '@/components/admin/CreateClientModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { usePods, useDeleteClient } from '@/hooks/useSupabaseData';

export default function ClientsList() {
  const navigate = useNavigate();
  const { data: pods, isLoading, error } = usePods();
  const deleteClient = useDeleteClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [podToDelete, setPodToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredPods = pods?.filter(
    (pod) =>
      pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDeleteClick = (e: React.MouseEvent, pod: { id: string; name: string }) => {
    e.stopPropagation();
    setPodToDelete(pod);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (podToDelete) {
      await deleteClient.mutateAsync(podToDelete.id);
      setDeleteDialogOpen(false);
      setPodToDelete(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Failed to load clients</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client pods and workspaces</p>
        </div>
        <Button 
          className="gradient-orange text-white shadow-glow-orange"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredPods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No clients match your search' : 'No clients yet. Click "Create Client" to add your first one.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPods.map((pod) => (
                <TableRow
                  key={pod.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/clients/${pod.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{pod.name}</p>
                      <p className="text-sm text-muted-foreground">{pod.company_name || pod.contact_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="default"
                      className="bg-success/10 text-success border-success/20"
                    >
                      active
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {pod.pod_settings?.voice_enabled && (
                        <div className="rounded-md bg-muted p-1.5" title="Voice">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {pod.pod_settings?.automations_enabled && (
                        <div className="rounded-md bg-muted p-1.5" title="Automations">
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {pod.pod_settings?.website_enabled && (
                        <div className="rounded-md bg-muted p-1.5" title="Website">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {!pod.pod_settings?.voice_enabled && !pod.pod_settings?.automations_enabled && !pod.pod_settings?.website_enabled && (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(pod.updated_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/clients/${pod.id}`);
                        }}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => handleDeleteClick(e, { id: pod.id, name: pod.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Client Modal */}
      <CreateClientModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{podToDelete?.name}</strong> and all their data including call logs, automation events, and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? 'Deleting...' : 'Delete Client'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
