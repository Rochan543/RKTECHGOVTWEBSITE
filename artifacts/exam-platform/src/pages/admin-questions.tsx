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
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importTopicId, setImportTopicId] = useState('');
  const [importPreview, setImportPreview] = useState<ImportedQuestion[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [importReport, setImportReport] = useState<{
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    skippedRecords: string[];
  } | null>(null);

  // Edit preview index
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPreviewQuestion, setEditPreviewQuestion] = useState<ImportedQuestion | null>(null);
  
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
      const validQuestions = questions.filter(q => q.isValid !== false);
      if (validQuestions.length === 0) throw new Error('No valid questions to import');

      const batchSize = 100;
      let totalCreated = 0;

      for (let i = 0; i < validQuestions.length; i += batchSize) {
        const batch = validQuestions.slice(i, i + batchSize);
        const payload = batch.map(q => ({
          text: q.text,
          type: q.type,
          difficulty: q.difficulty,
          explanation: q.explanation ?? null,
          hint: q.hint ?? null,
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
        }) as any;

        totalCreated += res.created || 0;
      }
      return { created: totalCreated };
    },
    onSuccess: (data: { created: number }) => {
      toast({ title: `Imported ${data.created} questions successfully` });
      invalidate();
      setImportOpen(false);
      setImportPreview([]);
      setImportFileName('');
      setImportReport(null);
    },
    onError: (err: any) => toast({ title: 'Import failed', description: String(err.message || err), variant: 'destructive' }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setIsParsing(true);
    setImportReport(null);
    setImportPreview([]);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string;
        const base64Content = raw.split(',')[1] || raw;

        const report = await customFetch('/api/v1/questions/import/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'text/plain',
            fileData: base64Content,
          }),
        }) as any;

        setImportPreview(report.questions || []);
        setImportReport({
          totalRecords: report.totalRecords || 0,
          validRecords: report.validRecords || 0,
          invalidRecords: report.invalidRecords || 0,
          skippedRecords: report.skippedRecords || [],
        });
        toast({ title: 'File parsed successfully', description: `${report.questions?.length || 0} questions found.` });
      } catch (err: any) {
        toast({ title: 'Parsing failed', description: err.message || String(err), variant: 'destructive' });
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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
      <input ref={fileInputRef} type="file" accept=".csv,.json,.txt,.pdf,.docx,.xlsx,.xls,image/*" className="hidden" onChange={handleFileSelect} />

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

      {/* ── Import Dialog ────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Upload a CSV, JSON, TXT, PDF, DOCX, Excel, or scanned image. All imported questions will be assigned to the selected subject and topic.
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
                  <p className="text-xs text-muted-foreground mt-1">CSV, JSON, TXT, PDF, DOCX, Excel, or scanned image</p>
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

            {/* Loading parsing */}
            {isParsing && (
              <div className="flex flex-col items-center justify-center p-6 bg-muted/20 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm font-medium">Parsing document & running OCR...</p>
              </div>
            )}

            {/* Preview Summary */}
            {importReport && (
              <div className="grid grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg text-center text-xs">
                <div>
                  <p className="text-muted-foreground font-semibold">Total Parsed</p>
                  <p className="text-lg font-bold">{importReport.totalRecords}</p>
                </div>
                <div>
                  <p className="text-green-600 font-semibold">Valid</p>
                  <p className="text-lg font-bold text-green-600">{importPreview.filter(q => q.isValid !== false).length}</p>
                </div>
                <div>
                  <p className="text-destructive font-semibold">Invalid</p>
                  <p className="text-lg font-bold text-destructive">{importPreview.filter(q => q.isValid === false).length}</p>
                </div>
                <div>
                  <p className="text-amber-600 font-semibold font-bold">Warnings</p>
                  <p className="text-lg font-bold text-amber-600">{importReport.skippedRecords.length}</p>
                </div>
              </div>
            )}

            {/* Preview List */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Question Preview List</span>
                  <span className="text-xs text-muted-foreground">Click edit to fix invalid records</span>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {importPreview.map((q, i) => (
                    <div key={i} className="p-3 text-sm flex items-start justify-between gap-4 hover:bg-muted/10">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-muted-foreground">#{i + 1}</span>
                          <span className="capitalize text-xs font-semibold px-2 py-0.5 bg-secondary text-secondary-foreground rounded">
                            {q.type.replace('_', ' ')}
                          </span>
                          {q.isValid !== false ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Valid</Badge>
                          ) : (
                            <Badge variant="destructive" title={q.validationError} className="cursor-help">
                              Error: {q.validationError || "Invalid"}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium mt-1 line-clamp-2">{q.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {q.options.length} options · Difficulty: {q.difficulty} · Marks: +{q.positiveMarks}/-{q.negativeMarks}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline" size="sm" className="h-8 px-2"
                          onClick={() => {
                            setEditingIndex(i);
                            setEditPreviewQuestion({ ...q });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const updated = importPreview.filter((_, idx) => idx !== i);
                            setImportPreview(updated);
                            toast({ title: 'Removed question from preview' });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped Report / OCR Errors list */}
            {importReport && importReport.skippedRecords.length > 0 && (
              <div className="space-y-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-800 dark:text-red-300">Heuristics Import Report (Warnings):</p>
                <div className="max-h-24 overflow-y-auto divide-y divide-red-100 dark:divide-red-900/40 text-[10px] text-red-700 dark:text-red-400">
                  {importReport.skippedRecords.map((msg, i) => (
                    <p key={i} className="py-1">{msg}</p>
                  ))}
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

      {/* ── Edit Preview Question Dialog ────────────────────────── */}
      <Dialog open={editingIndex !== null} onOpenChange={(open) => { if (!open) setEditingIndex(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Parsed Question</DialogTitle>
            <DialogDescription>
              Correct any parsing errors before importing.
            </DialogDescription>
          </DialogHeader>

          {editPreviewQuestion && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Question Text *</Label>
                <Textarea
                  value={editPreviewQuestion.text}
                  onChange={e => setEditPreviewQuestion({ ...editPreviewQuestion, text: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select value={editPreviewQuestion.difficulty} onValueChange={v => setEditPreviewQuestion({ ...editPreviewQuestion, difficulty: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Question Type</Label>
                  <Select value={editPreviewQuestion.type} onValueChange={v => setEditPreviewQuestion({ ...editPreviewQuestion, type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_choice">Single Choice</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                      <SelectItem value="numerical">Numerical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Positive Marks</Label>
                  <Input
                    type="number" step="0.25"
                    value={editPreviewQuestion.positiveMarks}
                    onChange={e => setEditPreviewQuestion({ ...editPreviewQuestion, positiveMarks: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Negative Marks</Label>
                  <Input
                    type="number" step="0.25"
                    value={editPreviewQuestion.negativeMarks}
                    onChange={e => setEditPreviewQuestion({ ...editPreviewQuestion, negativeMarks: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                {editPreviewQuestion.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={editPreviewQuestion.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                      name="preview_correct"
                      checked={opt.isCorrect}
                      onChange={e => {
                        const isChecked = e.target.checked;
                        const newOpts = editPreviewQuestion.options.map((o, j) => {
                          if (i === j) return { ...o, isCorrect: isChecked };
                          return editPreviewQuestion.type === 'multiple_choice' ? o : { ...o, isCorrect: false };
                        });
                        setEditPreviewQuestion({ ...editPreviewQuestion, options: newOpts });
                      }}
                      className="h-4 w-4 text-primary"
                    />
                    <Input
                      value={opt.text}
                      onChange={e => {
                        const newOpts = editPreviewQuestion.options.map((o, j) => i === j ? { ...o, text: e.target.value } : o);
                        setEditPreviewQuestion({ ...editPreviewQuestion, options: newOpts });
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Explanation (optional)</Label>
                <Textarea
                  value={editPreviewQuestion.explanation || ''}
                  onChange={e => setEditPreviewQuestion({ ...editPreviewQuestion, explanation: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIndex(null)}>Cancel</Button>
            <Button onClick={() => {
              if (editingIndex !== null && editPreviewQuestion) {
                const q = editPreviewQuestion;
                const hasCorrect = q.options.some(o => o.isCorrect);
                const hasText = q.text.trim().length > 0;
                const isValid = hasText && (q.type === 'integer' || q.type === 'numerical' || (q.options.length >= 2 && hasCorrect));
                const validationError = !hasText ? "Missing question text" : !hasCorrect ? "Missing correct answer designation" : q.options.length < 2 ? "At least 2 options required" : "";

                const updated = [...importPreview];
                updated[editingIndex] = { ...q, isValid, validationError };
                setImportPreview(updated);
                setEditingIndex(null);
                toast({ title: "Question updated locally" });
              }
            }}>
              Save Preview Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
