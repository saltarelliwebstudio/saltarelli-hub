import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, Zap, CreditCard, MoreVertical, Building2 } from 'lucide-react';
import { CreateClientModal } from '@/components/admin/CreateClientModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Mock data
const mockClients = [
  {
    id: '1',
    name: 'John Smith',
    company: 'Acme Corporation',
    status: 'active',
    modules: ['voice', 'automations', 'billing'],
    paymentStatus: 'active',
    lastActivity: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    company: 'Tech Solutions LLC',
    status: 'active',
    modules: ['voice', 'automations'],
    paymentStatus: 'active',
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: '3',
    name: 'Mike Wilson',
    company: 'StartUp Inc',
    status: 'active',
    modules: ['automations', 'billing'],
    paymentStatus: 'past_due',
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: '4',
    name: 'Emily Brown',
    company: 'Design Studio',
    status: 'inactive',
    modules: ['voice'],
    paymentStatus: 'canceled',
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
];

const paymentStatusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  past_due: 'bg-warning/10 text-warning border-warning/20',
  canceled: 'bg-destructive/10 text-destructive border-destructive/20',
  none: 'bg-muted text-muted-foreground border-muted',
};

export default function ClientsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const filteredClients = mockClients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <TableHead>Payment</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No clients found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/clients/${client.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.company}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={client.status === 'active' ? 'default' : 'secondary'}
                      className={client.status === 'active' ? 'bg-success/10 text-success border-success/20' : ''}
                    >
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {client.modules.includes('voice') && (
                        <div className="rounded-md bg-muted p-1.5" title="Voice">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {client.modules.includes('automations') && (
                        <div className="rounded-md bg-muted p-1.5" title="Automations">
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {client.modules.includes('billing') && (
                        <div className="rounded-md bg-muted p-1.5" title="Billing">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('capitalize', paymentStatusStyles[client.paymentStatus] || paymentStatusStyles.none)}
                    >
                      {client.paymentStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(client.lastActivity, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/clients/${client.id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit Client</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
        onSuccess={() => {
          // TODO: Refetch clients from database
        }}
      />
    </div>
  );
}
