import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { customFetch } from '@workspace/api-client-react';
import {
  Shield, Users, Activity, Database, Server, AlertCircle,
  CheckCircle2, Clock, Globe, BarChart2, Trash2, UserPlus,
  Search, RefreshCw
} from 'lucide-react';

// ─── API Helpers ───────────────────────────────────────────────────────────────

async function fetchSuperAdmin<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await customFetch(path, opts) as Response;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

function GlobalAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-analytics'],
    queryFn: () => fetchSuperAdmin<any>('/api/v1/super-admin/analytics'),
  });

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><div key={i} className="h-24 rounded-lg bg-muted animate-pulse"/>)}</div>;

  const cards = [
    { label: 'Total Users', value: data?.users?.total ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Active Users', value: data?.users?.active ?? 0, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Admins', value: data?.users?.admins ?? 0, icon: Shield, color: 'text-orange-500' },
    { label: 'Students', value: data?.users?.students ?? 0, icon: Users, color: 'text-purple-500' },
    { label: 'Total Exams', value: data?.content?.exams ?? 0, icon: Database, color: 'text-cyan-500' },
    { label: 'Questions', value: data?.content?.questions ?? 0, icon: BarChart2, color: 'text-yellow-500' },
    { label: 'Sessions', value: data?.activity?.totalSessions ?? 0, icon: Activity, color: 'text-pink-500' },
    { label: 'Avg Accuracy', value: `${data?.activity?.avgAccuracy ?? 0}%`, icon: Globe, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Platform Performance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Score</span><span className="font-bold">{data?.activity?.avgScore ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Accuracy</span><span className="font-bold">{data?.activity?.avgAccuracy ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Results</span><span className="font-bold">{data?.activity?.totalResults ?? 0}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Content Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Exams Published</span><span className="font-bold">{data?.content?.exams ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Questions in Bank</span><span className="font-bold">{data?.content?.questions ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Study Notes</span><span className="font-bold">{data?.content?.notes ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── System Health Panel ───────────────────────────────────────────────────────

function SystemHealth() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['super-admin-health'],
    queryFn: () => fetchSuperAdmin<any>('/api/v1/super-admin/health'),
    refetchInterval: 30_000,
  });

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (isLoading) return <div className="space-y-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 rounded-lg bg-muted animate-pulse"/>)}</div>;

  const mem = data?.memory ?? {};
  const isHealthy = data?.status === 'healthy';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">System Status</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            {isHealthy ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
            <div>
              <p className="font-bold text-lg capitalize">{data?.status ?? 'unknown'}</p>
              <p className="text-sm text-muted-foreground">Last checked: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Server</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Node Version</span><span>{data?.nodeVersion ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span>{data?.uptime != null ? formatUptime(data.uptime) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DB Status</span><Badge variant={data?.database?.status === 'connected' ? 'default' : 'destructive'}>{data?.database?.status ?? '—'}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DB Latency</span><span>{data?.database?.latencyMs != null ? `${data.database.latencyMs}ms` : '—'}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Memory Usage</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Heap Used</span><span>{mem.heapUsed != null ? formatBytes(mem.heapUsed) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Heap Total</span><span>{mem.heapTotal != null ? formatBytes(mem.heapTotal) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">RSS</span><span>{mem.rss != null ? formatBytes(mem.rss) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">External</span><span>{mem.external != null ? formatBytes(mem.external) : '—'}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Audit Logs Panel ─────────────────────────────────────────────────────────

function AuditLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-audit-logs', page],
    queryFn: () => fetchSuperAdmin<any>(`/api/v1/super-admin/audit-logs?page=${page}&limit=20`),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Audit Trail</h3>
        <Badge variant="outline">{total} total entries</Badge>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-muted animate-pulse rounded"/>)}</div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No audit logs yet. Actions performed by admins will appear here.</CardContent></Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{log.userName ?? 'System'}</TableCell>
                  <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                  <TableCell className="text-sm">{log.entity}{log.entityId ? ` #${log.entityId}` : ''}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Admin Management Panel ───────────────────────────────────────────────────

function AdminManagement() {
  const [search, setSearch] = useState('');
  const [promoteEmail, setPromoteEmail] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: admins, isLoading } = useQuery({
    queryKey: ['super-admin-admins'],
    queryFn: () => fetchSuperAdmin<any>('/api/v1/super-admin/admins'),
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => fetchSuperAdmin<any>('/api/v1/users?limit=200'),
  });

  const promoteUser = useMutation({
    mutationFn: (userId: number) =>
      fetchSuperAdmin('/api/v1/super-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      toast({ title: 'User promoted to admin' });
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setPromoteEmail('');
    },
    onError: () => toast({ title: 'Failed to promote user', variant: 'destructive' }),
  });

  const demoteAdmin = useMutation({
    mutationFn: (id: number) =>
      fetchSuperAdmin(`/api/v1/super-admin/admins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Admin role removed' });
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
    },
    onError: () => toast({ title: 'Failed to remove admin role', variant: 'destructive' }),
  });

  const adminList = (admins?.data ?? []).filter((a: any) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  const matchedUser = allUsers?.data?.find((u: any) =>
    u.email.toLowerCase() === promoteEmail.toLowerCase() && u.role === 'student'
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Promote User to Admin</CardTitle>
          <CardDescription>Enter the email of a student to grant them admin access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={promoteEmail}
              onChange={e => setPromoteEmail(e.target.value)}
              className="max-w-sm"
            />
            <Button
              disabled={!matchedUser || promoteUser.isPending}
              onClick={() => matchedUser && promoteUser.mutate(matchedUser.id)}
            >
              {promoteUser.isPending ? 'Promoting...' : 'Promote to Admin'}
            </Button>
          </div>
          {promoteEmail && !matchedUser && (
            <p className="text-xs text-muted-foreground mt-2">No student found with that email</p>
          )}
          {matchedUser && (
            <p className="text-xs text-green-600 mt-2">Found: {matchedUser.name} ({matchedUser.email})</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Current Admins</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search admins..."
              className="pl-9 w-48"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array.from({length:3}).map((_,i)=><div key={i} className="h-14 bg-muted animate-pulse rounded"/>)}</div>
        ) : adminList.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No admins found</CardContent></Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminList.map((admin: any) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                    <TableCell><Badge variant={admin.status === 'active' ? 'default' : 'destructive'}>{admin.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={demoteAdmin.isPending}
                        onClick={() => {
                          if (confirm(`Remove admin role from ${admin.name}?`)) {
                            demoteAdmin.mutate(admin.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Super Admin Portal
        </h1>
        <p className="text-muted-foreground mt-1">System-wide management, analytics, and controls</p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6"><GlobalAnalytics /></TabsContent>
        <TabsContent value="health" className="mt-6"><SystemHealth /></TabsContent>
        <TabsContent value="admins" className="mt-6"><AdminManagement /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditLogs /></TabsContent>
      </Tabs>
    </div>
  );
}
