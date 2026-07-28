import { useState } from 'react';
import { useListExams, getListExamsQueryKey, useDeleteExam } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminExams() {
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: examsResp, isLoading } = useListExams({ limit: 100 }, {
    query: { queryKey: getListExamsQueryKey({ limit: 100 }) }
  });

  const deleteExam = useDeleteExam();

  const exams = examsResp?.data || [];
  const filtered = exams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    deleteExam.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Exam deleted' });
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey({ limit: 100 }) });
      },
      onError: (err) => toast({ title: 'Error', description: err.error, variant: 'destructive' })
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Exams</h1>
          <p className="text-muted-foreground mt-1">Create and manage test series.</p>
        </div>
        <Button asChild>
          {/* Real app would go to /admin/exams/new, but let's just make it a placeholder link for now, or build it */}
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
                 <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
               </TableRow>
            ) : filtered.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={7} className="h-24 text-center">No exams found.</TableCell>
               </TableRow>
            ) : (
              filtered.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell>{exam.categoryName || '-'}</TableCell>
                  <TableCell className="capitalize">{exam.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={exam.status === 'published' ? 'default' : exam.status === 'draft' ? 'secondary' : 'outline'}>
                      {exam.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{exam.totalQuestions}</TableCell>
                  <TableCell className="text-right">{exam.durationMinutes}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(exam.id)}>
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
