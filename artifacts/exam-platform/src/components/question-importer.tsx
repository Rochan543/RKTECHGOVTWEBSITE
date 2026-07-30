import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useListSubjects, useListTopics, customFetch } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

export interface ImportedQuestion {
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'integer' | 'numerical';
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string | null;
  hint?: string | null;
  positiveMarks: number;
  negativeMarks: number;
  options: { text: string; isCorrect: boolean }[];
  isValid?: boolean;
  validationError?: string;
}

interface QuestionImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubjectId?: string;
  defaultTopicId?: string;
}

export function QuestionImporter({
  open,
  onOpenChange,
  defaultSubjectId,
  defaultTopicId,
}: QuestionImporterProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selector states
  const [importSubjectId, setImportSubjectId] = useState(defaultSubjectId || '');
  const [importTopicId, setImportTopicId] = useState(defaultTopicId || '');

  // Sync with defaults when they change
  useEffect(() => {
    if (defaultSubjectId) setImportSubjectId(defaultSubjectId);
  }, [defaultSubjectId]);

  useEffect(() => {
    if (defaultTopicId) setImportTopicId(defaultTopicId);
  }, [defaultTopicId]);

  // Import flow states
  const [importPreview, setImportPreview] = useState<ImportedQuestion[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPreviewQuestion, setEditPreviewQuestion] = useState<ImportedQuestion | null>(null);

  const [importReport, setImportReport] = useState<{
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    skippedRecords: string[];
  } | null>(null);

  // Queries
  const { data: subjects } = useListSubjects();
  const { data: importTopics } = useListTopics({
    ...(importSubjectId ? { subjectId: parseInt(importSubjectId) } : {}),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/v1/questions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/stats'] });
  };

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
      onOpenChange(false);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
                <Select
                  value={importSubjectId}
                  onValueChange={v => { setImportSubjectId(v); setImportTopicId(''); }}
                  disabled={!!defaultSubjectId}
                >
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
                <Select
                  value={importTopicId}
                  onValueChange={setImportTopicId}
                  disabled={!importSubjectId || !!defaultTopicId}
                >
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

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".csv,.json,.txt,.pdf,.docx,.xlsx,.xls,image/*"
            />

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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
    </>
  );
}
