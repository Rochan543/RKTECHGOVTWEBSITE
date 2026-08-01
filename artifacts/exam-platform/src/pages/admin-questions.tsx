import { useState, useRef } from 'react';
import { QuestionImporter } from '@/components/question-importer';
import {
  useListQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion,
  useListSubjects, useListTopics, customFetch,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, Loader2, ChevronLeft, ChevronRight, Upload, FileText, X, CheckCircle2 } from 'lucide-react';

// ─── Import helpers ────────────────────────────────────────────────────────────

interface ImportedQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation?: string;
  hint?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'integer' | 'numerical';
  positiveMarks: number;
  negativeMarks: number;
  isValid?: boolean;
  validationError?: string;
}

const DIFFICULTY_COLORS = { easy: 'secondary', medium: 'outline', hard: 'destructive' } as const;

interface QuestionForm {
  text: string;
  type: string;
  difficulty: string;
  explanation: string;
  hint: string;
  positiveMarks: string;
  negativeMarks: string;
  subjectId: string;
  topicId: string;
  options: { text: string; isCorrect: boolean }[];
}

const defaultForm = (): QuestionForm => ({
  text: '', type: 'single_choice', difficulty: 'medium',
  explanation: '', hint: '', positiveMarks: '1', negativeMarks: '0.25',
  subjectId: '', topicId: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});

export default function AdminQuestions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestionForm>(defaultForm());

  // Import state
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useListQuestions({
    page, limit: 20,
    ...(search && { search }),
    ...(subjectFilter && { subjectId: parseInt(subjectFilter) }),
    ...(diffFilter && { difficulty: diffFilter as 'easy' | 'medium' | 'hard' }),
  });
  const { data: subjects } = useListSubjects();
  const { data: topics } = useListTopics({ ...(form.subjectId ? { subjectId: parseInt(form.subjectId) } : {}) });

  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const remove = useDeleteQuestion();

  const questions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/v1/questions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/stats'] });
  };

  const openCreate = () => { setForm(defaultForm()); setEditId(null); setDialogOpen(true); };
  const openEdit = (q: { id: number; text: string; type: string; difficulty: string; explanation: string | null; hint: string | null; positiveMarks: number; negativeMarks: number; subjectId: number; topicId: number; options: { id: number; text: string; isCorrect: boolean }[] }) => {
    setForm({
      text: q.text, type: q.type, difficulty: q.difficulty,
      explanation: q.explanation ?? '', hint: q.hint ?? '',
      positiveMarks: String(q.positiveMarks), negativeMarks: String(q.negativeMarks),
      subjectId: String(q.subjectId), topicId: String(q.topicId),
      options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
    });
    setEditId(q.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.text.trim() || !form.subjectId || !form.topicId) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (form.options.filter(o => o.text.trim()).length < 2) {
      toast({ title: 'Please add at least 2 options', variant: 'destructive' });
      return;
    }
    if (!form.options.some(o => o.isCorrect && o.text.trim())) {
      toast({ title: 'Please mark at least one correct option', variant: 'destructive' });
      return;
    }
    const payload = {
      text: form.text, type: form.type as 'single_choice', difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
      explanation: form.explanation || null, hint: form.hint || null,
      positiveMarks: parseFloat(form.positiveMarks) || 1,
      negativeMarks: parseFloat(form.negativeMarks) || 0,
      subjectId: parseInt(form.subjectId), topicId: parseInt(form.topicId),
      options: form.options.filter(o => o.text.trim()),
    };
    if (editId) {
      update.mutate({ id: editId, data: payload }, {
        onSuccess: () => { toast({ title: 'Question updated' }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: 'Question created' }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this question?')) return;
    remove.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Question deleted' }); invalidate(); },
      onError: (err: any) => {
        if (err.status === 409) {
          toast({
            title: "Cannot delete question",
            description: "This question cannot be deleted because it has been used in student practice or exam sessions.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to delete question",
            description: err.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground mt-1">{total} questions total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />Import
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Question</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search questions…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        <Select value={subjectFilter || 'all'} onValueChange={v => { setSubjectFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {(subjects ?? []).map((s: { id: number; name: string }) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={diffFilter || 'all'} onValueChange={v => { setDiffFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="w-28">Subject</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead className="w-20">Marks</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((__, j) => <TableCell key={j}><div className="h-5 bg-muted rounded animate-pulse" /></TableCell>)}
                  </TableRow>
                ))
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No questions found</TableCell>
                </TableRow>
              ) : questions.map((q: { id: number; text: string; subjectName?: string | null; difficulty: string; positiveMarks: number; negativeMarks: number; options?: { id: number; text: string; isCorrect: boolean }[]; type: string; explanation?: string | null; hint?: string | null; subjectId: number; topicId?: number | null; topicName?: string | null }) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-md">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{q.text}</p>
                      {q.options && q.options.length > 0 && (
                        <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted text-xs text-muted-foreground">
                          {q.options.map((opt, idx) => (
                            <div key={idx} className={`flex items-start gap-1 ${opt.isCorrect ? 'text-green-600 dark:text-green-400 font-semibold' : ''}`}>
                              <span>{String.fromCharCode(65 + idx)}.</span>
                              <span>{opt.text}</span>
                              {opt.isCorrect && <CheckCircle2 className="h-3 w-3 inline text-green-600 dark:text-green-400 ml-1 self-center" />}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Type: {q.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <span className="font-semibold block">{q.subjectName ?? '—'}</span>
                      {q.topicName && <span className="text-[10px] text-muted-foreground block mt-0.5">{q.topicName}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={DIFFICULTY_COLORS[q.difficulty as keyof typeof DIFFICULTY_COLORS] ?? 'outline'} className="text-xs capitalize">
                      {q.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="space-y-0.5">
                      <span className="text-green-600 dark:text-green-400 block font-semibold">+{q.positiveMarks}</span>
                      <span className="text-destructive block font-semibold">-{q.negativeMarks}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit({ ...q, explanation: q.explanation ?? null, hint: q.hint ?? null, topicId: q.topicId ?? 0, options: q.options ?? [] })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Question' : 'New Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Question Text *</Label>
              <Textarea rows={3} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Enter the question…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v, topicId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s: { id: number; name: string }) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Topic *</Label>
                <Select value={form.topicId} onValueChange={v => setForm(f => ({ ...f, topicId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>
                    {(topics ?? []).map((t: { id: number; name: string }) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_choice">Single Choice</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                    <SelectItem value="integer">Integer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Positive Marks</Label>
                <Input type="number" step="0.25" value={form.positiveMarks} onChange={e => setForm(f => ({ ...f, positiveMarks: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Negative Marks</Label>
                <Input type="number" step="0.25" value={form.negativeMarks} onChange={e => setForm(f => ({ ...f, negativeMarks: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Options (check = correct answer)</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, isCorrect: e.target.checked } : o) }))}
                    className="accent-primary h-4 w-4 flex-shrink-0"
                  />
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt.text}
                    onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) }))}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Explanation (optional)</Label>
              <Textarea rows={2} value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Why is this the correct answer?" />
            </div>
            <div className="space-y-1.5">
              <Label>Hint (optional)</Label>
              <Input value={form.hint} onChange={e => setForm(f => ({ ...f, hint: e.target.value }))} placeholder="A helpful hint for students" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? 'Save Changes' : 'Create Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionImporter
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
