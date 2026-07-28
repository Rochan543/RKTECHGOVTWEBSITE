import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useCreateExam,
  useGetExam,
  useUpdateExam,
  useListExamCategories,
  useListSubjects,
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
import { ArrowLeft, Save, Loader2, Eye, Archive, Calendar, Clock, Plus, Trash } from 'lucide-react';
import { Link } from 'wouter';

type ExamType = 'full_mock' | 'mini_mock' | 'topic_test' | 'chapter_test' | 'daily_quiz' | 'weekly_quiz' | 'pyq' | 'sectional';
type ExamStatus = 'draft' | 'published';

interface ExamSectionForm {
  id?: number;
  name: string;
  durationMinutes: string;
  order: number;
  subjectId: string;
  isMandatory: boolean;
  positiveMarks: string;
  negativeMarks: string;
  navigationRule: string;
  autoMove: boolean;
}

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
  scheduledDate: string;
  scheduledTime: string;
  endsDate: string;
  endsTime: string;
  timezone: string;
  questionTimerSeconds: string;
  autoSubmit: boolean;
  autoSave: boolean;
  sections: ExamSectionForm[];
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
  scheduledDate: '',
  scheduledTime: '',
  endsDate: '',
  endsTime: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  questionTimerSeconds: '',
  autoSubmit: true,
  autoSave: true,
  sections: [],
});

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Karachi',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney',
];

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
  const { data: subjects } = useListSubjects();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();

  useEffect(() => {
    if (existingExam && isEdit) {
      const ex = existingExam as typeof existingExam & {
        scheduledAt?: string | null; endsAt?: string | null; timezone?: string | null;
        questionTimerSeconds?: number | null; autoSubmit?: boolean | null; autoSave?: boolean | null;
        sections?: any[];
      };
      const toDateStr = (iso?: string | null) => iso ? iso.slice(0, 10) : '';
      const toTimeStr = (iso?: string | null) => iso ? iso.slice(11, 16) : '';
      
      const formSections = (ex.sections || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes ? String(s.durationMinutes) : '',
        order: s.order || 1,
        subjectId: s.subjectId ? String(s.subjectId) : '',
        isMandatory: s.isMandatory !== false,
        positiveMarks: s.positiveMarks ? String(s.positiveMarks) : '',
        negativeMarks: s.negativeMarks ? String(s.negativeMarks) : '',
        navigationRule: s.navigationRule || 'lock_previous',
        autoMove: s.autoMove !== false,
      }));

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
        scheduledDate: toDateStr(ex.scheduledAt),
        scheduledTime: toTimeStr(ex.scheduledAt),
        endsDate: toDateStr(ex.endsAt),
        endsTime: toTimeStr(ex.endsAt),
        timezone: ex.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
        questionTimerSeconds: ex.questionTimerSeconds ? String(ex.questionTimerSeconds) : '',
        autoSubmit: ex.autoSubmit !== false,
        autoSave: ex.autoSave !== false,
        sections: formSections,
      });
    }
  }, [existingExam, isEdit]);

  const handleSave = (statusOverride?: ExamStatus) => {
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    const buildIso = (date: string, time: string) => {
      if (!date) return null;
      return `${date}T${time || '00:00'}:00.000Z`;
    };

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
      scheduledAt: buildIso(form.scheduledDate, form.scheduledTime),
      endsAt: buildIso(form.endsDate, form.endsTime),
      timezone: form.timezone || 'UTC',
      questionTimerSeconds: form.questionTimerSeconds ? parseInt(form.questionTimerSeconds) : null,
      autoSubmit: form.autoSubmit,
      autoSave: form.autoSave,
      sections: form.sections.map(s => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes ? parseInt(s.durationMinutes) : null,
        order: Number(s.order) || 1,
        subjectId: s.subjectId ? parseInt(s.subjectId) : null,
        isMandatory: s.isMandatory,
        positiveMarks: s.positiveMarks ? parseFloat(s.positiveMarks) : null,
        negativeMarks: s.negativeMarks ? parseFloat(s.negativeMarks) : null,
        navigationRule: s.navigationRule,
        autoMove: s.autoMove,
      })),
    };

    if (isEdit) {
      // Cast to any so TypeScript doesn't complain about the extended fields
      updateExam.mutate(
        { id: examId!, data: payload as any },
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
        { data: payload as any },
        {
          onSuccess: () => {
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

          <div className="space-y-1.5">
            <Label htmlFor="questionTimerSeconds">Per-Question Timer (seconds)</Label>
            <Input
              id="questionTimerSeconds"
              type="number"
              placeholder="e.g. 30 (Leave blank for no limit)"
              value={form.questionTimerSeconds}
              onChange={e => setForm(f => ({ ...f, questionTimerSeconds: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-center mt-6">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoSubmit}
                onChange={e => setForm(f => ({ ...f, autoSubmit: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              Auto-Submit on Timer End
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoSave}
                onChange={e => setForm(f => ({ ...f, autoSave: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              Auto-Save Answers
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Sections & Sectional Timing</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(f => ({
                ...f,
                sections: [
                  ...f.sections,
                  {
                    name: `Section ${f.sections.length + 1}`,
                    durationMinutes: '',
                    order: f.sections.length + 1,
                    subjectId: '',
                    isMandatory: true,
                    positiveMarks: '',
                    negativeMarks: '',
                    navigationRule: 'lock_previous',
                    autoMove: true,
                  },
                ],
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />Add Section
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No sections added yet. Create sections to enable sectional durations and marking rules.
            </p>
          ) : (
            <div className="space-y-4">
              {form.sections.map((section, index) => (
                <div key={index} className="border p-4 rounded-lg relative space-y-4 bg-muted/10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const updated = form.sections.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, order: idx + 1 }));
                      setForm(f => ({ ...f, sections: updated }));
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label>Section Name *</Label>
                      <Input
                        value={section.name}
                        onChange={e => {
                          const updated = [...form.sections];
                          updated[index].name = e.target.value;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                        placeholder="e.g. Quantitative Aptitude"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Duration (mins)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 15 (Optional)"
                        value={section.durationMinutes}
                        onChange={e => {
                          const updated = [...form.sections];
                          updated[index].durationMinutes = e.target.value;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Select
                        value={section.subjectId || '__none'}
                        onValueChange={v => {
                          const updated = [...form.sections];
                          updated[index].subjectId = v === '__none' ? '' : v;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No Subject Mapping</SelectItem>
                          {(subjects ?? []).map((s: { id: number; name: string }) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sort Order</Label>
                      <Input
                        type="number"
                        value={section.order}
                        onChange={e => {
                          const updated = [...form.sections];
                          updated[index].order = parseInt(e.target.value) || index + 1;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label>Positive Marks Override</Label>
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="Default Exam Marks"
                        value={section.positiveMarks}
                        onChange={e => {
                          const updated = [...form.sections];
                          updated[index].positiveMarks = e.target.value;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Negative Marks Override</Label>
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="Default Exam Negative"
                        value={section.negativeMarks}
                        onChange={e => {
                          const updated = [...form.sections];
                          updated[index].negativeMarks = e.target.value;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Navigation Rule</Label>
                      <Select
                        value={section.navigationRule}
                        onValueChange={v => {
                          const updated = [...form.sections];
                          updated[index].navigationRule = v;
                          setForm(f => ({ ...f, sections: updated }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lock_previous">Lock Previous Section</SelectItem>
                          <SelectItem value="allow_previous">Allow Previous Section</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2 justify-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={section.isMandatory}
                          onChange={e => {
                            const updated = [...form.sections];
                            updated[index].isMandatory = e.target.checked;
                            setForm(f => ({ ...f, sections: updated }));
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                        />
                        Section is Mandatory
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={section.autoMove}
                          onChange={e => {
                            const updated = [...form.sections];
                            updated[index].autoMove = e.target.checked;
                            setForm(f => ({ ...f, sections: updated }));
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                        />
                        Auto-Move to Next
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Leave blank to make the exam available immediately (based on status).</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledDate"><Clock className="inline h-3.5 w-3.5 mr-1" />Start Date</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={form.scheduledDate}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduledTime">Start Time</Label>
              <Input
                id="scheduledTime"
                type="time"
                value={form.scheduledTime}
                onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsDate">End Date</Label>
              <Input
                id="endsDate"
                type="date"
                value={form.endsDate}
                onChange={e => setForm(f => ({ ...f, endsDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsTime">End Time</Label>
              <Input
                id="endsTime"
                type="time"
                value={form.endsTime}
                onChange={e => setForm(f => ({ ...f, endsTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
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
