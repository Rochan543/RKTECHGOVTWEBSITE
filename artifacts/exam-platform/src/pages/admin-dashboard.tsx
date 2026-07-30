import React, { useState } from 'react';
import {
  useAdminAnalytics,
  useRepositoryAnalytics,
  useCollectionManagementAnalytics,
  useQuestionAnalytics,
} from '@/hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Users, FileText, Database, Activity, TrendingUp, CheckCircle, Hash, Layers,
  RefreshCw, BarChart2, Calendar, FileSpreadsheet, AlertTriangle, ArrowLeft, ArrowRight, Search, BookMarked
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie } from 'recharts';
import { Link } from 'wouter';
import { useListSubjects, customFetch, useGetGamificationConfig, getGetGamificationConfigQueryKey, useUpdateGamificationConfig } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

function GamificationConfigPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dailyLoginXp: 20,
    solveQuestionXp: 2,
    readArticleXp: 5,
    completeMissionXp: 50,
    perfectAccuracyXp: 10,
  });

  const { data: config, isLoading } = useGetGamificationConfig({
    query: {
      queryKey: getGetGamificationConfigQueryKey()
    }
  });

  React.useEffect(() => {
    if (config) {
      setForm({
        dailyLoginXp: config.dailyLoginXp,
        solveQuestionXp: config.solveQuestionXp,
        readArticleXp: config.readArticleXp,
        completeMissionXp: config.completeMissionXp,
        perfectAccuracyXp: config.perfectAccuracyXp,
      });
    }
  }, [config]);

  const updateMutation = useUpdateGamificationConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Configuration Updated!", description: "XP rewards rules have been updated database-wide." });
        queryClient.invalidateQueries({ queryKey: getGetGamificationConfigQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err.response?.data?.error || "Error", variant: "destructive" });
      }
    }
  });

  const handleSave = () => {
    updateMutation.mutate({ data: form });
  };

  if (isLoading) {
    return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2 border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">XP Rules Configurations</CardTitle>
          <CardDescription className="text-xs">Adjust how much XP students earn for various platform interactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Daily Login XP Reward</span>
              <Input
                type="number"
                value={form.dailyLoginXp}
                onChange={e => setForm({ ...form, dailyLoginXp: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Solve Question XP Reward</span>
              <Input
                type="number"
                value={form.solveQuestionXp}
                onChange={e => setForm({ ...form, solveQuestionXp: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Read Article XP Reward</span>
              <Input
                type="number"
                value={form.readArticleXp}
                onChange={e => setForm({ ...form, readArticleXp: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Perfect Accuracy Bonus XP</span>
              <Input
                type="number"
                value={form.perfectAccuracyXp}
                onChange={e => setForm({ ...form, perfectAccuracyXp: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs font-bold text-muted-foreground">Complete Daily Mission Reward</span>
              <Input
                type="number"
                value={form.completeMissionXp}
                onChange={e => setForm({ ...form, completeMissionXp: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <div className="pt-4 border-t flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 font-bold text-xs"
            >
              {updateMutation.isPending ? "Saving..." : "Save Config Rules"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">Earned Badges Milestones</CardTitle>
          <CardDescription className="text-xs">Rules definition for student badges (System)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {[
            { badge: "DAILY_STREAK_5", desc: "Maintain 5 day daily study streak" },
            { badge: "DAILY_STREAK_15", desc: "Maintain 15 day daily study streak" },
            { badge: "WEEKLY_STREAK_4", desc: "Achieve 4 weeks consistent study streak" },
            { badge: "PERFECT_SCORE_100", desc: "Get 100% score on a full subject test" },
            { badge: "XP_LEVEL_10", desc: "Reach User Level 10 benchmark" },
          ].map((item, idx) => (
            <div key={idx} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-900/30 text-xs font-medium">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase block tracking-wider mb-1">{item.badge.replace(/_/g, ' ')}</span>
              <p className="text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'collections' || tab === 'repository' || tab === 'questions' || tab === 'adaptive' || tab === 'gamification') {
        return tab;
      }
    }
    return 'overview';
  });

  // Question Filters
  const [qPage, setQPage] = useState<number>(1);
  const [qSearch, setQSearch] = useState<string>('');
  const [qSubject, setQSubject] = useState<string>('all');
  const [qDifficulty, setQDifficulty] = useState<string>('all');

  const { data: subjects } = useListSubjects();

  // Queries
  const { data: adminStats, isLoading: adminLoading, dataUpdatedAt } = useAdminAnalytics();
  const { data: repoStats, isLoading: repoLoading } = useRepositoryAnalytics();
  const { data: colStats, isLoading: colLoading } = useCollectionManagementAnalytics();
  const { data: questionData, isLoading: qLoading } = useQuestionAnalytics({
    page: qPage,
    limit: 10,
    search: qSearch || undefined,
    subjectId: qSubject !== 'all' ? Number(qSubject) : undefined,
    difficulty: qDifficulty !== 'all' ? qDifficulty : undefined,
  });
  const { data: adaptiveStats, isLoading: adaptiveLoading } = useQuery<any>({
    queryKey: ['admin-adaptive-stats'],
    queryFn: () => customFetch('/api/v1/adaptive/admin'),
    enabled: activeTab === 'adaptive',
  });

  const isLoading = adminLoading || (activeTab === 'repository' && repoLoading) || (activeTab === 'collections' && colLoading) || (activeTab === 'questions' && qLoading) || (activeTab === 'adaptive' && adaptiveLoading);
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  if (isLoading || !adminStats) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: adminStats.totalStudents.toLocaleString(),
      sub: `${adminStats.activeStudents} active students`,
      icon: Users,
      color: 'bg-primary text-primary-foreground',
    },
    {
      title: 'Total Exams',
      value: adminStats.mockTests.toLocaleString(),
      sub: `Submitted mock test attempts`,
      icon: FileText,
      color: 'bg-card',
    },
    {
      title: 'Question Bank',
      value: adminStats.questions.toLocaleString(),
      sub: 'Total stored questions',
      icon: Database,
      color: 'bg-card',
    },
    {
      title: 'Practice Sessions',
      value: adminStats.practiceSessions.toLocaleString(),
      sub: 'Custom practice starts',
      icon: Activity,
      color: 'bg-card',
    },
    {
      title: 'Subjects & Topics',
      value: `${adminStats.subjects} Subjects`,
      sub: `${adminStats.topics} total topics`,
      icon: Hash,
      color: 'bg-card',
    },
    {
      title: 'New Registrations',
      value: adminStats.newStudents.toLocaleString(),
      sub: 'Students added in last 30 days',
      icon: TrendingUp,
      color: 'bg-card',
    },
  ];

  const quickLinks = [
    { label: 'Manage Exams', href: '/admin/exams', icon: FileText },
    { label: 'Question Bank', href: '/admin/questions', icon: Database },
    { label: 'Subjects & Topics', href: '/admin/subjects', icon: Hash },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Notes & PDFs', href: '/admin/notes', icon: Layers },
    { label: 'Current Affairs', href: '/admin/current-affairs', icon: TrendingUp },
  ];

  // Colors for pie/bar graphs
  const COLORS = ['hsl(var(--primary))', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6 p-1 md:p-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs font-semibold">
            <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" /> Auto-refreshes every 30s · Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="rounded-xl p-1 bg-muted/60 w-full overflow-x-auto flex-wrap h-auto md:w-max">
          <TabsTrigger value="overview" className="rounded-lg text-xs py-1.5 px-3">Overview</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-lg text-xs py-1.5 px-3">Platform Analytics</TabsTrigger>
          <TabsTrigger value="repository" className="rounded-lg text-xs py-1.5 px-3">Repository Stats</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-lg text-xs py-1.5 px-3">Collection Management</TabsTrigger>
          <TabsTrigger value="questions" className="rounded-lg text-xs py-1.5 px-3">Question breakdown</TabsTrigger>
          <TabsTrigger value="adaptive" className="rounded-lg text-xs py-1.5 px-3">Adaptive Learning</TabsTrigger>
          <TabsTrigger value="gamification" className="rounded-lg text-xs py-1.5 px-3">Gamification Settings</TabsTrigger>
        </TabsList>

        {/* ================= OVERVIEW TAB ================= */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statCards.map((card) => (
              <Card key={card.title} className={card.color === 'bg-primary text-primary-foreground' ? 'border-0 shadow-md bg-primary text-primary-foreground rounded-2xl' : 'rounded-2xl shadow-sm border-muted'}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className={`text-xs font-bold uppercase tracking-wider ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-90' : 'text-muted-foreground'}`}>
                    {card.title}
                  </CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-75' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{card.value}</div>
                  <p className={`text-xs mt-1 font-semibold ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-80' : 'text-muted-foreground'}`}>{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Overview Quick Stats Bar chart */}
            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Platform Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Users', value: adminStats.totalStudents },
                      { name: 'Exams', value: adminStats.mockTests },
                      { name: 'Questions', value: adminStats.questions },
                      { name: 'Sessions', value: adminStats.practiceSessions },
                    ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <div className="p-4 border rounded-2xl bg-card hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3">
                      <link.icon className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-xs font-bold">{link.label}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= PLATFORM PERFORMANCE TAB ================= */}
        <TabsContent value="performance" className="space-y-6 mt-0">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Daily Active Users</p>
                <p className="text-3xl font-extrabold mt-1 text-primary">{adminStats.dailyActiveUsers}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Unique active students today</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Active Users</p>
                <p className="text-3xl font-extrabold mt-1 text-emerald-500">{adminStats.monthlyActiveUsers}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Unique active last 30 days</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Average Platform Accuracy</p>
                <p className="text-3xl font-extrabold mt-1 text-violet-500">{adminStats.averageAccuracy}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Across all mock exam submissions</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Practice Completion Rate</p>
                <p className="text-3xl font-extrabold mt-1 text-amber-500">{adminStats.completionRate}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ratio of completed practice sessions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= REPOSITORY STATS TAB ================= */}
        <TabsContent value="repository" className="space-y-6 mt-0">
          {repoStats ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Questions per Subject chart */}
                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Questions Per Subject</CardTitle>
                    <CardDescription>Visual breakdown of stored questions by subject</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={repoStats.questionsPerSubject} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="subjectName" fontSize={10} tickLine={false} />
                          <YAxis fontSize={11} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Questions" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Import stats */}
                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Repository Import log metrics</CardTitle>
                    <CardDescription>Performance of heuristics OCR & file bulk importer</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-2xl bg-card">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Parse Imports</span>
                        <h3 className="text-2xl font-extrabold mt-1">{repoStats.importStatistics.totalImports}</h3>
                      </div>
                      <div className="p-4 border rounded-2xl bg-card">
                        <span className="text-[10px] text-emerald-500 font-bold uppercase">Successful Runs</span>
                        <h3 className="text-2xl font-extrabold mt-1 text-emerald-500">{repoStats.importStatistics.successfulImports}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      <div className="text-xs font-semibold">
                        {repoStats.importStatistics.parsingErrors} bulk import processes reported parsing schema errors.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lists row */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Recently Added Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y text-xs font-medium">
                      {repoStats.recentlyAddedQuestions.map((q) => (
                        <div key={q.id} className="p-3.5 hover:bg-muted/10 transition-colors flex justify-between gap-4">
                          <p className="truncate font-semibold max-w-[320px]">{q.text}</p>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground rounded-lg h-5 py-0 px-2 flex-shrink-0">{q.subjectName}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Recently Updated Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y text-xs font-medium">
                      {repoStats.recentlyUpdatedQuestions.map((q) => (
                        <div key={q.id} className="p-3.5 hover:bg-muted/10 transition-colors flex justify-between gap-4">
                          <p className="truncate font-semibold max-w-[320px]">{q.text}</p>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground rounded-lg h-5 py-0 px-2 flex-shrink-0">{q.subjectName}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ================= COLLECTION MANAGEMENT TAB ================= */}
        <TabsContent value="collections" className="space-y-6 mt-0">
          {colStats ? (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Collections Used</p>
                    <p className="text-3xl font-extrabold mt-1 text-primary">{colStats.collectionsUsed} / {colStats.totalCollections}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Collections Completed</p>
                    <p className="text-3xl font-extrabold mt-1 text-emerald-500">{colStats.collectionsCompleted}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Average Score</p>
                    <p className="text-3xl font-extrabold mt-1 text-violet-500">{colStats.averageCollectionScore}%</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Inactive (30d)</p>
                    <p className="text-3xl font-extrabold mt-1 text-rose-500">{colStats.inactiveCollections}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Popular lists */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Most Popular Collections</CardTitle>
                    <CardDescription>Collections with the highest active practice counts</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y text-xs font-medium">
                      {colStats.mostPopularCollections.map((col) => (
                        <div key={col.id} className="p-4 hover:bg-muted/10 transition-colors flex justify-between items-center">
                          <span className="font-bold">{col.name}</span>
                          <div className="flex gap-2">
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-lg">{col.count} sessions</Badge>
                            <Badge className="bg-primary/10 text-primary border-0 rounded-lg">{col.score}% avg</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-muted shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Least Used / Inactive Collections</CardTitle>
                    <CardDescription>Collections with minimal student session counts</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y text-xs font-medium">
                      {colStats.leastUsedCollections.map((col) => (
                        <div key={col.id} className="p-4 hover:bg-muted/10 transition-colors flex justify-between items-center">
                          <span className="font-bold text-muted-foreground">{col.name}</span>
                          <div className="flex gap-2">
                            <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0 rounded-lg">{col.count} sessions</Badge>
                            <Badge className="bg-primary/10 text-primary border-0 rounded-lg">{col.score}% avg</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ================= QUESTION BREAKDOWN TAB ================= */}
        <TabsContent value="questions" className="space-y-6 mt-0">
          <Card className="rounded-2xl border-muted shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Question Performance breakdown</CardTitle>
              <CardDescription>Introspective query of attempts, correctness, and report flags per question</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Question toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search questions..."
                    value={qSearch}
                    onChange={(e) => { setQSearch(e.target.value); setQPage(1); }}
                    className="pl-9 rounded-xl text-xs h-9"
                  />
                </div>

                <Select value={qSubject} onValueChange={(val) => { setQSubject(val); setQPage(1); }}>
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Subjects</SelectItem>
                    {(subjects ?? []).map((sub) => (
                      <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={qDifficulty} onValueChange={(val) => { setQDifficulty(val); setQPage(1); }}>
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-muted">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Question text</TableHead>
                      <TableHead className="font-bold text-xs text-center">Attempts</TableHead>
                      <TableHead className="font-bold text-xs text-center">Correct (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Average Time</TableHead>
                      <TableHead className="font-bold text-xs text-center">Bookmarks</TableHead>
                      <TableHead className="font-bold text-xs text-center">Report flags</TableHead>
                      <TableHead className="font-bold text-xs">Difficulty Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionData && questionData.questions.length > 0 ? (
                      questionData.questions.map((q) => (
                        <TableRow key={q.questionId} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium text-xs max-w-[280px] truncate">{q.text}</TableCell>
                          <TableCell className="text-center text-xs font-semibold">{q.attemptCount}</TableCell>
                          <TableCell className="text-center text-xs font-bold text-emerald-500">{q.correctPercentage}%</TableCell>
                          <TableCell className="text-center text-xs font-medium">{q.averageTime}s</TableCell>
                          <TableCell className="text-center text-xs font-bold text-amber-500">{q.bookmarkCount}</TableCell>
                          <TableCell className="text-center text-xs font-extrabold text-rose-500">
                            {q.reportCount > 0 ? (
                              <Badge className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-0 rounded-lg flex gap-1 items-center justify-center py-0.5 px-2 w-max mx-auto">
                                <AlertTriangle className="h-3 w-3" /> {q.reportCount}
                              </Badge>
                            ) : '0'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${q.difficultyRating === 'easy' ? 'bg-emerald-500/10 text-emerald-500' : q.difficultyRating === 'hard' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'} border-0 uppercase text-[10px] py-0.5 px-2 rounded-lg font-bold`}>
                              {q.difficultyRating}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-xs font-semibold animate-pulse">
                          No matching questions found in bank.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {questionData && questionData.total > 10 && (
                <div className="flex justify-between items-center text-xs font-semibold pt-2">
                  <span className="text-muted-foreground">Showing {(qPage - 1) * 10 + 1} - {Math.min(qPage * 10, questionData.total)} of {questionData.total} questions</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setQPage(p => Math.max(p - 1, 1))}
                      disabled={qPage === 1}
                      className="rounded-xl h-8 text-[11px] gap-1 px-3 py-1 flex items-center justify-center font-bold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setQPage(p => p + 1)}
                      disabled={qPage * 10 >= questionData.total}
                      className="rounded-xl h-8 text-[11px] gap-1 px-3 py-1 flex items-center justify-center font-bold"
                    >
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ADAPTIVE LEARNING TAB ================= */}
        <TabsContent value="adaptive" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Students Needing Help */}
            <Card className="rounded-2xl border-muted shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> Students Needing Help
                </CardTitle>
                <CardDescription className="text-xs">Students with the lowest average accuracy in mock tests/practice.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Tests</TableHead>
                      <TableHead className="text-right">Avg Accuracy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adaptiveStats?.studentsNeedingHelp?.length > 0 ? (
                      adaptiveStats.studentsNeedingHelp.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="py-2.5">
                            <p className="font-bold text-xs">{student.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{student.email}</p>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">{student.totalTests}</TableCell>
                          <TableCell className="py-2.5 text-right font-bold text-xs text-rose-600">
                            {Math.round(student.avgAccuracy * 10) / 10}%
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No students needing help detected.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Most Improved Students */}
            <Card className="rounded-2xl border-muted shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Most Improved Students
                </CardTitle>
                <CardDescription className="text-xs">Students whose accuracy improved most in the last 7 days.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Recent Accuracy</TableHead>
                      <TableHead className="text-right">Improvement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adaptiveStats?.mostImprovedStudents?.length > 0 ? (
                      adaptiveStats.mostImprovedStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="py-2.5">
                            <p className="font-bold text-xs">{student.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{student.email}</p>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-semibold">{Math.round(student.recentAccuracy * 10) / 10}%</TableCell>
                          <TableCell className="py-2.5 text-right font-bold text-xs text-emerald-600">
                            +{student.improvement}%
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No improvement trends detected yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Most Difficult Topics */}
            <Card className="rounded-2xl border-muted shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BookMarked className="h-4 w-4 text-indigo-500" /> Most Difficult Topics
                </CardTitle>
                <CardDescription className="text-xs">Topics with the lowest aggregate practice accuracy across all students.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Avg Accuracy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adaptiveStats?.mostDifficultTopics?.length > 0 ? (
                      adaptiveStats.mostDifficultTopics.map((topic: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="py-2.5 text-xs font-semibold">{topic.topicName}</TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">{topic.subjectName}</TableCell>
                          <TableCell className="py-2.5 text-right font-bold text-xs text-rose-600">
                            {Math.round(topic.avgAccuracy * 10) / 10}%
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No difficult topics analyzed.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Collections with Lowest Completion */}
            <Card className="rounded-2xl border-muted shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" /> Collections with Lowest Completion
                </CardTitle>
                <CardDescription className="text-xs">Question collections with lowest completion rates on average.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collection</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead className="text-right">Completion Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adaptiveStats?.collectionsLowestCompletion?.length > 0 ? (
                      adaptiveStats.collectionsLowestCompletion.map((col: any) => (
                        <TableRow key={col.id}>
                          <TableCell className="py-2.5 text-xs font-semibold">{col.name}</TableCell>
                          <TableCell className="py-2.5 text-xs">{col.attemptsCount}</TableCell>
                          <TableCell className="py-2.5 text-right font-bold text-xs text-amber-600">
                            {Math.round(col.completionRate * 10) / 10}%
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No collections completion data analyzed.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Least Active Students */}
          <Card className="rounded-2xl border-muted shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" /> Least Active Students
              </CardTitle>
              <CardDescription className="text-xs">Students with the fewest mock tests submitted in the last 14 days.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Attempts (14 days)</TableHead>
                    <TableHead className="text-right">Total Attempts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adaptiveStats?.leastActiveStudents?.length > 0 ? (
                    adaptiveStats.leastActiveStudents.map((student: any) => (
                      <TableRow key={student.id}>
                        <TableCell className="py-2.5 text-xs font-bold">{student.name}</TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">{student.email}</TableCell>
                        <TableCell className="py-2.5 text-xs font-semibold text-rose-500">{student.recentTests}</TableCell>
                        <TableCell className="py-2.5 text-right text-xs">{student.totalTests}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">No inactivity records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gamification" className="space-y-6 mt-0">
          <GamificationConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
