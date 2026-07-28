import { useState, useRef } from 'react';
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
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'single_choice';
  positiveMarks: number;
  negativeMarks: number;
}

function parseCSV(raw: string): ImportedQuestion[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.toLowerCase().trim());
  const qIdx = header.indexOf('question') >= 0 ? header.indexOf('question') : 0;
  const aIdx = header.indexOf('a') >= 0 ? header.indexOf('a') : 1;
  const bIdx = header.indexOf('b') >= 0 ? header.indexOf('b') : 2;
  const cIdx = header.indexOf('c') >= 0 ? header.indexOf('c') : 3;
  const dIdx = header.indexOf('d') >= 0 ? header.indexOf('d') : 4;
  const ansIdx = header.findIndex(h => h === 'answer' || h === 'correct' || h === 'ans');
  const expIdx = header.findIndex(h => h === 'explanation' || h === 'explain');

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const correctLetter = ansIdx >= 0 ? cols[ansIdx]?.toLowerCase() ?? 'a' : 'a';
    const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
    const correctIdx = letterMap[correctLetter] ?? 0;
    const opts = [cols[aIdx] ?? '', cols[bIdx] ?? '', cols[cIdx] ?? '', cols[dIdx] ?? '']
      .filter(Boolean)
      .map((text, i) => ({ text, isCorrect: i === correctIdx }));
    return {
      text: cols[qIdx] ?? '',
      options: opts.length ? opts : [{ text: 'Option A', isCorrect: true }, { text: 'Option B', isCorrect: false }],
      explanation: expIdx >= 0 ? cols[expIdx] : undefined,
      difficulty: 'medium' as const,
      type: 'single_choice' as const,
      positiveMarks: 1,
      negativeMarks: 0.25,
    };
  }).filter(q => q.text);
}

function parseTXT(raw: string): ImportedQuestion[] {
  const blocks = raw.split(/\n\s*\n/).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const qLine = lines.find(l => /^(Q\.|Q:|Question:|[0-9]+[\.\)])/i.test(l)) ?? lines[0];
    const text = qLine?.replace(/^(Q\.|Q:|Question:|[0-9]+[\.\)])\s*/i, '').trim() ?? '';
    const optionLines = lines.filter(l => /^[A-D][.\)]\s/i.test(l));
    const answerLine = lines.find(l => /^(Answer|Ans|Correct)[:\s]/i.test(l));
    const correctLetter = answerLine?.match(/[A-D]/i)?.[0]?.toLowerCase() ?? 'a';
    const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
    const correctIdx = letterMap[correctLetter] ?? 0;
    const options = optionLines.length
      ? optionLines.map((l, i) => ({ text: l.replace(/^[A-D][.\)]\s/i, '').trim(), isCorrect: i === correctIdx }))
      : [{ text: 'Option A', isCorrect: true }, { text: 'Option B', isCorrect: false }];
    return { text, options, difficulty: 'medium' as const, type: 'single_choice' as const, positiveMarks: 1, negativeMarks: 0.25 };
  }).filter(q => q.text);
}

