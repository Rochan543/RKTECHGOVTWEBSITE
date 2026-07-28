import { useState } from 'react';
import {
  useListExams,
  getListExamsQueryKey,
  useDeleteExam,
  useUpdateExam,
} from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit, Trash2, MoreHorizontal, Eye, Archive, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateExam } from '@workspace/api-client-react';

export default function AdminExams() {
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Admins need to see all exams regardless of status
  const { data: examsResp, isLoading } = useListExams(
    { limit: 200 },
    { query: { queryKey: getListExamsQueryKey({ limit: 200 }), refetchInterval: 30_000 } }
  );

  const deleteExam = useDeleteExam();
  const updateExam = useUpdateExam();
  const createExam = useCreateExam();

  const exams = examsResp?.data || [];
  const filtered = exams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListExamsQueryKey({ limit: 200 }) });

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deleteExam.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Exam deleted' }); invalidate(); },
      onError: (err) => toast({ title: 'Delete failed', description: (err.data as { error?: string })?.error, variant: 'destructive' }),
    });
  };

  const handleStatusChange = (id: number, status: 'draft' | 'published' | 'archived') => {
    updateExam.mutate(
      { id, data: { status } },
      {
        onSuccess: () => { toast({ title: `Exam ${status}` }); invalidate(); },
        onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
      }
    );
  };

  const handleDuplicate = (exam: typeof exams[0]) => {
    createExam.mutate(
      {
        data: {
          title: `${exam.title} (Copy)`,
          description: exam.description ?? null,
          type: exam.type,
          durationMinutes: exam.durationMinutes,
          totalMarks: exam.totalMarks,
          positiveMarks: exam.positiveMarks ?? 2,
          negativeMarks: exam.negativeMarks ?? 0.5,
          categoryId: exam.categoryId ?? null,
          status: 'draft',
        },
      },
      {
        onSuccess: () => { toast({ title: 'Exam duplicated as draft' }); invalidate(); },
        onError: () => toast({ title: 'Duplicate failed', variant: 'destructive' }),
      }
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge>Published</Badge>;
    if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Exams</h1>
          <p className="text-muted-foreground mt-1">Create and manage test series. ({filtered.length} total)</p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/new">
            <Plus className="mr-2 h-4 w-4" /> Create Exam
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exams..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Duration (min)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {search ? 'No matching exams found.' : 'No exams yet. Create your first exam.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{exam.categoryName || '—'}</TableCell>
                  <TableCell className="capitalize text-sm">{exam.type.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{statusBadge(exam.status)}</TableCell>
                  <TableCell className="text-right text-sm">{exam.totalQuestions}</TableCell>
                  <TableCell className="text-right text-sm">{exam.durationMinutes}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/admin/exams/${exam.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        {exam.status !== 'published' && (
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleStatusChange(exam.id, 'published')}>
                            <Eye className="mr-2 h-4 w-4" /> Publish
                          </DropdownMenuItem>
                        )}
                        {exam.status === 'published' && (
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleStatusChange(exam.id, 'draft')}>
                            <Archive className="mr-2 h-4 w-4" /> Move to Draft
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleDuplicate(exam)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => handleDelete(exam.id, exam.title)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
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
    </div>
  );
}
