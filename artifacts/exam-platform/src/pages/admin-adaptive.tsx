import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BrainCircuit, Users, AlertTriangle, ShieldAlert, TrendingUp, RefreshCw,
  Zap, BookOpen, Clock, ArrowRight, Calendar
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, AreaChart, Area, Legend
} from 'recharts';
import { customFetch } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function AdminAdaptive() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignTarget, setAssignTarget] = useState<{ type: 'template' | 'recommendation', id: number, entityType?: string, entityId?: number, title?: string } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Assignment console states
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [assignAction, setAssignAction] = useState('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [recType, setRecType] = useState('topic');
  const [recEntityId, setRecEntityId] = useState<number | ''>('');
  const [weakTopicId, setWeakTopicId] = useState<number | ''>('');
  const [revisionQuestionId, setRevisionQuestionId] = useState<number | ''>('');
  const [goalQuestions, setGoalQuestions] = useState(15);
  const [goalMinutes, setGoalMinutes] = useState(45);
  const [goalAccuracy, setGoalAccuracy] = useState(0.75);

  // Calibration settings states
  const [masteryThreshold, setMasteryThreshold] = useState(0.8);
  const [accuracyThreshold, setAccuracyThreshold] = useState(0.7);
  const [weakTopicThreshold, setWeakTopicThreshold] = useState(0.5);
  const [recommendationFrequency, setRecommendationFrequency] = useState(7);
  const [sm2Ease, setSm2Ease] = useState(2.5);
  const [sm2IntervalModifier, setSm2IntervalModifier] = useState(1.0);
  const [difficultyProgression, setDifficultyProgression] = useState('standard');
  const [automaticAssignments, setAutomaticAssignments] = useState(true);
  const [dailyGoalQuestions, setDailyGoalQuestions] = useState(10);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(30);

  // Template CRUD states
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDifficulty, setTemplateDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [templateDurationDays, setTemplateDurationDays] = useState(30);
  const [templateTasks, setTemplateTasks] = useState<any[]>([]);

  // Task form builder states
  const [newTaskTopicId, setNewTaskTopicId] = useState<string>('');
  const [newTaskTime, setNewTaskTime] = useState(30);
  const [newTaskAccuracy, setNewTaskAccuracy] = useState(80);

  // Fetch topics for template task builder
  const { data: allTopics } = useQuery<any[]>({
    queryKey: ['/api/v1/topics-for-templates-builder'],
    queryFn: () => customFetch('/api/v1/topics'),
  });

  const handleAddTask = () => {
    if (!newTaskTopicId) return;
    const selectedTopic = allTopics?.find((t: any) => t.id === Number(newTaskTopicId));
    if (!selectedTopic) return;
    const newTask = {
      type: "topic",
      entityId: selectedTopic.id,
      entityName: selectedTopic.name,
      estimatedTimeMinutes: Number(newTaskTime),
      targetAccuracy: Number(newTaskAccuracy),
    };
    setTemplateTasks([...templateTasks, newTask]);
    setNewTaskTopicId('');
  };

  const handleRemoveTask = (idx: number) => {
    setTemplateTasks(templateTasks.filter((_, i) => i !== idx));
  };

  const handleOpenEditTemplate = (plan: any) => {
    setEditingTemplate(plan);
    setTemplateTitle(plan.title);
    setTemplateDifficulty(plan.difficulty);
    setTemplateDurationDays(plan.durationDays);
    setTemplateTasks(plan.tasks || []);
    setIsTemplateDialogOpen(true);
  };

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplateDifficulty('medium');
    setTemplateDurationDays(30);
    setTemplateTasks([]);
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateTitle.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Title is required' });
      return;
    }
    if (templateTasks.length === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'At least one task must be added to the template' });
      return;
    }
    const payload = {
      title: templateTitle,
      difficulty: templateDifficulty,
      durationDays: Number(templateDurationDays),
      tasks: templateTasks,
    };
    if (editingTemplate) {
      editTemplateMutation.mutate({ id: editingTemplate.id, template: payload });
    } else {
      createTemplateMutation.mutate(payload);
    }
  };

  // Create study plan template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (newTemplate: { title: string; difficulty: 'easy' | 'medium' | 'hard'; durationDays: number; tasks: any[] }) => {
      return customFetch('/api/v1/adaptive/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: 'Template created successfully' });
      setIsTemplateDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed to create template', description: err.message });
    }
  });

  // Edit study plan template mutation
  const editTemplateMutation = useMutation({
    mutationFn: (vars: { id: number; template: { title: string; difficulty: 'easy' | 'medium' | 'hard'; durationDays: number; tasks: any[] } }) => {
      return customFetch(`/api/v1/adaptive/admin/templates/${vars.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.template),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: 'Template updated successfully' });
      setIsTemplateDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed to update template', description: err.message });
    }
  });

  // Delete study plan template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => {
      return customFetch(`/api/v1/adaptive/admin/templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed to delete template', description: err.message });
    }
  });

  // Fetch all users to support assignment selection
  const { data: usersData } = useQuery<any>({
    queryKey: ['/api/v1/users'],
    queryFn: () => customFetch('/api/v1/users?limit=1000'),
  });
  const students = usersData?.data?.filter((u: any) => u.role === 'student') || [];

  // Filter students based on search query
  const filteredStudents = students.filter((student: any) => {
    const search = studentSearch.toLowerCase();
    return (
      student.name?.toLowerCase().includes(search) ||
      student.email?.toLowerCase().includes(search)
    );
  });

  // Assign template or recommendation mutation
  const assignMutation = useMutation({
    mutationFn: (vars: { type: 'template' | 'recommendation', userIds: number[], templateId?: number, entityType?: string, entityId?: number }) => {
      const endpoint = vars.type === 'template'
        ? '/api/v1/adaptive/admin/assign/template'
        : '/api/v1/adaptive/admin/assign/recommendation';
      const body = vars.type === 'template'
        ? { userIds: vars.userIds, templateId: vars.templateId }
        : { userIds: vars.userIds, type: vars.entityType, entityId: vars.entityId };

      return customFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: 'Successfully assigned template/recommendation' });
      setAssignTarget(null);
      setSelectedUserIds([]);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Assignment failed', description: err.message });
    }
  });

  // Clear student revision queue mutation
  const clearQueueMutation = useMutation({
    mutationFn: (studentId: number) =>
      customFetch('/api/v1/adaptive/admin/clear-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: studentId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: "Revision queue cleared successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to clear queue", description: err.message });
    }
  });

  // Determine active sub-tab from path
  let activeTab = 'overview';
  if (location.endsWith('/recommendations')) activeTab = 'recommendations';
  else if (location.endsWith('/mastery')) activeTab = 'mastery';
  else if (location.endsWith('/study-plans')) activeTab = 'study-plans';
  else if (location.endsWith('/revision')) activeTab = 'revision';
  else if (location.endsWith('/analytics')) activeTab = 'analytics';
  else if (location.endsWith('/settings')) activeTab = 'settings';

  const setTabLocation = (tab: string) => {
    if (tab === 'overview') setLocation('/admin/adaptive');
    else setLocation(`/admin/adaptive/${tab}`);
  };

  // Fetch admin adaptive metrics
  const { data: stats, isLoading, isRefetching, refetch } = useQuery<any>({
    queryKey: ['admin-adaptive-dashboard'],
    queryFn: () => customFetch('/api/v1/adaptive/admin'),
    refetchInterval: 120000, // 2 minutes auto-refresh
  });

  // Mutate/trigger engine recalculation
  const recalculateMutation = useMutation({
    mutationFn: () => customFetch('/api/v1/adaptive/admin/re-evaluate', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/adaptive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/analytics'] });
      
      const statsMsg = data && typeof data.studentsProcessed === 'number'
        ? `Processed ${data.studentsProcessed} students. Generated: ${data.recommendationsGenerated} recs, ${data.studyPlansGenerated} plans, ${data.revisionItemsGenerated} revision items.`
        : "Successfully executed engine re-evaluation, recalculated mastery, and regenerated recommendations, study plans, and revision queues for all students.";

      toast({
        title: "Adaptive Engine Recalculated",
        description: statsMsg,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Recalculation Failed",
        description: err.message || "An error occurred while re-evaluating metrics.",
      });
    }
  });

  const triggerEngineRefresh = () => {
    recalculateMutation.mutate();
  };

  // Fetch engine settings
  const { data: settingsData, refetch: refetchSettings } = useQuery<any>({
    queryKey: ['admin-adaptive-settings'],
    queryFn: () => customFetch('/api/v1/adaptive/admin/settings'),
    enabled: activeTab === 'settings',
  });

  // Sync settings states
  React.useEffect(() => {
    if (settingsData) {
      setMasteryThreshold(settingsData.masteryThreshold ?? 0.8);
      setAccuracyThreshold(settingsData.accuracyThreshold ?? 0.7);
      setWeakTopicThreshold(settingsData.weakTopicThreshold ?? 0.5);
      setRecommendationFrequency(settingsData.recommendationFrequency ?? 7);
      setSm2Ease(settingsData.sm2Ease ?? 2.5);
      setSm2IntervalModifier(settingsData.sm2IntervalModifier ?? 1.0);
      setDifficultyProgression(settingsData.difficultyProgression ?? 'standard');
      setAutomaticAssignments(settingsData.automaticAssignments ?? true);
      setDailyGoalQuestions(settingsData.dailyGoalQuestions ?? 10);
      setDailyGoalMinutes(settingsData.dailyGoalMinutes ?? 30);
    }
  }, [settingsData]);

  // Save engine settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/adaptive/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: 'Engine calibration saved successfully' });
      refetchSettings();
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed to save settings', description: err.message });
    }
  });

  // Execute manual assignment mutation
  const executeAssignmentMutation = useMutation({
    mutationFn: async () => {
      let endpoint = '';
      let body: any = { userIds: selectedStudents };

      if (assignAction === 'template') {
        endpoint = '/api/v1/adaptive/admin/assign/template';
        body.templateId = Number(selectedTemplateId);
      } else if (assignAction === 'recommendation') {
        endpoint = '/api/v1/adaptive/admin/assign/recommendation';
        body.type = recType;
        body.entityId = Number(recEntityId);
      } else if (assignAction === 'weak-topic') {
        endpoint = '/api/v1/adaptive/admin/assign/weak-topic';
        body.topicId = Number(weakTopicId);
      } else if (assignAction === 'revision-queue') {
        endpoint = '/api/v1/adaptive/admin/assign/revision-queue';
        body.questionId = Number(revisionQuestionId);
      } else if (assignAction === 'goals') {
        endpoint = '/api/v1/adaptive/admin/assign/goals';
        body.dailyQuestionsTarget = Number(goalQuestions);
        body.dailyMinutesTarget = Number(goalMinutes);
        body.practiceAccuracyTarget = Number(goalAccuracy);
      } else if (assignAction === 'reset') {
        endpoint = '/api/v1/adaptive/admin/assign/reset';
      }

      return customFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-adaptive-dashboard'] });
      toast({ title: 'Student assignment completed successfully' });
      setSelectedStudents([]);
      setSelectedTemplateId('');
      setRecEntityId('');
      setWeakTopicId('');
      setRevisionQuestionId('');
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Assignment failed', description: err.message });
    }
  });

  // Format progress value helper
  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '0%';
    return `${Math.round(val)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
        <BrainCircuit className="h-12 w-12 text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading Adaptive Learning engine metrics...</p>
      </div>
    );
  }

  // Fallbacks if data empty
  const studentsNeedingHelp = stats?.studentsNeedingHelp ?? [];
  const mostDifficultTopics = stats?.mostDifficultTopics ?? [];
  const mostImprovedStudents = stats?.mostImprovedStudents ?? [];
  const leastActiveStudents = stats?.leastActiveStudents ?? [];

  // Recommendations from API
  const recommendations = stats?.recommendations ?? [];

  // Study plans from API
  const studyPlans = stats?.studyPlans ?? [];

  // Revision queues from API
  const revisionQueues = stats?.revisionQueues ?? [];

  // Chart data formatting
  const difficultyDistributionData = mostDifficultTopics.map((topic: any) => ({
    name: topic.topicName?.length > 15 ? topic.topicName.substring(0, 15) + '...' : topic.topicName,
    accuracy: Math.round(topic.avgAccuracy || 0),
    attempts: topic.attempts || 0,
  }));

  const activeTabsList = [
    { id: 'overview', name: 'Overview' },
    { id: 'recommendations', name: 'Recommendations' },
    { id: 'mastery', name: 'Student Mastery' },
    { id: 'study-plans', name: 'Study Plans' },
    { id: 'revision', name: 'Revision Queue' },
    { id: 'analytics', name: 'Deep Analytics' },
    { id: 'settings', name: 'Engine Settings' }
  ];

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Adaptive Learning Admin
            </h1>
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Monitor mastery statistics, review recommendations, and configure the real-time adaptive engine settings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2 h-9 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Stats
          </Button>

          <Button
            size="sm"
            onClick={triggerEngineRefresh}
            disabled={recalculateMutation.isPending}
            className="gap-2 h-9 text-xs bg-gradient-to-r from-primary to-primary/95 hover:from-primary/95 hover:to-primary"
          >
            <Zap className={`h-3.5 w-3.5 ${recalculateMutation.isPending ? 'animate-bounce' : ''}`} />
            Trigger Re-evaluation
          </Button>
        </div>
      </div>

      {/* ── SUB-TABS NAVIGATION ────────────────────────────────────────── */}
      <div className="flex items-center overflow-x-auto gap-1 border-b pb-1 scrollbar-none">
        {activeTabsList.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTabLocation(tab.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-[6px] ${
              activeTab === tab.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Critical Attention Students</CardTitle>
                <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentsNeedingHelp.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Average accuracy below 60%</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Underperforming Topics</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mostDifficultTopics.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Class accuracy below 65%</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Average Improvement</CardTitle>
                <div className="p-2 bg-success/10 rounded-lg text-emerald-500">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mostImprovedStudents.length > 0
                    ? `+${Math.round(mostImprovedStudents.reduce((acc: number, s: any) => acc + (s.improvement || 0), 0) / mostImprovedStudents.length)}%`
                    : "N/A"}
                </div>
                <p className="text-xs text-emerald-500 font-semibold mt-1">In the last 7 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Students Needing Help */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-4 w-4 text-destructive" />
                  Students Needing Support
                </CardTitle>
                <CardDescription>
                  Students ranking lowest in average accuracy across practice sessions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentsNeedingHelp.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No students currently flagged in critical state.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentsNeedingHelp.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors">
                        <div>
                          <p className="font-semibold text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            {formatPercent(student.avgAccuracy)} Accuracy
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">{student.totalTests} tests taken</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most Difficult Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Most Difficult Topics
                </CardTitle>
                <CardDescription>
                  Topics with the lowest global accuracy rate from practice attempts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mostDifficultTopics.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No difficult topics recorded yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mostDifficultTopics.slice(0, 5).map((topic: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate max-w-[280px]">
                            {topic.topicName} <span className="text-xs text-muted-foreground">({topic.subjectName})</span>
                          </span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {formatPercent(topic.avgAccuracy)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={topic.avgAccuracy || 0} className="h-2" />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{topic.attempts} attempts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Most Improved Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Most Improved Students
                </CardTitle>
                <CardDescription>
                  Students showing the largest increase in accuracy rate in the last 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mostImprovedStudents.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No improved students data available.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mostImprovedStudents.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors">
                        <div>
                          <p className="font-semibold text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            +{student.improvement}% Delta
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">Current Accuracy: {formatPercent(student.recentAccuracy)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Least Active Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-4 w-4 text-primary" />
                  Least Active Students
                </CardTitle>
                <CardDescription>
                  Students with the fewest practice sessions completed in the last 14 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leastActiveStudents.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No activity logs recorded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leastActiveStudents.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors">
                        <div>
                          <p className="font-semibold text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            {student.recentTests} tests recent
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">Total tests: {student.totalTests}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Student Assignments Console */}
          <Card className="border-2 border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Student Assignments Console</CardTitle>
              </div>
              <CardDescription>
                Assign Study Plans, Recommendations, Weak Topics, Revision Queue items, or custom daily targets to students in bulk.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* User selection panel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-sm">Select Target Students ({selectedStudents.length} selected)</Label>
                    {selectedStudents.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedStudents([])}
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                  <Input 
                    placeholder="Search students by name or email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="h-9"
                  />
                  <div className="border rounded-lg max-h-[220px] overflow-y-auto p-3 space-y-2 bg-background/50">
                    {students.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">No student accounts found.</div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">No matching students found.</div>
                    ) : (
                      filteredStudents.map((student: any) => (
                        <div key={student.id} className="flex items-center space-x-2 py-1 border-b last:border-b-0 border-accent/20">
                          <Checkbox
                            id={`bulk-student-${student.id}`}
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStudents([...selectedStudents, student.id]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                              }
                            }}
                          />
                          <label htmlFor={`bulk-student-${student.id}`} className="text-xs font-medium cursor-pointer flex-1 py-1">
                            {student.name} <span className="text-[10px] text-muted-foreground ml-1">({student.email})</span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Assignment settings panel */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="assignAction">Assignment Type / Command</Label>
                    <select
                      id="assignAction"
                      value={assignAction}
                      onChange={(e) => setAssignAction(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="template">Assign Study Plan Template</option>
                      <option value="recommendation">Assign Recommendation Concept</option>
                      <option value="weak-topic">Assign Weak Topic concept</option>
                      <option value="revision-queue">Assign Question to Revision Queue</option>
                      <option value="goals">Assign Daily & Practice Goals Target</option>
                      <option value="reset" className="text-destructive font-bold">Reset Student Adaptive Assignments</option>
                    </select>
                  </div>

                  {/* Conditionally rendered parameters */}
                  {assignAction === 'template' && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <Label htmlFor="selectedTemplate">Select Study Plan Template</Label>
                      <select
                        id="selectedTemplate"
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : '')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">-- Choose Template --</option>
                        {studyPlans.map((plan: any) => (
                          <option key={plan.id} value={plan.id}>{plan.title} ({plan.durationDays} Days)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {assignAction === 'recommendation' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <Label htmlFor="recType">Recommendation Target Type</Label>
                        <select
                          id="recType"
                          value={recType}
                          onChange={(e) => setRecType(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="topic">Topic Concept</option>
                          <option value="collection">Practice Collection</option>
                          <option value="practice_set">Practice Set</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="recEntityId">Entity ID</Label>
                        <Input
                          id="recEntityId"
                          type="number"
                          placeholder="e.g. 15"
                          value={recEntityId}
                          onChange={(e) => setRecEntityId(e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                    </div>
                  )}

                  {assignAction === 'weak-topic' && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <Label htmlFor="weakTopicId">Topic ID to flag/assign as weak concept</Label>
                      <Input
                        id="weakTopicId"
                        type="number"
                        placeholder="e.g. 3"
                        value={weakTopicId}
                        onChange={(e) => setWeakTopicId(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  )}

                  {assignAction === 'revision-queue' && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <Label htmlFor="revisionQuestionId">Question ID to force add to revision queue</Label>
                      <Input
                        id="revisionQuestionId"
                        type="number"
                        placeholder="e.g. 1024"
                        value={revisionQuestionId}
                        onChange={(e) => setRevisionQuestionId(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  )}

                  {assignAction === 'goals' && (
                    <div className="space-y-3 animate-in fade-in duration-200 border p-3 rounded-lg bg-accent/5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="goalQuestions">Questions Target</Label>
                          <Input
                            id="goalQuestions"
                            type="number"
                            value={goalQuestions}
                            onChange={(e) => setGoalQuestions(parseInt(e.target.value, 10))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="goalMinutes">Minutes Target</Label>
                          <Input
                            id="goalMinutes"
                            type="number"
                            value={goalMinutes}
                            onChange={(e) => setGoalMinutes(parseInt(e.target.value, 10))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="goalAccuracy">Practice Accuracy Target (0.0 - 1.0)</Label>
                        <Input
                          id="goalAccuracy"
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1.0"
                          value={goalAccuracy}
                          onChange={(e) => setGoalAccuracy(parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  )}

                  {assignAction === 'reset' && (
                    <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-lg text-xs text-destructive-foreground font-semibold">
                      ⚠️ WARNING: This will completely wipe the selected students' study plans, template assignments, revision queues, and custom goals.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => executeAssignmentMutation.mutate()}
                  disabled={
                    selectedStudents.length === 0 || 
                    executeAssignmentMutation.isPending ||
                    (assignAction === 'template' && !selectedTemplateId) ||
                    (assignAction === 'recommendation' && !recEntityId) ||
                    (assignAction === 'weak-topic' && !weakTopicId) ||
                    (assignAction === 'revision-queue' && !revisionQuestionId)
                  }
                  variant={assignAction === 'reset' ? 'destructive' : 'default'}
                  className="min-w-[180px]"
                >
                  {executeAssignmentMutation.isPending ? "Processing..." : `Execute Action on ${selectedStudents.length} Students`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RECOMMENDATIONS TAB ───────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <Card className="animate-in fade-in-50 duration-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Adaptive Engine Recommendations</CardTitle>
                <CardDescription>
                  Weekly concept recommendations dynamically generated for active students.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast({ title: "Triggered Recalculation", description: "Re-scanning student history logs..." })}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3 w-3" /> Force Scan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Recommended Concept</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                      No concept recommendations generated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recommendations.map((rec: any) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.studentName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <BookOpen className="h-3 w-3 text-primary" /> {rec.topicName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            rec.priority === 'high'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : rec.priority === 'medium'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          }
                        >
                          {rec.priority.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{rec.reason}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => setAssignTarget({
                            type: 'recommendation',
                            id: rec.id,
                            entityType: rec.type,
                            entityId: rec.entityId,
                            title: rec.topicName
                          })}
                        >
                          Assign Test <ArrowRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── STUDENT MASTERY TAB ────────────────────────────────────────── */}
      {activeTab === 'mastery' && (
        <Card className="animate-in fade-in-50 duration-200">
          <CardHeader>
            <CardTitle className="text-lg">Class Mastery Progression</CardTitle>
            <CardDescription>
              Progression tracking of subject mastery based on adaptive quiz scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-xl bg-accent/20 space-y-4">
              <h3 className="font-bold text-sm">Classroom Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-card border rounded-lg">
                  <div className="text-xs text-muted-foreground">Class Average Mastery</div>
                  <div className="text-xl font-bold mt-1">{formatPercent(stats?.mastery?.classAverageMastery)}</div>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <div className="text-xs text-muted-foreground">Highly Mastered Topics</div>
                  <div className="text-xl font-bold mt-1 text-emerald-500">{stats?.mastery?.highlyMasteredTopics ?? 0} Topics</div>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <div className="text-xs text-muted-foreground">Topics Under Review</div>
                  <div className="text-xl font-bold mt-1 text-amber-500">{stats?.mastery?.topicsUnderReview ?? 0} Topics</div>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <div className="text-xs text-muted-foreground">Students Active Today</div>
                  <div className="text-xl font-bold mt-1 text-primary">{stats?.mastery?.studentsActiveToday ?? 0} Students</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Subject Mastery Levels</h4>
              <div className="space-y-3">
                {stats?.mastery?.subjectMastery?.map((sm: any) => (
                  <div key={sm.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{sm.name}</span>
                      <span>{sm.mastery}% Class Mastery</span>
                    </div>
                    <Progress value={sm.mastery} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STUDY PLANS TAB ───────────────────────────────────────────── */}
      {activeTab === 'study-plans' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Adaptive Study Plan Templates</h3>
              <p className="text-xs text-muted-foreground">Create and assign pacing trackers to students based on goal exams.</p>
            </div>
            <Button size="sm" className="text-xs font-semibold gap-1.5" onClick={handleOpenCreateTemplate}>
              <Calendar className="h-3.5 w-3.5" /> Create Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studyPlans.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
                No study plans templates created yet. Click Create Template to add one.
              </div>
            ) : (
              studyPlans.map((plan: any) => (
                <Card key={plan.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{plan.title}</CardTitle>
                        <CardDescription className="mt-1">{plan.durationDays} Days Duration</CardDescription>
                      </div>
                      <Badge variant="outline" className={plan.difficulty === 'hard' ? 'border-red-500 text-red-500' : 'border-emerald-500 text-emerald-500'}>
                        {plan.difficulty.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Active Enrolled Students:</span>
                      <span className="font-bold text-foreground">{plan.studentsCount}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Pacing Completion Rate</span>
                        <span>{plan.completionRate}%</span>
                      </div>
                      <Progress value={plan.completionRate} className="h-1.5" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => setAssignTarget({
                          type: 'template',
                          id: plan.id,
                          title: plan.title
                        })}
                      >
                        Assign Students
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => handleOpenEditTemplate(plan)}
                      >
                        Edit Template
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete template "${plan.title}"?`)) {
                            deleteTemplateMutation.mutate(plan.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── REVISION QUEUE TAB ────────────────────────────────────────── */}
      {activeTab === 'revision' && (
        <Card className="animate-in fade-in-50 duration-200">
          <CardHeader>
            <CardTitle className="text-lg">Spaced Repetition Spacing Configuration</CardTitle>
            <CardDescription>
              Adjust spacing intervals for student revision queues (SuperMemo SM-2 configuration).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border rounded-xl space-y-2">
                <div className="text-xs text-muted-foreground">Interval 1 (Easy Card)</div>
                <div className="text-lg font-bold">1 Day</div>
                <p className="text-[10px] text-muted-foreground">First practice repetition window.</p>
              </div>
              <div className="p-4 border rounded-xl space-y-2">
                <div className="text-xs text-muted-foreground">Interval 2 (Normal Card)</div>
                <div className="text-lg font-bold">6 Days</div>
                <p className="text-[10px] text-muted-foreground">Second practice repetition window.</p>
              </div>
              <div className="p-4 border rounded-xl space-y-2">
                <div className="text-xs text-muted-foreground">Interval 3 (Hard Card)</div>
                <div className="text-lg font-bold">14 Days</div>
                <p className="text-[10px] text-muted-foreground">Third repetition window threshold.</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm">Active Revision Queues Stats</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Total Queue Size</TableHead>
                    <TableHead>Overdue Reviews</TableHead>
                    <TableHead>Performance Rating</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisionQueues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                        No active student revision queues tracked.
                      </TableCell>
                    </TableRow>
                  ) : (
                    revisionQueues.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold">{item.studentName}</TableCell>
                        <TableCell>{item.queueSize} items</TableCell>
                        <TableCell>
                          <Badge variant={item.overdueCount > 5 ? 'destructive' : 'secondary'}>
                            {item.overdueCount} overdue
                          </Badge>
                        </TableCell>
                        <TableCell>{item.subjectAccuracy}% accuracy</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              clearQueueMutation.mutate(item.studentId);
                            }}
                            disabled={clearQueueMutation.isPending}
                          >
                            Clear Queue
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── DEEP ANALYTICS TAB ─────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Topic Accuracy Distribution</CardTitle>
              <CardDescription>
                Compare topic difficulty vs overall student performance accuracy percentage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {difficultyDistributionData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Insufficient data to render chart. Run more practice sessions.
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={difficultyDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy Rate (%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Realtime Recommendation Trends</CardTitle>
              <CardDescription>
                Track total generated recommendations vs completion progress over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats?.recommendationTrends || []}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#888888" fontSize={11} />
                    <YAxis stroke="#888888" fontSize={11} />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="generated" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Generated Actions" />
                    <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Resolved Actions" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ENGINE SETTINGS TAB ────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <Card className="animate-in fade-in-50 duration-200 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <BrainCircuit className="h-5 w-5" />
              <CardTitle className="text-lg">Adaptive Engine Calibration Settings</CardTitle>
            </div>
            <CardDescription>
              Tweak thresholds, spaced repetition intervals, and automatic assignment pacing rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mastery & Accuracies */}
              <div className="space-y-4 border p-4 rounded-xl bg-accent/10">
                <h3 className="font-bold text-sm text-foreground">Performance & Mastery Thresholds</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="masteryThreshold">Mastery Threshold (0.0 - 1.0)</Label>
                  <Input 
                    id="masteryThreshold"
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={masteryThreshold}
                    onChange={(e) => setMasteryThreshold(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Threshold ratio to mark a topic as highly mastered.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="accuracyThreshold">Accuracy Threshold (0.0 - 1.0)</Label>
                  <Input 
                    id="accuracyThreshold"
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={accuracyThreshold}
                    onChange={(e) => setAccuracyThreshold(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Target accuracy score required for topic progression.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="weakTopicThreshold">Weak Topic Threshold (0.0 - 1.0)</Label>
                  <Input 
                    id="weakTopicThreshold"
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={weakTopicThreshold}
                    onChange={(e) => setWeakTopicThreshold(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Topics below this accuracy ratio are flagged as weak.</p>
                </div>
              </div>

              {/* SM-2 Spaced Repetition */}
              <div className="space-y-4 border p-4 rounded-xl bg-accent/10">
                <h3 className="font-bold text-sm text-foreground">SuperMemo SM-2 Interval Adjusters</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="sm2Ease">SM-2 Starting Ease Factor (e.g. 2.5)</Label>
                  <Input 
                    id="sm2Ease"
                    type="number"
                    step="0.1"
                    min="1.3"
                    value={sm2Ease}
                    onChange={(e) => setSm2Ease(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Starting ease factor (difficulty adjuster) for newly wrong questions.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sm2IntervalModifier">SM-2 Interval Modifier multiplier</Label>
                  <Input 
                    id="sm2IntervalModifier"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={sm2IntervalModifier}
                    onChange={(e) => setSm2IntervalModifier(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Interval scaling multiplier for next repetitions.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recommendationFrequency">Recommendation Frequency (Days)</Label>
                  <Input 
                    id="recommendationFrequency"
                    type="number"
                    min="1"
                    value={recommendationFrequency}
                    onChange={(e) => setRecommendationFrequency(parseInt(e.target.value, 10))}
                  />
                  <p className="text-[10px] text-muted-foreground">How often the engine compiles concept recommendations.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Goals */}
              <div className="space-y-4 border p-4 rounded-xl bg-accent/10">
                <h3 className="font-bold text-sm text-foreground">Default Target Goals</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="dailyGoalQuestions">Daily Target Questions Count</Label>
                  <Input 
                    id="dailyGoalQuestions"
                    type="number"
                    min="1"
                    value={dailyGoalQuestions}
                    onChange={(e) => setDailyGoalQuestions(parseInt(e.target.value, 10))}
                  />
                  <p className="text-[10px] text-muted-foreground">Default target questions count assigned daily to students.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dailyGoalMinutes">Daily Target Study Minutes</Label>
                  <Input 
                    id="dailyGoalMinutes"
                    type="number"
                    min="1"
                    value={dailyGoalMinutes}
                    onChange={(e) => setDailyGoalMinutes(parseInt(e.target.value, 10))}
                  />
                  <p className="text-[10px] text-muted-foreground">Default target minutes of active study daily.</p>
                </div>
              </div>

              {/* Engine Settings */}
              <div className="space-y-4 border p-4 rounded-xl bg-accent/10">
                <h3 className="font-bold text-sm text-foreground">Engine Controls</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="difficultyProgression">Difficulty Progression Algorithm</Label>
                  <select 
                    id="difficultyProgression"
                    value={difficultyProgression}
                    onChange={(e) => setDifficultyProgression(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="standard">Standard Progression</option>
                    <option value="adaptive">Adaptive Calibration</option>
                    <option value="linear">Strict Linear Progression</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">Determines difficulty ramping rules for practice sets.</p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card mt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="automaticAssignments" className="font-semibold text-sm">Automatic Engine Assignments</Label>
                    <p className="text-[10px] text-muted-foreground">Let engine automatically push recommendations to students.</p>
                  </div>
                  <Switch 
                    id="automaticAssignments"
                    checked={automaticAssignments}
                    onCheckedChange={setAutomaticAssignments}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => {
                  saveSettingsMutation.mutate({
                    masteryThreshold,
                    accuracyThreshold,
                    weakTopicThreshold,
                    recommendationFrequency,
                    sm2Ease,
                    sm2IntervalModifier,
                    difficultyProgression,
                    automaticAssignments,
                    dailyGoalQuestions,
                    dailyGoalMinutes,
                  });
                }}
                disabled={saveSettingsMutation.isPending}
                className="bg-primary hover:bg-primary/90 min-w-[150px]"
              >
                {saveSettingsMutation.isPending ? "Saving Calibration..." : "Save Calibration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CREATE/EDIT TEMPLATE DIALOG ── */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => !open && setIsTemplateDialogOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Study Plan Template' : 'Create Study Plan Template'}</DialogTitle>
            <DialogDescription>
              Define the title, difficulty, duration, and associated topic study tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="templateTitle">Template Title</Label>
                <Input
                  id="templateTitle"
                  placeholder="e.g. Quantitative Aptitude Master"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="templateDifficulty">Difficulty</Label>
                <select
                  id="templateDifficulty"
                  value={templateDifficulty}
                  onChange={(e) => setTemplateDifficulty(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="templateDurationDays">Duration (Days)</Label>
                <Input
                  id="templateDurationDays"
                  type="number"
                  min="1"
                  max="120"
                  value={templateDurationDays}
                  onChange={(e) => setTemplateDurationDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="border p-4 rounded-xl space-y-3 bg-accent/10">
              <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Add Topic Task</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1 md:col-span-3">
                  <Label htmlFor="taskTopic">Select Topic</Label>
                  <select
                    id="taskTopic"
                    value={newTaskTopicId}
                    onChange={(e) => setNewTaskTopicId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Choose a Topic --</option>
                    {allTopics?.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="taskTime">Est. Time (min)</Label>
                  <Input
                    id="taskTime"
                    type="number"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="taskAccuracy">Target Acc (%)</Label>
                  <Input
                    id="taskAccuracy"
                    type="number"
                    min="1"
                    max="100"
                    value={newTaskAccuracy}
                    onChange={(e) => setNewTaskAccuracy(Number(e.target.value))}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-xs h-10 font-bold"
                    onClick={handleAddTask}
                  >
                    Add Task
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-sm">Tasks List ({templateTasks.length})</Label>
              {templateTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
                  No tasks added to this template yet.
                </div>
              ) : (
                <div className="border rounded-lg divide-y bg-background max-h-[200px] overflow-y-auto">
                  {templateTasks.map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-semibold">{task.entityName}</span>
                        <div className="text-muted-foreground flex gap-3">
                          <span>⏱️ {task.estimatedTimeMinutes} min</span>
                          <span>🎯 {task.targetAccuracy}% accuracy</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 h-8 font-semibold"
                        onClick={() => handleRemoveTask(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={createTemplateMutation.isPending || editTemplateMutation.isPending}
              onClick={handleSaveTemplate}
            >
              {createTemplateMutation.isPending || editTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN DIALOG ── */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign {assignTarget?.type === 'template' ? 'Study Plan' : 'Recommendation'}</DialogTitle>
            <DialogDescription>
              Assign "{assignTarget?.title}" to selected students. This will instantly create daily plans for them.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[300px] overflow-y-auto space-y-2">
            <div className="font-semibold text-xs text-muted-foreground pb-2">Select Students:</div>
            {students.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">No student accounts found.</div>
            ) : (
              students.map((student: any) => (
                <div key={student.id} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`student-${student.id}`}
                    checked={selectedUserIds.includes(student.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUserIds([...selectedUserIds, student.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== student.id));
                      }
                    }}
                  />
                  <label htmlFor={`student-${student.id}`} className="text-sm font-medium leading-none cursor-pointer">
                    {student.name} <span className="text-xs text-muted-foreground">({student.email})</span>
                  </label>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button
              disabled={selectedUserIds.length === 0 || assignMutation.isPending}
              onClick={() => {
                if (assignTarget) {
                  assignMutation.mutate({
                    type: assignTarget.type,
                    userIds: selectedUserIds,
                    templateId: assignTarget.type === 'template' ? assignTarget.id : undefined,
                    entityType: assignTarget.entityType,
                    entityId: assignTarget.entityId
                  });
                }
              }}
            >
              {assignMutation.isPending ? 'Assigning...' : `Assign to ${selectedUserIds.length} Student(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