function parseJSON(raw: string): ImportedQuestion[] {
  try {
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : data.questions ?? [];
    return arr.map((q: Record<string, unknown>) => ({
      text: String(q.text ?? q.question ?? ''),
      options: Array.isArray(q.options) ? q.options : [{ text: 'Option A', isCorrect: true }, { text: 'Option B', isCorrect: false }],
      explanation: q.explanation ? String(q.explanation) : undefined,
      difficulty: (['easy', 'medium', 'hard'].includes(String(q.difficulty)) ? q.difficulty : 'medium') as 'easy' | 'medium' | 'hard',
      type: 'single_choice' as const,
      positiveMarks: Number(q.positiveMarks ?? 1),
      negativeMarks: Number(q.negativeMarks ?? 0.25),
    })).filter((q: ImportedQuestion) => q.text);
  } catch { return []; }
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
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importTopicId, setImportTopicId] = useState('');
  const [importPreview, setImportPreview] = useState<ImportedQuestion[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useListQuestions({
    page, limit: 20,
    ...(search && { search }),
    ...(subjectFilter && { subjectId: parseInt(subjectFilter) }),
    ...(diffFilter && { difficulty: diffFilter as 'easy' | 'medium' | 'hard' }),
  });
  const { data: subjects } = useListSubjects();
  const { data: topics } = useListTopics({ ...(form.subjectId ? { subjectId: parseInt(form.subjectId) } : {}) });
  const { data: importTopics } = useListTopics({ ...(importSubjectId ? { subjectId: parseInt(importSubjectId) } : {}) });

  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const remove = useDeleteQuestion();

  const bulkImport = useMutation({
    mutationFn: async (questions: ImportedQuestion[]) => {
      if (!importSubjectId || !importTopicId) throw new Error('Subject and topic required');
      const payload = questions.map(q => ({
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        explanation: q.explanation ?? null,
        hint: null,
        positiveMarks: q.positiveMarks,
        negativeMarks: q.negativeMarks,
        subjectId: parseInt(importSubjectId),
        topicId: parseInt(importTopicId),
        options: q.options,
      }));
      const res = await customFetch('/api/v1/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }) as Response;
      if (!res.ok) throw new Error('Bulk import failed');
      return res.json();
    },
    onSuccess: (data: { created: number }) => {
      toast({ title: `Imported ${data.created} questions successfully` });
      invalidate();
      setImportOpen(false);
      setImportPreview([]);
      setImportFileName('');
    },
    onError: (err) => toast({ title: 'Import failed', description: String(err.message), variant: 'destructive' }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      let parsed: ImportedQuestion[] = [];
      if (file.name.endsWith('.csv')) parsed = parseCSV(raw);
      else if (file.name.endsWith('.json')) parsed = parseJSON(raw);
      else parsed = parseTXT(raw); // .txt and everything else
      if (parsed.length === 0) {
        toast({ title: 'No questions parsed', description: 'Check the file format and try again.', variant: 'destructive' });
      } else {
        setImportPreview(parsed);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const questions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['questions'] });

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
          <Button variant="outline" onClick={() => { setImportPreview([]); setImportFileName(''); setImportSubjectId(''); setImportTopicId(''); setImportOpen(true); }}>
            <Upload className="h-4 w-4 mr-2" />Import
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Question</Button>
        </div>
      </div>
      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept=".csv,.json,.txt" className="hidden" onChange={handleFileSelect} />

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
                  <TableCell className="max-w-xs">
                    <p className="text-sm line-clamp-2">{q.text}</p>
                  </TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{q.subjectName ?? '—'}</span></TableCell>
                  <TableCell>
                    <Badge variant={DIFFICULTY_COLORS[q.difficulty as keyof typeof DIFFICULTY_COLORS] ?? 'outline'} className="text-xs capitalize">
                      {q.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">+{q.positiveMarks} / -{q.negativeMarks}</TableCell>
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

      {/* ── Import Dialog ────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Upload a CSV, JSON, or TXT file. All imported questions will be assigned to the selected subject and topic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Subject / Topic selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Select value={importSubjectId} onValueChange={v => { setImportSubjectId(v); setImportTopicId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s: { id: number; name: string }) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Topic *</Label>
                <Select value={importTopicId} onValueChange={setImportTopicId} disabled={!importSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>
                    {(importTopics ?? []).map((t: { id: number; name: string }) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* File upload area */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {importFileName ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="font-medium">{importFileName}</span>
                  <Button
                    variant="ghost" size="sm"
                    onClick={e => { e.stopPropagation(); setImportPreview([]); setImportFileName(''); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload file</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, JSON, or TXT</p>
                </>
              )}
            </div>

            {/* Format guide */}
            {!importPreview.length && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-foreground">Supported formats:</p>
                <p><strong>CSV</strong>: question, a, b, c, d, answer, explanation — header row required</p>
                <p><strong>JSON</strong>: array of objects with <code>text</code>, <code>options</code>, <code>difficulty</code></p>
                <p><strong>TXT</strong>: Q. Question text / A. option / B. option… / Answer: A</p>
              </div>
            )}

            {/* Preview */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{importPreview.length} questions ready to import</span>
                </div>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {importPreview.slice(0, 10).map((q, i) => (
                    <div key={i} className="p-3 text-sm">
                      <p className="font-medium line-clamp-1">{i + 1}. {q.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{q.options.length} options · {q.difficulty}</p>
                    </div>
                  ))}
                  {importPreview.length > 10 && (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      + {importPreview.length - 10} more questions…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              disabled={!importPreview.length || !importSubjectId || !importTopicId || bulkImport.isPending}
              onClick={() => bulkImport.mutate(importPreview)}
            >
              {bulkImport.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import {importPreview.length > 0 ? `${importPreview.length} Questions` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
