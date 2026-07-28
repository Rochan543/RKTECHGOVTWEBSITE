import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useCreateExam,
  useGetExam,
  useUpdateExam,
  useListExamCategories,
  getListExamsQueryKey,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Eye, Archive } from 'lucide-react';
import { Link } from 'wouter';

type ExamType = 'full_mock' | 'mini_mock' | 'topic_test' | 'chapter_test' | 'daily_quiz' | 'weekly_quiz' | 'pyq' | 'sectional';
type ExamStatus = 'draft' | 'published';

interface ExamForm {
  title: string;
  description: string;
  type: ExamType;
  durationMinutes: string;
  totalMarks: string;
  positiveMarks: string;
  negativeMarks: string;
  categoryId: string;
  status: ExamStatus;
}

const defaultForm = (): ExamForm => ({
  title: '',
  description: '',
  type: 'full_mock',
  durationMinutes: '60',
  totalMarks: '100',
  positiveMarks: '2',
  negativeMarks: '0.5',
  categoryId: '',
  status: 'draft',
});

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'full_mock', label: 'Full Mock Test' },
  { value: 'mini_mock', label: 'Mini Mock' },
  { value: 'topic_test', label: 'Topic Test' },
  { value: 'chapter_test', label: 'Chapter Test' },
  { value: 'daily_quiz', label: 'Daily Quiz' },
  { value: 'weekly_quiz', label: 'Weekly Quiz' },
  { value: 'pyq', label: 'Previous Year Questions' },
  { value: 'sectional', label: 'Sectional Test' },
];

export default function AdminExamForm() {
  const params = useParams<{ id?: string }>();
  const examId = params.id ? parseInt(params.id, 10) : null;
  const isEdit = examId !== null && !isNaN(examId);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExamForm>(defaultForm());

  // Load exam data when editing — getGetExamQueryOptions needs a queryKey
  const { data: existingExam, isLoading: examLoading } = useGetExam(
    examId!,
    { query: { enabled: isEdit, queryKey: ['exam', examId] } }
  );

  const { data: categories } = useListExamCategories();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();

  useEffect(() => {
    if (existingExam && isEdit) {
      setForm({
        title: existingExam.title,
        description: existingExam.description ?? '',
        type: existingExam.type as ExamType,
        durationMinutes: String(existingExam.durationMinutes),
        totalMarks: String(existingExam.totalMarks),
        positiveMarks: String(existingExam.positiveMarks ?? 2),
        negativeMarks: String(existingExam.negativeMarks ?? 0.5),
        categoryId: existingExam.categoryId ? String(existingExam.categoryId) : '',
        status: existingExam.status === 'archived' ? 'draft' : existingExam.status as ExamStatus,
      });
    }
  }, [existingExam, isEdit]);

  const handleSave = (statusOverride?: ExamStatus) => {
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      durationMinutes: parseInt(form.durationMinutes) || 60,
      totalMarks: parseFloat(form.totalMarks) || 100,
      positiveMarks: parseFloat(form.positiveMarks) || 2,
      negativeMarks: parseFloat(form.negativeMarks) || 0.5,
      categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      status: statusOverride ?? form.status,
    };

    if (isEdit) {
      updateExam.mutate(
        { id: examId!, data: { title: payload.title, description: payload.description, status: payload.status, durationMinutes: payload.durationMinutes } },
        {
          onSuccess: () => {
            toast({ title: 'Exam updated successfully' });
            queryClient.invalidateQueries({ queryKey: getListExamsQueryKey({}) });
            navigate('/admin/exams');
          },
          onError: (err) => toast({ title: 'Update failed', description: String(err.message), variant: 'destructive' }),
        }
      );
    } else {
      createExam.mutate(
        { data: payload },
        {
          onSuccess: (created) => {
            toast({ title: 'Exam created successfully' });
            queryClient.invalidateQueries({ queryKey: getListExamsQueryKey({}) });
            navigate('/admin/exams');
          },
          onError: (err) => toast({ title: 'Create failed', description: String(err.message), variant: 'destructive' }),
        }
      );
    }
  };

  const isPending = createExam.isPending || updateExam.isPending;

  if (isEdit && examLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/exams"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Exam' : 'Create Exam'}</h1>
          <p className="text-muted-foreground mt-1">{isEdit ? `Editing: ${existingExam?.title ?? ''}` : 'Fill in the details to create a new exam'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Exam Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. SSC CGL Tier-1 Full Mock 2024"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the exam…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Exam Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ExamType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.categoryId || '__none'} onValueChange={v => setForm(f => ({ ...f, categoryId: v === '__none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No Category</SelectItem>
                  {(categories ?? []).map((c: { id: number; name: string }) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exam Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalMarks">Total Marks</Label>
            <Input
              id="totalMarks"
              type="number"
              min="1"
              value={form.totalMarks}
              onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="positiveMarks">Marks per Correct Answer</Label>
            <Input
              id="positiveMarks"
              type="number"
              step="0.25"
              min="0"
              value={form.positiveMarks}
              onChange={e => setForm(f => ({ ...f, positiveMarks: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="negativeMarks">Negative Marks per Wrong Answer</Label>
            <Input
              id="negativeMarks"
              type="number"
              step="0.25"
              min="0"
              value={form.negativeMarks}
              onChange={e => setForm(f => ({ ...f, negativeMarks: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, status: 'draft' }))}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${form.status === 'draft' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
            >
              <Archive className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Draft</p>
                <p className="text-xs text-muted-foreground">Not visible to students</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, status: 'published' }))}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${form.status === 'published' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
            >
              <Eye className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Visible to all students</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" asChild>
          <Link href="/admin/exams">Cancel</Link>
        </Button>
        <Button onClick={() => handleSave()} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {isEdit ? 'Save Changes' : 'Create Exam'}
        </Button>
      </div>
    </div>
  );
}
