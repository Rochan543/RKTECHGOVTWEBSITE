import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import {
  Flame, Sparkles, Target, Clock, BookOpen, Trophy, ArrowRight,
  Bookmark, XCircle, TrendingUp, CalendarDays, Award, CheckCircle2,
  Circle, Play, RotateCcw, ChevronRight, HelpCircle, ShieldAlert, ChevronLeft
} from 'lucide-react';

interface Task {
  id: string;
  type: "collection" | "topic" | "revision";
  entityId: number;
  entityName?: string;
  estimatedTimeMinutes: number;
  targetAccuracy: number;
  status: "pending" | "completed" | "skipped" | "rescheduled";
  rescheduledTo?: string;
}

interface StudyPlanResponse {
  date: string;
  status: "pending" | "completed" | "skipped";
  tasks: Task[];
  weeklySummary: { date: string; totalTasks: number; completedTasks: number }[];
}

export default function AdaptiveLearning() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedPath, setSelectedPath] = useState<string>('intermediate');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showReschedule, setShowReschedule] = useState<boolean>(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Queries
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ['adaptive', 'dashboard'],
    queryFn: () => customFetch('/api/v1/adaptive/dashboard'),
  });

  const { data: recData, isLoading: recLoading } = useQuery<any>({
    queryKey: ['adaptive', 'recommendations', selectedPath],
    queryFn: () => customFetch(`/api/v1/adaptive/recommendations?path=${selectedPath}`),
  });

  const { data: planData, isLoading: planLoading } = useQuery<StudyPlanResponse>({
    queryKey: ['adaptive', 'study-plan', selectedDate],
    queryFn: () => customFetch(`/api/v1/adaptive/study-plan?date=${selectedDate}`),
  });

  const { data: revisionQueue, isLoading: revisionLoading } = useQuery<any[]>({
    queryKey: ['adaptive', 'revision-queue'],
    queryFn: () => customFetch('/api/v1/adaptive/revision-queue'),
  });

  const { data: masteryData, isLoading: masteryLoading } = useQuery<any>({
    queryKey: ['adaptive', 'mastery'],
    queryFn: () => customFetch('/api/v1/adaptive/mastery'),
  });

  // Mutations
  const regenerateStudyPlan = useMutation({
    mutationFn: () => customFetch('/api/v1/adaptive/study-plan/regenerate', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adaptive', 'study-plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['adaptive', 'dashboard'] });
      toast({ title: 'Study plan regenerated for today' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to regenerate study plan', description: err.message, variant: 'destructive' });
    }
  });

  const completeTask = useMutation({
    mutationFn: (vars: { taskId: string; action: 'complete' | 'skip' | 'reschedule'; rescheduledTo?: string }) =>
      customFetch('/api/v1/adaptive/task/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          taskId: vars.taskId,
          action: vars.action,
          rescheduledTo: vars.rescheduledTo,
        }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['adaptive', 'study-plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['adaptive', 'dashboard'] });
      toast({ title: `Task marked as ${vars.action}` });
      setShowReschedule(false);
      setActiveTaskId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update task status', description: err.message, variant: 'destructive' });
    }
  });

  const handleRescheduleSubmit = () => {
    if (!activeTaskId || !rescheduleDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }
    completeTask.mutate({
      taskId: activeTaskId,
      action: 'reschedule',
      rescheduledTo: rescheduleDate,
    });
  };

  const isPageLoading = dashboardLoading || recLoading || planLoading || revisionLoading || masteryLoading;

  if (isPageLoading) {
    return (
      <div className="space-y-6 p-4 animate-pulse">
        <div className="h-10 bg-muted rounded-xl w-64" />
        <div className="h-6 bg-muted rounded-xl w-96" />
        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <div className="h-40 bg-muted rounded-2xl md:col-span-2" />
          <div className="h-40 bg-muted rounded-2xl" />
        </div>
        <div className="h-96 bg-muted rounded-2xl mt-6" />
      </div>
    );
  }

  // Weekdates mapping
  const getWeekDates = () => {
    const today = new Date(selectedDate);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // Monday

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en', { weekday: 'short' });
      const label = d.toLocaleDateString('en', { day: 'numeric' });
      return { date: iso, label, dayName };
    });
  };

  const weekDates = getWeekDates();

  const getPriorityColor = (difficulty: string) => {
    if (difficulty === 'hard') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (difficulty === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" /> Adaptive Learning Engine
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Personalized dashboard powered by your practice and mock exam history.</p>
        </div>
        
        {dashboardData?.studyStreak > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-4 py-2 rounded-2xl shadow-2xs">
            <Flame className="h-5 w-5 text-orange-500 fill-orange-500 animate-bounce" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{dashboardData.studyStreak} Day Streak!</span>
          </div>
        )}
      </div>

      {/* Main Tabbed Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="rounded-xl p-1 bg-muted/60 w-full overflow-x-auto flex-wrap h-auto md:w-max border border-slate-100 dark:border-slate-800 shadow-3xs">
          <TabsTrigger value="dashboard" className="rounded-lg text-xs py-1.5 px-4">Dashboard</TabsTrigger>
          <TabsTrigger value="studyplan" className="rounded-lg text-xs py-1.5 px-4">Study Plan</TabsTrigger>
          <TabsTrigger value="recommendations" className="rounded-lg text-xs py-1.5 px-4">Recommendations</TabsTrigger>
          <TabsTrigger value="revision" className="rounded-lg text-xs py-1.5 px-4">
            Revision Queue {dashboardData?.pendingRevision > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">{dashboardData.pendingRevision}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="weakareas" className="rounded-lg text-xs py-1.5 px-4">Weak Areas</TabsTrigger>
        </TabsList>

        {/* ================= DASHBOARD VIEW ================= */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Goal Ring & Streak */}
            <Card className="md:col-span-2 border border-slate-100 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-50/20 via-background to-background dark:from-indigo-950/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-500" /> Today's Learning Goal
                </CardTitle>
                <CardDescription className="text-xs">Based on targeted study sessions and custom planner tasks.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 flex items-center justify-center">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" className="text-indigo-600 dark:text-indigo-400" fill="transparent"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min((dashboardData?.todayGoal?.completedMinutes || 0) / (dashboardData?.todayGoal?.targetMinutes || 60), 1))}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                      {Math.round((dashboardData?.todayGoal?.completedMinutes / dashboardData?.todayGoal?.targetMinutes) * 100 || 0)}%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{dashboardData?.todayGoal?.completedMinutes}m completed</h3>
                    <p className="text-xs text-muted-foreground">Daily target: {dashboardData?.todayGoal?.targetMinutes} minutes of active study.</p>
                  </div>
                </div>

                <div className="border-l border-slate-100 dark:border-slate-800 pl-6 flex-1 w-full sm:w-auto">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-muted-foreground">Study Plan Progress</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {dashboardData?.todayGoal?.completedTasks} / {dashboardData?.todayGoal?.totalTasks} Tasks
                    </span>
                  </div>
                  <Progress value={dashboardData?.todayGoal?.totalTasks > 0 ? (dashboardData?.todayGoal?.completedTasks / dashboardData?.todayGoal?.totalTasks) * 100 : 0} className="h-2" />
                  <Button variant="link" size="sm" onClick={() => setActiveTab('studyplan')} className="text-xs text-indigo-600 dark:text-indigo-400 pl-0 mt-2 flex items-center gap-1">
                    Manage study tasks <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Continue */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" /> Continue Learning
                </CardTitle>
                <CardDescription className="text-xs">Pick up where you left off in your study progress.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col justify-between h-[120px]">
                {dashboardData?.quickContinueLearning ? (
                  <>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{dashboardData.quickContinueLearning.name}</h4>
                      <Badge className="mt-1 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-300 border-amber-200 dark:border-amber-900/30 text-[10px] capitalize">
                        {dashboardData.quickContinueLearning.type}
                      </Badge>
                    </div>
                    <Button size="sm" className="w-full mt-2 gap-1.5" onClick={() => setLocation(`/practice/setup?type=${dashboardData.quickContinueLearning.type}&${dashboardData.quickContinueLearning.type}Id=${dashboardData.quickContinueLearning.id}`)}>
                      <Play className="h-3.5 w-3.5 fill-current" /> Continue Practice
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-full">
                    <p className="text-xs text-muted-foreground mb-3">No recent practice sessions found.</p>
                    <Button size="sm" asChild>
                      <Link href="/practice">Start Practicing</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Recommended Collections */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-500" /> Highly Recommended Collections
                </CardTitle>
                <CardDescription className="text-xs">Identified collections based on weaknesses and completion rates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData?.recommendedCollections?.length > 0 ? (
                  dashboardData.recommendedCollections.map((col: any) => (
                    <div key={col.collectionId} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{col.name}</h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{col.description || 'Practice set containing collection questions.'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] py-0.5">{col.questionCount} Questions</Badge>
                          <Badge className="text-[10px] py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30">
                            {col.status}
                          </Badge>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => setLocation(`/practice/setup?type=collection&collectionId=${col.collectionId}`)} className="h-8 w-8 hover:bg-slate-50 rounded-xl">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">All collections completed! Good job.</p>
                )}
              </CardContent>
            </Card>

            {/* Weak Areas Checklist */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-rose-500" /> Critical Weak Topics
                </CardTitle>
                <CardDescription className="text-xs">Topics with the lowest accuracy or mastery score.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData?.weakTopics?.length > 0 ? (
                  dashboardData.weakTopics.map((topic: any) => (
                    <div key={topic.topicId} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-semibold text-sm truncate">{topic.name}</h4>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{topic.mastery}% Mastery</span>
                        </div>
                        <Progress value={topic.mastery} className="h-1.5 bg-slate-100 dark:text-slate-800" />
                        <span className="text-[10px] text-muted-foreground mt-1 block">Subject: {topic.subjectName}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/practice/setup?type=topic&topicId=${topic.topicId}`)} className="text-xs rounded-xl h-8 font-semibold">
                        Practice
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No weak topics detected! Keep up the high accuracy.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Collections to Revise */}
          {dashboardData?.collectionsToRevise?.length > 0 && (
            <Card className="border border-amber-100 dark:border-amber-900/30 bg-amber-50/10 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-amber-500" /> Collections Requiring Revision
                </CardTitle>
                <CardDescription className="text-xs">These collections have errors or high wrong-answer concentrations.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {dashboardData.collectionsToRevise.map((col: any) => (
                  <Card key={col.collectionId} className="border border-slate-100 shadow-2xs">
                    <CardContent className="p-4 flex flex-col justify-between h-[120px]">
                      <div>
                        <h4 className="font-bold text-sm truncate">{col.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{col.wrongAnswers} wrong answers pending</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/practice/setup?type=collection&collectionId=${col.collectionId}`)} className="w-full mt-2 text-xs font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50">
                        Start Revision <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================= STUDY PLAN VIEW ================= */}
        <TabsContent value="studyplan" className="space-y-6 mt-0">
          {/* Week Calendar */}
          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
            <CardContent className="pt-4">
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map(({ date, label, dayName }) => {
                  const summary = planData?.weeklySummary?.find(s => s.date === date);
                  const isSelected = date === selectedDate;
                  const isToday = date === new Date().toISOString().split("T")[0];
                  
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center p-2.5 rounded-2xl transition-all text-center border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : isToday
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'hover:bg-slate-50 border-transparent'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase opacity-80">{dayName}</span>
                      <span className="text-base font-extrabold mt-0.5">{label}</span>
                      {summary && summary.totalTasks > 0 ? (
                        <div className="mt-1 flex flex-col items-center">
                          <span className={`text-[9px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {summary.completedTasks}/{summary.totalTasks}
                          </span>
                          <div className={`w-4 h-1 rounded-full mt-1 ${summary.completedTasks === summary.totalTasks ? 'bg-green-500' : 'bg-slate-300'}`} />
                        </div>
                      ) : (
                        <span className="text-[9px] text-muted-foreground/40 mt-1">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Daily Tasks List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-500" />
                  Plan for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Tasks generated automatically to match your progression.</p>
              </div>

              {selectedDate === new Date().toISOString().split("T")[0] && (
                <Button variant="outline" size="sm" onClick={() => regenerateStudyPlan.mutate()} disabled={regenerateStudyPlan.isPending} className="text-xs rounded-xl gap-1.5 h-8 font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> Regenerate Today's Plan
                </Button>
              )}
            </div>

            {planData?.tasks?.length === 0 ? (
              <Card className="border border-slate-100 dark:border-slate-800 shadow-sm py-12 text-center">
                <CardContent>
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-semibold">No tasks planned for this day.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {planData?.tasks.map((task) => (
                  <Card key={task.id} className={`transition-all border border-slate-100 hover:shadow-xs ${task.status !== 'pending' ? 'bg-slate-50/50 opacity-70' : ''}`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-1 flex-shrink-0">
                          {task.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          {task.status === 'skipped' && <XCircle className="h-5 w-5 text-slate-400" />}
                          {task.status === 'rescheduled' && <CalendarDays className="h-5 w-5 text-amber-500" />}
                          {task.status === 'pending' && <Circle className="h-5 w-5 text-slate-300" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-bold text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.entityName}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {task.estimatedTimeMinutes} mins</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Target Accuracy: {task.targetAccuracy}%</span>
                            {task.rescheduledTo && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] py-0.5 ml-1">
                                Rescheduled to {task.rescheduledTo}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.status === 'pending' && (
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {task.type === "topic" && (
                            <Button size="sm" onClick={() => setLocation(`/practice/setup?type=topic&topicId=${task.entityId}`)} className="h-8 text-xs font-bold rounded-xl px-4 gap-1.5">
                              <Play className="h-3.5 w-3.5 fill-current" /> Start Practice
                            </Button>
                          )}
                          {task.type === "collection" && (
                            <Button size="sm" onClick={() => setLocation(`/practice/setup?type=collection&collectionId=${task.entityId}`)} className="h-8 text-xs font-bold rounded-xl px-4 gap-1.5">
                              <Play className="h-3.5 w-3.5 fill-current" /> Start Practice
                            </Button>
                          )}
                          {task.type === "revision" && (
                            <Button size="sm" onClick={() => setActiveTab('revision')} className="h-8 text-xs font-bold rounded-xl px-4 gap-1.5">
                              <Play className="h-3.5 w-3.5 fill-current" /> Go to Revision
                            </Button>
                          )}

                          <Button size="sm" variant="ghost" onClick={() => completeTask.mutate({ taskId: task.id, action: 'complete' })} className="h-8 text-xs font-bold rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50">
                            Complete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => completeTask.mutate({ taskId: task.id, action: 'skip' })} className="h-8 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-600 hover:bg-slate-100">
                            Skip
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setActiveTaskId(task.id); setShowReschedule(true); }} className="h-8 text-xs font-bold rounded-xl text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                            Reschedule
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================= RECOMMENDATIONS VIEW ================= */}
        <TabsContent value="recommendations" className="space-y-6 mt-0">
          {/* Path Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Smart Recommendations & Learning Paths</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle difficulty levels to explore recommended paths.</p>
            </div>
            <div className="flex gap-2">
              {['beginner', 'intermediate', 'advanced'].map((lvl) => (
                <Button
                  key={lvl}
                  size="sm"
                  variant={selectedPath === lvl ? 'default' : 'outline'}
                  onClick={() => setSelectedPath(lvl)}
                  className="text-xs font-bold rounded-xl px-4 capitalize h-8"
                >
                  {lvl}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Progression timeline */}
            <Card className="md:col-span-2 border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" /> Learning Path Timeline
                </CardTitle>
                <CardDescription className="text-xs">Difficulty progression roadmap calculated for your weak areas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {recData?.topicsProgression?.length > 0 ? (
                  recData.topicsProgression.map((prog: any) => (
                    <div key={prog.topicId} className="border-l-2 border-indigo-100 dark:border-indigo-900/50 pl-4 py-1 relative">
                      <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-indigo-500" />
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{prog.name} Progression</h4>
                      <p className="text-xs text-muted-foreground mb-3">Current accuracy: {prog.accuracy}%</p>
                      
                      <div className="grid gap-2 sm:grid-cols-3">
                        {prog.progression.map((step: any, idx: number) => (
                          <Card key={idx} className="border border-slate-100 dark:border-slate-800 p-2.5 flex items-center justify-between gap-2 shadow-3xs bg-card">
                            <span className="text-xs font-bold truncate text-slate-700 dark:text-slate-300">{step.level}</span>
                            {step.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => setLocation(`/practice/setup?type=topic&topicId=${prog.topicId}&difficulty=${step.difficulty}`)} className="h-6 w-6 hover:bg-slate-100 rounded-lg flex-shrink-0">
                                <Play className="h-3 w-3 fill-current text-indigo-600" />
                              </Button>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No timelines needed! Accuracy looks stable.</p>
                )}
              </CardContent>
            </Card>

            {/* Collection suggestions */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-500" /> Collection Suggestions
                </CardTitle>
                <CardDescription className="text-xs">Based on targeted path: {selectedPath}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {recData?.collections?.slice(0, 5).map((col: any) => (
                  <div key={col.collectionId} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">{col.name}</h4>
                      <Badge className="text-[9px] py-0.5 flex-shrink-0" variant="outline">Score: {col.score}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{col.description || 'Collection of exam questions'}</p>
                    <div className="flex justify-between items-center mt-1">
                      <Badge className={`text-[9px] py-0.5 ${getPriorityColor(col.difficulty || 'medium')}`}>
                        {col.status}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/practice/setup?type=collection&collectionId=${col.collectionId}`)} className="h-7 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50">
                        Practice
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= REVISION QUEUE VIEW ================= */}
        <TabsContent value="revision" className="space-y-6 mt-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Personalized Revision Queue</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your mistakes, bookmarks, and missed questions sorted by priority.</p>
            </div>
            
            {revisionQueue && revisionQueue.length > 0 && (
              <Button onClick={() => setLocation('/practice/setup?type=wrong_answers')} className="text-xs font-extrabold rounded-xl px-5 h-9 gap-1.5 shadow-xs">
                <Play className="h-4 w-4 fill-current" /> Start Mistake Revision Session
              </Button>
            )}
          </div>

          <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Prioritized Question Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {revisionQueue && revisionQueue.length > 0 ? (
                <div className="divide-y">
                  {revisionQueue.map((q, idx) => (
                    <div key={idx} className="p-4 flex items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <Badge className="text-[9px] py-0 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300 border-rose-200 dark:border-rose-900/30 font-extrabold uppercase">
                            {q.reason}
                          </Badge>
                          <Badge variant="outline" className={`text-[9px] py-0 capitalize ${getPriorityColor(q.difficulty)}`}>
                            {q.difficulty}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{q.subjectName} · {q.topicName}</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-2 line-clamp-2 leading-relaxed">{q.text.replace(/<[^>]*>/g, '')}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/practice/setup?type=topic&topicId=${q.topicId}`)} className="text-xs font-semibold rounded-xl h-8">
                        Practice Topic
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-3 animate-bounce" />
                  <h4 className="font-bold text-sm">Your queue is empty!</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">You don't have any bookmarked questions or wrong answers. Excellent work!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= WEAK AREAS VIEW ================= */}
        <TabsContent value="weakareas" className="space-y-6 mt-0">
          <div>
            <h2 className="text-xl font-bold">Weak Areas & Concept Mastery</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Calculated by weighting your accuracy, completion levels, and recency of attempts.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Subject Mastery List */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-500" /> Subject Mastery Breakdown
                </CardTitle>
                <CardDescription className="text-xs">Aggregated accuracy across subjects.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {masteryData?.subjects?.length > 0 ? (
                  masteryData.subjects.map((sub: any) => (
                    <div key={sub.subjectId} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{sub.name}</span>
                        <span className="font-bold">{sub.mastery}% Mastery ({sub.attemptCount} Qs)</span>
                      </div>
                      <Progress value={sub.mastery} className="h-2" />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Accuracy: {sub.accuracy}%</span>
                        <span>Avg Time: {sub.avgTimeSeconds}s/Q</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No mastery statistics available yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Topic Mastery list */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Topic Mastery Rankings
                </CardTitle>
                <CardDescription className="text-xs">Your top topic performances sorted by lowest mastery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {masteryData?.topics?.length > 0 ? (
                  masteryData.topics.slice(0, 6).map((topic: any) => (
                    <div key={topic.topicId} className="space-y-1.5 border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{topic.name}</span>
                        <Badge className={`text-[10px] py-0.5 font-bold ${topic.mastery < 50 ? 'bg-red-50 text-red-700' : (topic.mastery < 75 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}`}>
                          {topic.mastery < 50 ? 'Weak' : (topic.mastery < 75 ? 'Moderate' : 'Strong')} ({topic.mastery}%)
                        </Badge>
                      </div>
                      <Progress value={topic.mastery} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Accuracy: {topic.accuracy}% · Completed: {topic.completion}%</span>
                        <span>Avg Time: {topic.avgTimeSeconds}s</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No topic mastery statistics available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-100">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg">Reschedule Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Move this task to a future date. It will be added to your study planner queue on the selected date automatically.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Target Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={rescheduleDate}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-card text-foreground"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowReschedule(false); setActiveTaskId(null); }} className="rounded-xl font-bold text-xs h-9">Cancel</Button>
            <Button size="sm" onClick={handleRescheduleSubmit} disabled={completeTask.isPending} className="rounded-xl font-bold text-xs h-9">Confirm Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
