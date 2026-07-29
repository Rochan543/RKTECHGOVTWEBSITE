import { useState } from 'react';
import { useListUsers, useUpdateUser, customFetch } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Users, Loader2, Shield, UserCheck } from 'lucide-react';

const ROLE_COLORS = { student: 'secondary', admin: 'default', super_admin: 'destructive' } as const;
const STATUS_COLORS = { active: 'secondary', suspended: 'destructive' } as const;

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editUser, setEditUser] = useState<{ id: number; name: string; email: string; role: string; status: string } | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'sessions' | 'violations'>('details');

  const { data, isLoading } = useListUsers({
    page, limit: 20,
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter as 'student' | 'admin' | 'super_admin' }),
    ...(statusFilter && { status: statusFilter as 'active' | 'suspended' }),
  });
  const updateUser = useUpdateUser();

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const openEdit = (u: { id: number; name: string; email: string; role: string; status: string }) => {
    setEditUser(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setActiveTab('details');
    setSessions([]);
    setViolations([]);

    customFetch(`/api/v1/users/${u.id}/sessions`)
      .then((res: any) => {
        if (Array.isArray(res)) setSessions(res);
      })
      .catch(err => console.error(err));

    customFetch(`/api/v1/users/${u.id}/violations`)
      .then((res: any) => {
        if (Array.isArray(res)) setViolations(res);
      })
      .catch(err => console.error(err));
  };

  const handleSave = () => {
    if (!editUser) return;
    updateUser.mutate(
      { id: editUser.id, data: { role: editRole as 'student' | 'admin' | 'super_admin', status: editStatus as 'active' | 'suspended' } },
      {
        onSuccess: () => {
          toast({ title: 'User updated' });
          setEditUser(null);
          queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
        },
        onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">{total} total users</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{users.filter((u: { status: string }) => u.status === 'active').length} active on this page</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        <Select value={roleFilter || 'all'} onValueChange={v => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-28">Role</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">Rank / Score</TableHead>
                <TableHead className="w-36">Joined</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((__, j) => <TableCell key={j}><div className="h-5 bg-muted rounded animate-pulse" /></TableCell>)}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No users found</TableCell>
                </TableRow>
              ) : users.map((u: { id: number; name: string; email: string; role: string; status: string; rank?: number | null; totalScore?: number | null; createdAt: string }) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_COLORS[u.role as keyof typeof ROLE_COLORS] ?? 'secondary'} className="text-xs capitalize">
                      {u.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[u.status as keyof typeof STATUS_COLORS] ?? 'secondary'} className="text-xs capitalize">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.rank ? `#${u.rank}` : '—'} / {u.totalScore ? Math.round(u.totalScore) : '0'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(u)}>
                      <Shield className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} ({total} users)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Edit Role/Status Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" /> Edit User — {editUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
          <div className="flex border-b mb-4">
            <button
              className={`flex-1 py-2 text-center text-sm font-medium border-b-2 transition-all ${activeTab === 'details' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              className={`flex-1 py-2 text-center text-sm font-medium border-b-2 transition-all ${activeTab === 'sessions' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('sessions')}
            >
              Sessions Log ({sessions.length})
            </button>
            <button
              className={`flex-1 py-2 text-center text-sm font-medium border-b-2 transition-all ${activeTab === 'violations' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('violations')}
            >
              Violations ({violations.length})
            </button>
          </div>

          {activeTab === 'details' && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{editUser?.email}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Role</label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="max-h-[400px] overflow-y-auto space-y-3 py-2 pr-1">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No test sessions recorded for this user.</p>
              ) : (
                sessions.map((s: any) => {
                  const durationMin = s.timeTakenSeconds != null ? Math.round(s.timeTakenSeconds / 60) : null;
                  const unanswered = s.answersTotal != null && s.answersAnswered != null ? s.answersTotal - s.answersAnswered : 0;
                  return (
                    <div key={s.id} className="p-3 bg-muted/40 rounded-lg border text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground text-sm">{s.examTitle}</span>
                        <Badge variant={s.status === 'submitted' || s.status === 'auto_submitted' ? 'secondary' : 'default'} className="scale-90 capitalize">
                          {s.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground border-t border-muted/30 pt-2 font-medium">
                        <div><span className="text-muted-foreground font-normal">User:</span> {s.userName ?? '—'}</div>
                        <div><span className="text-muted-foreground font-normal">Duration:</span> {durationMin != null ? `${durationMin} mins` : '—'}</div>
                        <div><span className="text-muted-foreground font-normal">Score:</span> {s.score != null ? `${Math.round(s.score)} / ${s.totalMarks ?? '—'}` : '—'}</div>
                        <div><span className="text-muted-foreground font-normal">Accuracy:</span> {s.accuracy != null ? `${Math.round(s.accuracy)}%` : '—'}</div>
                        <div><span className="text-muted-foreground font-normal">Questions:</span> {s.answersTotal ?? 0} total</div>
                        <div><span className="text-muted-foreground font-normal">Answered:</span> {s.answersAnswered ?? 0} (Unanswered: {unanswered})</div>
                        <div><span className="text-muted-foreground font-normal">Started:</span> {new Date(s.startedAt).toLocaleString()}</div>
                        <div>
                          <span className="text-muted-foreground font-normal">
                            {s.status === 'submitted' || s.status === 'auto_submitted' ? 'Submitted:' : 'Updated:'}
                          </span>{' '}
                          {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'violations' && (
            <div className="max-h-[400px] overflow-y-auto space-y-3 py-2 pr-1">
              {violations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No anti-cheat violations recorded.</p>
              ) : (
                violations.map((v: any) => {
                  const severityColors: Record<string, string> = {
                    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                  };
                  return (
                    <div key={v.id} className="p-3 bg-red-50 dark:bg-red-950/10 rounded-lg border border-red-200 dark:border-red-900/30 text-xs space-y-2">
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-red-700 dark:text-red-400 capitalize text-sm">{v.type.replace('_', ' ')}</span>
                        <Badge className={`scale-90 border-0 ${severityColors[v.severity] ?? 'bg-muted text-muted-foreground'}`}>
                          {v.severity ?? 'low'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{v.description}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground border-t border-red-200/30 dark:border-red-900/30 pt-2 font-medium">
                        <div><span className="text-muted-foreground font-normal">User:</span> {v.userName ?? '—'}</div>
                        <div><span className="text-muted-foreground font-normal">Session ID:</span> #{v.sessionId}</div>
                        <div><span className="text-muted-foreground font-normal">Exam:</span> {v.examTitle}</div>
                        <div><span className="text-muted-foreground font-normal">Violations:</span> {v.count ?? 1} total</div>
                        <div className="col-span-2"><span className="text-muted-foreground font-normal">Timestamp:</span> {new Date(v.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
