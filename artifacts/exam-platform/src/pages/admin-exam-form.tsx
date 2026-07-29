import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useCreateExam,
  useGetExam,
  useUpdateExam,
  useListExamCategories,
  useListSubjects,
  getListExamsQueryKey,
  customFetch,
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
import { ArrowLeft, Save, Loader2, Eye, Archive, Calendar, Clock, Plus, Trash, Search, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  const [selectedQuestions, setSelectedQuestions] = useState<{ id?: number; examId: number; sectionId: number | null; questionId: number; order: number }[]>([]);
  
  // Question Selector states
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSection, setSelectorSection] = useState<any | null>(null);
  const [selectorTopicId, setSelectorTopicId] = useState<string>('');
  const [selectorSearch, setSelectorSearch] = useState<string>('');
  const [selectorDifficulty, setSelectorDifficulty] = useState<string>('');
  const [selectorType, setSelectorType] = useState<string>('');
  const [selectorPage, setSelectorPage] = useState(1);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [availableTotal, setAvailableTotal] = useState(0);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>([]);
  const [topicsForSection, setTopicsForSection] = useState<any[]>([]);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch selected questions when editing
  useEffect(() => {
    if (isEdit && examId) {
      customFetch(`/api/v1/exams/${examId}/questions`)
        .then((res: any) => {
          if (Array.isArray(res)) {
            setSelectedQuestions(res);
          }
        })
        .catch(err => console.error("Failed to load exam questions", err));
    }
  }, [isEdit, examId]);

  // Fetch topics when selector opens
  useEffect(() => {
    if (selectorOpen && selectorSection?.subjectId) {
      customFetch(`/api/v1/topics?subjectId=${selectorSection.subjectId}`)
        .then((res: any) => {
          if (Array.isArray(res)) {
            setTopicsForSection(res);
          }
        })
        .catch(err => console.error(err));
    }
  }, [selectorOpen, selectorSection]);

  // Sync selection to local state when opening
  useEffect(() => {
    if (selectorOpen && selectorSection) {
      const sectionQIds = selectedQuestions
        .filter(sq => sq.sectionId === selectorSection.id)
        .map(sq => sq.questionId);
      setLocalSelectedIds(sectionQIds);
      setSelectorTopicId('');
      setSelectorSearch('');
      setSearchTerm('');
      setSelectorDifficulty('');
      setSelectorType('');
      setSelectorPage(1);
      setAvailableQuestions([]);
      setAvailableTotal(0);
    }
  }, [selectorOpen, selectorSection, selectedQuestions]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setSelectorSearch(searchTerm);
      setSelectorPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load available questions when filters change
  useEffect(() => {
    if (selectorOpen && selectorSection && selectorSection.subjectId) {
      setAvailableLoading(true);
      const queryParams = new URLSearchParams({
        page: String(selectorPage),
        limit: '15',
        subjectId: String(selectorSection.subjectId),
        status: 'active',
        isPublished: 'true',
        ...(selectorTopicId && { topicId: selectorTopicId }),
        ...(selectorSearch && { search: selectorSearch }),
        ...(selectorDifficulty && { difficulty: selectorDifficulty }),
        ...(selectorType && { type: selectorType }),
      });
      customFetch(`/api/v1/questions?${queryParams.toString()}`)
        .then((res: any) => {
          if (res && Array.isArray(res.data)) {
            setAvailableQuestions(res.data);
            setAvailableTotal(res.total || 0);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setAvailableLoading(false));
    } else {
      setAvailableQuestions([]);
      setAvailableTotal(0);
    }
  }, [selectorOpen, selectorSection, selectorTopicId, selectorSearch, selectorDifficulty, selectorType, selectorPage]);

  const handleSelectAll = () => {
    const idsToAdd = availableQuestions.map(q => q.id);
    setLocalSelectedIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleUnselectAll = () => {
    const idsToRemove = availableQuestions.map(q => q.id);
    setLocalSelectedIds(prev => prev.filter(id => !idsToRemove.includes(id)));
  };

  const handleSaveQuestions = async () => {
    if (!examId || !selectorSection) return;
    setIsSavingQuestions(true);
    try {
      const otherSectionsQuestions = selectedQuestions.filter(sq => sq.sectionId !== selectorSection.id);
      const newSectionQuestions = localSelectedIds.map((qId, index) => ({
        examId,
        sectionId: selectorSection.id,
        questionId: qId,
        order: index + 1,
      }));
      const updated = [...otherSectionsQuestions, ...newSectionQuestions];

      await customFetch(`/api/v1/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: updated }),
      });

      setSelectedQuestions(updated);
      toast({ title: 'Questions saved successfully' });
      setSelectorOpen(false);

      queryClient.invalidateQueries({ queryKey: getListExamsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Failed to save questions', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setIsSavingQuestions(false);
    }
  };

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
                      {isEdit && section.id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectorSection(section);
                            setSelectorOpen(true);
                          }}
                          className="mt-2 text-xs h-7 py-1 px-2 border-primary text-primary hover:bg-primary/5"
                        >
                          Select Questions ({selectedQuestions.filter(sq => sq.sectionId === section.id).length})
                        </Button>
                      )}
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

      {/* Question Selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Questions - {selectorSection?.name}</DialogTitle>
            <DialogDescription>
              Choose questions to include in this section. Questions are filtered by the section's subject.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!selectorSection?.subjectId ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                <p className="text-destructive text-sm font-semibold">
                  This section does not have a subject mapped. Please close this dialog, select a Subject for this section, and save the exam settings first.
                </p>
              </div>
            ) : (
              <>
                {/* Statistics Row */}
                <div className="grid grid-cols-4 gap-4 bg-muted/40 p-3 rounded-lg text-center text-xs font-medium">
                  <div>
                    <p className="text-muted-foreground">Available Questions</p>
                    <p className="text-lg font-bold text-foreground">{availableTotal}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Selected Questions</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{localSelectedIds.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Questions (Exam)</p>
                    <p className="text-lg font-bold text-blue-600">{selectedQuestions.filter(sq => sq.sectionId !== selectorSection.id).length + localSelectedIds.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Question Count (Section)</p>
                    <p className="text-lg font-bold text-primary">{localSelectedIds.length}</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search questions…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                  <Select value={selectorTopicId || 'all'} onValueChange={v => { setSelectorTopicId(v === 'all' ? '' : v); setSelectorPage(1); }}>
                    <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Topic" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {topicsForSection.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectorDifficulty || 'all'} onValueChange={v => { setSelectorDifficulty(v === 'all' ? '' : v); setSelectorPage(1); }}>
                    <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Diff</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectorType || 'all'} onValueChange={v => { setSelectorType(v === 'all' ? '' : v); setSelectorPage(1); }}>
                    <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single_choice">Single Choice</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True / False</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk operations */}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} className="text-xs h-8">
                    Select All (Current Page)
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleUnselectAll} className="text-xs h-8">
                    Unselect All (Current Page)
                  </Button>
                </div>

                {/* Table of Available Questions */}
                <div className="border rounded-md overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12 text-center">Select</TableHead>
                        <TableHead>Question Text</TableHead>
                        <TableHead className="w-24">Difficulty</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1 block">Loading questions…</span>
                          </TableCell>
                        </TableRow>
                      ) : availableQuestions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-xs">
                            No questions found for the selected subject/topic.
                          </TableCell>
                        </TableRow>
                      ) : (
                        availableQuestions.map((q: any) => {
                          const isChecked = localSelectedIds.includes(q.id);
                          return (
                            <TableRow key={q.id} className="hover:bg-muted/10">
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setLocalSelectedIds(prev => [...prev, q.id]);
                                    } else {
                                      setLocalSelectedIds(prev => prev.filter(id => id !== q.id));
                                    }
                                  }}
                                  className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary accent-primary"
                                />
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="text-xs">
                                  <p className="font-medium line-clamp-2">{q.text}</p>
                                  {q.options && q.options.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                                      {q.options.map((o: any, oidx: number) => (
                                        <span key={oidx} className={o.isCorrect ? "font-bold text-green-600 dark:text-green-400" : ""}>
                                          {String.fromCharCode(65 + oidx)}) {o.text.slice(0, 15)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="capitalize text-xs">
                                <Badge variant={q.difficulty === 'easy' ? 'secondary' : q.difficulty === 'hard' ? 'destructive' : 'outline'} className="text-[10px]">
                                  {q.difficulty}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize text-xs text-muted-foreground">
                                {q.type.replace('_', ' ')}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {availableTotal > 15 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Page {selectorPage} of {Math.ceil(availableTotal / 15)}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={selectorPage <= 1} onClick={() => setSelectorPage(p => p - 1)} className="h-8 w-8 p-0">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={selectorPage >= Math.ceil(availableTotal / 15)} onClick={() => setSelectorPage(p => p + 1)} className="h-8 w-8 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveQuestions} disabled={isSavingQuestions || !selectorSection?.subjectId}>
              {isSavingQuestions && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
