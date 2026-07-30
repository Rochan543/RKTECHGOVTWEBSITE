import React, { useState } from 'react';
import {
  useStudentAnalytics,
  useSubjectAnalytics,
  useTopicAnalytics,
  useCollectionAnalytics,
  usePracticeAnalytics,
  useExamAnalytics,
} from '@/hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Cell, Pie
} from 'recharts';
import {
  TrendingUp, Target, Clock, CheckCircle2, XCircle, Trophy, BookOpen, Flame,
  HelpCircle, Calendar, AlertTriangle, Lightbulb, ChevronRight, Bookmark, Ban, Zap
} from 'lucide-react';
import { 
  useListSubjects, 
  useListTopics, 
  useGetTimelineAnalytics, 
  getGetTimelineAnalyticsQueryKey, 
  useGetAiInsights, 
  getGetAiInsightsQueryKey 
} from '@workspace/api-client-react';

export default function Performance() {
  const [range, setRange] = useState<string>('last30days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [timelineRange, setTimelineRange] = useState<'7days' | '30days'>('7days');

  const { data: timelineData, isLoading: timelineLoading } = useGetTimelineAnalytics(
    { range: timelineRange },
    { query: { queryKey: getGetTimelineAnalyticsQueryKey({ range: timelineRange }) } }
  );

  const { data: aiInsights, isLoading: aiLoading } = useGetAiInsights({
    query: { queryKey: getGetAiInsightsQueryKey() }
  });

  const { data: subjects } = useListSubjects();
  const { data: topics } = useListTopics({
    subjectId: selectedSubject !== 'all' ? Number(selectedSubject) : undefined
  });

  // Construct filters
  const filters: Record<string, any> = {
    range,
    customStart: range === 'custom' ? startDate : undefined,
    customEnd: range === 'custom' ? endDate : undefined,
    subjectId: selectedSubject !== 'all' ? Number(selectedSubject) : undefined,
    topicId: selectedTopic !== 'all' ? Number(selectedTopic) : undefined,
    difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
  };

  // Queries
  const { data: stats, isLoading: statsLoading } = useStudentAnalytics(filters);
  const { data: subjectPerf, isLoading: subjectLoading } = useSubjectAnalytics(filters);
  const { data: topicPerf, isLoading: topicLoading } = useTopicAnalytics(filters);
  const { data: colPerf, isLoading: colLoading } = useCollectionAnalytics(filters);
  const { data: practicePerf, isLoading: practiceLoading } = usePracticeAnalytics(filters);
  const { data: examPerf, isLoading: examLoading } = useExamAnalytics(filters);

  const isLoading = statsLoading || subjectLoading || topicLoading || colLoading || practiceLoading || examLoading;

  const handleResetFilters = () => {
    setRange('last30days');
    setStartDate('');
    setEndDate('');
    setSelectedSubject('all');
    setSelectedTopic('all');
    setSelectedDifficulty('all');
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div>
        <div className="grid gap-6 md:grid-cols-2">{[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl" />)}</div>
      </div>
    );
  }

  // Color palette for charts
  const COLORS = ['hsl(var(--primary))', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Radar chart data
  const radarData = (subjectPerf ?? []).map((s) => ({
    subject: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    accuracy: Math.round(s.accuracy),
  }));

  // Pie chart data for difficulty distribution
  const difficultyPieData = [
    { name: 'Easy', value: stats.difficultyPerformance.easy.attempted, color: '#10B981' },
    { name: 'Medium', value: stats.difficultyPerformance.medium.attempted, color: '#F59E0B' },
    { name: 'Hard', value: stats.difficultyPerformance.hard.attempted, color: '#EF4444' },
  ].filter(d => d.value > 0);

  // Generate suggestions based on weakest areas
  const getSuggestions = () => {
    const list = [];
    if (stats.weakestSubject && stats.weakestSubject !== 'N/A') {
      list.push({
        title: `Strengthen ${stats.weakestSubject}`,
        desc: `Your accuracy in ${stats.weakestSubject} is relatively low. Re-attempt wrong answers in this subject.`,
        type: 'subject'
      });
    }
    if (stats.weakestTopic && stats.weakestTopic !== 'N/A') {
      list.push({
        title: `Revise ${stats.weakestTopic}`,
        desc: `Identify fundamental concepts in ${stats.weakestTopic} and review theory before attempting more questions.`,
        type: 'topic'
      });
    }
    if (stats.difficultyPerformance.hard.accuracy < 40 && stats.difficultyPerformance.hard.attempted > 0) {
      list.push({
        title: 'Master Hard Questions',
        desc: `Your accuracy on Hard difficulty questions is ${stats.difficultyPerformance.hard.accuracy}%. Try untimed practice to build confidence first.`,
        type: 'difficulty'
      });
    }
    if (list.length === 0) {
      list.push({
        title: 'Keep it up!',
        desc: 'Keep practicing to maintain your streak and further increase your speed and accuracy.',
        type: 'general'
      });
    }
    return list;
  };

  return (
    <div className="space-y-6 p-1 md:p-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">Performance Hub</h1>
          <p className="text-muted-foreground mt-1">Deep visual analytics of your exam preparation metrics</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
          <Flame className="h-4 w-4 fill-amber-500 text-amber-500 animate-bounce" />
          <span className="font-semibold">{stats.practiceStreak} Day Streak</span>
        </Badge>
      </div>

      {/* Filters Toolbar */}
      <Card className="border-muted bg-card/60 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Range */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Timeframe</label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="last90days">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Subject</label>
              <Select value={selectedSubject} onValueChange={(val) => { setSelectedSubject(val); setSelectedTopic('all'); }}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Subjects</SelectItem>
                  {(subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Topic</label>
              <Select value={selectedTopic} onValueChange={setSelectedTopic} disabled={selectedSubject === 'all'}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Topics</SelectItem>
                  {(topics ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Difficulty</label>
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset */}
            <div className="flex items-end justify-end md:justify-start">
              <button
                onClick={handleResetFilters}
                className="w-full h-9 rounded-xl border border-muted hover:bg-muted/50 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Custom Date Picker Range */}
          {range === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-dashed animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <Calendar className="h-4 w-4" /> Pick Dates:
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 rounded-lg border px-2.5 text-xs font-medium focus-visible:outline-primary bg-card"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 rounded-lg border px-2.5 text-xs font-medium focus-visible:outline-primary bg-card"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Premium Tabbed View */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="rounded-xl p-1 bg-muted/60 w-full overflow-x-auto flex-wrap h-auto md:w-max">
          <TabsTrigger value="overview" className="rounded-lg text-xs py-1.5 px-3">Overview</TabsTrigger>
          <TabsTrigger value="subjects" className="rounded-lg text-xs py-1.5 px-3">Subjects & Topics</TabsTrigger>
          <TabsTrigger value="practice" className="rounded-lg text-xs py-1.5 px-3">Practice Analytics</TabsTrigger>
          <TabsTrigger value="exams" className="rounded-lg text-xs py-1.5 px-3">Mock Test Analytics</TabsTrigger>
          <TabsTrigger value="wrong" className="rounded-lg text-xs py-1.5 px-3">Wrong Answers & Revision</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg text-xs py-1.5 px-3">Timeline Trends</TabsTrigger>
          <TabsTrigger value="ai-insights" className="rounded-lg text-xs py-1.5 px-3">AI Insights & Exports</TabsTrigger>
        </TabsList>

        {/* ================= OVERVIEW TAB ================= */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          {/* Quick Metrics Grid */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Accuracy</p>
                  <p className="text-3xl font-extrabold mt-1.5 text-primary">{stats.overallAccuracy}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Mock tests + practice</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attempt Count</p>
                  <p className="text-3xl font-extrabold mt-1.5 text-emerald-500">{stats.questionsAttempted}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stats.correct} correct · {stats.wrong} wrong</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Time</p>
                  <p className="text-3xl font-extrabold mt-1.5 text-violet-500">{stats.studyTime} min</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total sessions duration</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-violet-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Time / Q</p>
                  <p className="text-3xl font-extrabold mt-1.5 text-amber-500">{stats.averageTimePerQuestion}s</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Speed performance indicator</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly progress */}
            <Card className="rounded-2xl shadow-sm border-muted">
              <CardHeader>
                <CardTitle className="text-base font-bold">Weekly Performance Trend</CardTitle>
                <CardDescription>Questions attempted vs accuracy (%)</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.weeklyProgress.length > 0 ? (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weeklyProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" fontSize={11} tickLine={false} />
                        <YAxis yAxisId="left" fontSize={11} tickLine={false} label={{ value: 'Questions', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} fontSize={11} tickLine={false} label={{ value: 'Accuracy %', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))' }} />
                        <Bar yAxisId="left" dataKey="attempted" fill="hsl(var(--primary))" opacity={0.8} radius={[3, 3, 0, 0]} name="Attempted" />
                        <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2.5} name="Accuracy %" dot={{ r: 4 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-muted-foreground text-xs font-semibold">
                    No weekly performance data found
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subject radar & Strengths */}
            <Card className="rounded-2xl shadow-sm border-muted">
              <CardHeader>
                <CardTitle className="text-base font-bold">Subject Accuracy breakdown</CardTitle>
                <CardDescription>Strength radar profile across primary subjects</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col md:flex-row items-center gap-4">
                {radarData.length > 0 ? (
                  <div className="h-[240px] w-full md:w-3/5">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 500 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} name="Accuracy %" />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[240px] w-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
                    No subject data yet
                  </div>
                )}

                <div className="w-full md:w-2/5 space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase">
                      <Trophy className="h-4 w-4" /> Strongest Subject
                    </div>
                    <p className="text-lg font-extrabold mt-1 text-emerald-950 dark:text-emerald-50">{stats.bestSubject}</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase">
                      <HelpCircle className="h-4 w-4" /> Weakest Subject
                    </div>
                    <p className="text-lg font-extrabold mt-1 text-amber-950 dark:text-amber-50">{stats.weakestSubject}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Difficulty breakdown & score trends */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Difficulty accuracy progress bars */}
            <Card className="rounded-2xl shadow-sm border-muted col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">Difficulty Performance</CardTitle>
                <CardDescription>Accuracy by difficulty level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: 'easy', label: 'Easy', color: 'bg-emerald-500', text: 'text-emerald-500' },
                  { key: 'medium', label: 'Medium', color: 'bg-amber-500', text: 'text-amber-500' },
                  { key: 'hard', label: 'Hard', color: 'bg-rose-500', text: 'text-rose-500' },
                ].map((item) => {
                  const d = stats.difficultyPerformance[item.key as 'easy' | 'medium' | 'hard'];
                  return (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} /> {item.label}
                        </span>
                        <span>{d.accuracy}% ({d.correct}/{d.attempted})</span>
                      </div>
                      <Progress value={d.accuracy} className="h-2 rounded-full" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Answer Distribution */}
            <Card className="rounded-2xl shadow-sm border-muted col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">Answer Distribution</CardTitle>
                <CardDescription>Overall correct vs incorrect ratio</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                {stats.questionsAttempted > 0 ? (
                  <div className="h-[160px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Correct', value: stats.correct },
                            { name: 'Incorrect', value: stats.wrong },
                            { name: 'Skipped', value: stats.skipped },
                          ]}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="#10B981" />
                          <Cell fill="#EF4444" />
                          <Cell fill="#F59E0B" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-extrabold">{stats.overallAccuracy}%</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">Accuracy</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-muted-foreground text-xs font-semibold">
                    No answer data yet
                  </div>
                )}
                <div className="flex justify-center gap-4 text-xs font-semibold mt-2">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Correct: {stats.correct}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Incorrect: {stats.wrong}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Skipped: {stats.skipped}</span>
                </div>
              </CardContent>
            </Card>

            {/* Practice vs mock tests counts */}
            <Card className="rounded-2xl shadow-sm border-muted col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">Preparation Split</CardTitle>
                <CardDescription>Mock tests vs custom practice sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-xl bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Trophy className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">Mock Exams</h4>
                      <p className="text-[10px] text-muted-foreground">Scheduled or quiz mock tests</p>
                    </div>
                  </div>
                  <span className="text-lg font-extrabold">{stats.mockTestsAttempted}</span>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-xl bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500">
                      <BookOpen className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">Practice Sessions</h4>
                      <p className="text-[10px] text-muted-foreground">Self-paced practice sets</p>
                    </div>
                  </div>
                  <span className="text-lg font-extrabold">{stats.practiceSessions}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= SUBJECTS TAB ================= */}
        <TabsContent value="subjects" className="space-y-6 mt-0">
          <Card className="rounded-2xl border-muted shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Subject Analytics</CardTitle>
              <CardDescription>Overview of accuracy, completion rate, and speed per subject</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-muted">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Subject Name</TableHead>
                      <TableHead className="font-bold text-xs text-center">Accuracy (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Questions Attempted</TableHead>
                      <TableHead className="font-bold text-xs text-center">Average Time / Q</TableHead>
                      <TableHead className="font-bold text-xs text-center">Completed Collections</TableHead>
                      <TableHead className="font-bold text-xs">Completion Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectPerf && subjectPerf.length > 0 ? (
                      subjectPerf.map((sub) => (
                        <TableRow key={sub.subjectId} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-bold text-xs">{sub.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${sub.accuracy >= 70 ? 'bg-emerald-500/10 text-emerald-500' : sub.accuracy >= 45 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'} hover:bg-transparent font-semibold border-0 text-xs py-0.5 rounded-lg`}>
                              {sub.accuracy}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium text-xs">{sub.questionsAttempted}</TableCell>
                          <TableCell className="text-center font-medium text-xs">{sub.averageTime}s</TableCell>
                          <TableCell className="text-center font-medium text-xs">{sub.collectionsCompleted}</TableCell>
                          <TableCell className="w-[180px]">
                            <div className="flex items-center gap-2">
                              <Progress value={sub.completionPercentage} className="h-1.5 flex-1 rounded-full" />
                              <span className="text-[10px] text-muted-foreground font-semibold min-w-8 text-right">{sub.completionPercentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs font-semibold">
                          No subject analytics recorded. Take a test or practice session to initialize.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Topic-wise mastery table */}
          <Card className="rounded-2xl border-muted shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Topic Mastery Analytics</CardTitle>
              <CardDescription>Granular performance and mastery percentage across all topics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-muted">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Topic Name</TableHead>
                      <TableHead className="font-bold text-xs">Parent Subject</TableHead>
                      <TableHead className="font-bold text-xs text-center">Attempt Count</TableHead>
                      <TableHead className="font-bold text-xs text-center">Correct (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Wrong (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Skipped (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Avg Time</TableHead>
                      <TableHead className="font-bold text-xs">Mastery Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topicPerf && topicPerf.length > 0 ? (
                      topicPerf.map((top) => (
                        <TableRow key={top.topicId} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-bold text-xs">{top.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">{top.subjectName}</TableCell>
                          <TableCell className="text-center font-medium text-xs">{top.attemptCount}</TableCell>
                          <TableCell className="text-center text-emerald-500 font-semibold text-xs">{top.correctPercentage}%</TableCell>
                          <TableCell className="text-center text-rose-500 font-semibold text-xs">{top.wrongPercentage}%</TableCell>
                          <TableCell className="text-center text-amber-500 font-semibold text-xs">{top.skippedPercentage}%</TableCell>
                          <TableCell className="text-center font-medium text-xs">{top.averageTime}s</TableCell>
                          <TableCell className="w-[150px]">
                            <div className="flex items-center gap-2">
                              <Progress value={top.masteryPercentage} className="h-1.5 flex-1 rounded-full" />
                              <span className="text-[10px] text-muted-foreground font-semibold min-w-8 text-right">{top.masteryPercentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-xs font-semibold">
                          No topic performance recorded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= PRACTICE TAB ================= */}
        <TabsContent value="practice" className="space-y-6 mt-0">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Practice Accuracy</p>
                <p className="text-2xl font-extrabold mt-1 text-primary">{practicePerf?.averageAccuracy || 0}%</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Practice Qs</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-500">{practicePerf?.dailyPractice || 0}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Practice Qs</p>
                <p className="text-2xl font-extrabold mt-1 text-violet-500">{practicePerf?.weeklyPractice || 0}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Practice Qs</p>
                <p className="text-2xl font-extrabold mt-1 text-amber-500">{practicePerf?.monthlyPractice || 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Best & Weakest Collections</CardTitle>
                <CardDescription>Comparison based on accuracy in completed practice sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-500">Best Performing Collection</span>
                    <h4 className="text-sm font-extrabold">{practicePerf?.bestCollection || 'N/A'}</h4>
                  </div>
                  <Badge className="bg-emerald-500 text-white rounded-lg">High Accuracy</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-rose-500/20 bg-rose-500/5 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-rose-500">Needs Work Collection</span>
                    <h4 className="text-sm font-extrabold">{practicePerf?.worstCollection || 'N/A'}</h4>
                  </div>
                  <Badge className="bg-rose-500 text-white rounded-lg">Low Accuracy</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Practice Speed Performance</CardTitle>
                <CardDescription>Average time taken per custom session</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                  <Clock className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold">{practicePerf ? Math.round(practicePerf.averageTime / 60) : 0} min</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Average practice session duration</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Collection wise analytics */}
          <Card className="rounded-2xl border-muted shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Practice Collections Analytics</CardTitle>
              <CardDescription>Student-wise accuracy, completion rates, and bookmark counts per question collection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-muted">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Collection Name</TableHead>
                      <TableHead className="font-bold text-xs text-center">Qs</TableHead>
                      <TableHead className="font-bold text-xs text-center">Completion Rate (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Average Score (%)</TableHead>
                      <TableHead className="font-bold text-xs text-center">Average Time</TableHead>
                      <TableHead className="font-bold text-xs text-center">Bookmarks</TableHead>
                      <TableHead className="font-bold text-xs text-center">Incorrect Attempts</TableHead>
                      <TableHead className="font-bold text-xs">Difficulty Split</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colPerf && colPerf.length > 0 ? (
                      colPerf.map((col) => (
                        <TableRow key={col.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-bold text-xs">
                            <div>
                              <span>{col.name}</span>
                              {col.description && <p className="text-[10px] text-muted-foreground font-normal mt-0.5 max-w-[200px] truncate">{col.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium text-xs">{col.questionCount}</TableCell>
                          <TableCell className="text-center font-medium text-xs">{col.completionRate}%</TableCell>
                          <TableCell className="text-center text-primary font-bold text-xs">{col.averageScore}%</TableCell>
                          <TableCell className="text-center font-medium text-xs">{col.averageTime}s</TableCell>
                          <TableCell className="text-center text-amber-500 font-semibold text-xs flex items-center justify-center gap-1">
                            <Bookmark className="h-3 w-3 fill-amber-500" /> {col.bookmarks}
                          </TableCell>
                          <TableCell className="text-center text-rose-500 font-semibold text-xs">{col.wrongAnswers}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-0 text-[10px] py-0 px-1 rounded">E: {col.difficultyDistribution.easy}</Badge>
                              <Badge className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-0 text-[10px] py-0 px-1 rounded">M: {col.difficultyDistribution.medium}</Badge>
                              <Badge className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-0 text-[10px] py-0 px-1 rounded">H: {col.difficultyDistribution.hard}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-xs font-semibold">
                          No collection practice logs recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= EXAMS TAB ================= */}
        <TabsContent value="exams" className="space-y-6 mt-0">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tests Taken</p>
                <p className="text-2xl font-extrabold mt-1 text-primary">{examPerf?.mockTestsAttempted || 0}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Score (%)</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-500">{examPerf?.averageMarks || 0}%</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Rank</p>
                <p className="text-2xl font-extrabold mt-1 text-violet-500">#{examPerf?.averageRank || 'N/A'}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Speed</p>
                <p className="text-2xl font-extrabold mt-1 text-amber-500">{examPerf ? Math.round(examPerf.averageTime / 60) : 0} min</p>
              </CardContent>
            </Card>
          </div>

          {/* Subject & Topic breakdown charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Subject breakdowns in Exams</CardTitle>
                <CardDescription>Accuracy achieved per subject in mock exams</CardDescription>
              </CardHeader>
              <CardContent>
                {examPerf && examPerf.subjectBreakdown.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={examPerf.subjectBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} />
                        <YAxis domain={[0, 100]} fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Accuracy %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-semibold">
                    No exam subject records found
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Mock Exams Difficulty split</CardTitle>
                <CardDescription>Accuracy and attempts grouped by difficulty level</CardDescription>
              </CardHeader>
              <CardContent>
                {examPerf && examPerf.difficultyBreakdown.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={examPerf.difficultyBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="difficulty" fontSize={11} tickLine={false} />
                        <YAxis domain={[0, 100]} fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="accuracy" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Accuracy %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-semibold">
                    No difficulty breakdown details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= WRONG ANSWERS TAB ================= */}
        <TabsContent value="wrong" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-3">
            {/* suggestions */}
            <Card className="rounded-2xl border-muted shadow-sm col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" /> Revision Suggestions
                </CardTitle>
                <CardDescription>Targeted revision strategies compiled from your weak areas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {getSuggestions().map((s, i) => (
                  <div key={i} className="flex gap-4 p-4 border rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold">{s.title}</h4>
                      <p className="text-xs text-muted-foreground font-medium">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Most Incorrect Topics/Subjects */}
            <Card className="rounded-2xl border-muted shadow-sm col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">Weak Areas</CardTitle>
                <CardDescription>Subjects & topics with most wrong answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Subject Level</h4>
                  <div className="flex items-center justify-between p-3 border rounded-xl bg-rose-500/5 border-rose-500/10">
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-50">{stats.weakestSubject || 'N/A'}</span>
                    <span className="text-xs font-bold text-rose-600 bg-rose-500/10 py-0.5 px-2 rounded-lg">Low Accuracy</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Topic Level</h4>
                  <div className="flex items-center justify-between p-3 border rounded-xl bg-rose-500/5 border-rose-500/10">
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-50">{stats.weakestTopic || 'N/A'}</span>
                    <span className="text-xs font-bold text-rose-600 bg-rose-500/10 py-0.5 px-2 rounded-lg">Mastery Deficit</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6 mt-0">
          <div className="flex justify-between items-center bg-card p-4 border rounded-2xl">
            <div>
              <h3 className="text-sm font-bold">Timeline Trend Analysis</h3>
              <p className="text-xs text-muted-foreground">Historical charts showing preparation metrics over time</p>
            </div>
            <Tabs value={timelineRange} onValueChange={(v: any) => setTimelineRange(v)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2 rounded-xl h-8 p-1">
                <TabsTrigger value="7days" className="rounded-lg text-xs font-bold py-1">7 Days</TabsTrigger>
                <TabsTrigger value="30days" className="rounded-lg text-xs font-bold py-1">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {timelineLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="h-64 rounded-2xl animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : timelineData && timelineData.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Accuracy Trend */}
              <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Accuracy Trend (%)</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={9} tickLine={false} />
                        <YAxis domain={[0, 100]} fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Study Hours Trend */}
              <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Daily Study Hours</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={9} tickLine={false} />
                        <YAxis fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="hours" fill="#8B5CF6" radius={[3, 3, 0, 0]} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Question Speed Trend */}
              <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Solving Speed (seconds/question)</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={9} tickLine={false} />
                        <YAxis fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="speed" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Attempts vs Revision Trend */}
              <Card className="rounded-2xl border-slate-200/60 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Attempts vs Revision Questions</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={9} tickLine={false} />
                        <YAxis fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="attempts" fill="hsl(var(--primary))" name="Attempts" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="revision" fill="#EF4444" name="Revision" stackId="a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border border-slate-200/60 dark:border-slate-800 bg-card rounded-2xl text-muted-foreground">
              <Calendar className="h-10 w-10 mb-2 opacity-35" />
              <p className="text-xs font-bold">No timeline trend records found.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-3">
            {/* AI insights panel */}
            <Card className="md:col-span-2 border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-500" /> AI Diagnostic Feedback
                </CardTitle>
                <CardDescription className="text-xs">Machine-learning generated performance diagnosis</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-5 pt-2">
                {aiLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-20 bg-muted/40 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : aiInsights ? (
                  <div className="space-y-6">
                    {/* Read Readiness Index */}
                    <div className="bg-indigo-500/10 p-5 rounded-2xl border border-indigo-500/20 text-indigo-950 dark:text-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Projected SSC Exam Readiness</h4>
                        <p className="text-3xl font-black mt-2">{aiInsights?.expectedExamReadiness}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Evaluated based on difficulty handling speed and accuracy margins.</p>
                      </div>
                      <div className="bg-indigo-600 text-white font-black text-xl py-3.5 px-6 rounded-2xl shadow">
                        Ready
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 border rounded-xl space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Strengths & Core Competencies</span>
                        <ul className="space-y-1.5 pt-1.5">
                          {aiInsights?.strengths?.map((str: string, i: number) => (
                            <li key={i} className="text-xs font-bold text-slate-700 dark:text-slate-300">• {str}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 border rounded-xl space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Weaknesses & Attention Zones</span>
                        <ul className="space-y-1.5 pt-1.5">
                          {aiInsights?.weaknesses?.map((w: string, i: number) => (
                            <li key={i} className="text-xs font-bold text-slate-700 dark:text-slate-300">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* AI Revision Advice */}
                    <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revision Advice & Syllabus Mastery</span>
                      <p className="text-xs mt-2 text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">{aiInsights?.revisionAdvice}</p>
                    </div>

                    <div className="border-t pt-4 grid gap-4 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-muted-foreground font-semibold">Recommended Focus Subjects</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {aiInsights?.recommendedSubjects?.map((sub: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">{sub}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-semibold">Best Solved Hours Zone</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{aiInsights?.bestTimeToStudy}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">Not enough analytics data to construct advice.</div>
                )}
              </CardContent>
            </Card>

            {/* Print & Reports panel */}
            <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" /> Export & Reports
                </CardTitle>
                <CardDescription className="text-xs">Download study reports and attempt logs</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 pt-2">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Print PDF Layouts</p>
                <div className="grid gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs font-bold rounded-xl h-10 border-slate-200/60 dark:border-slate-800 flex justify-between"
                    onClick={() => window.open('/api/v1/exports/pdf/mock-history', '_blank')}
                  >
                    <span>Print Performance Report</span>
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-[9px]">PDF Layout</Badge>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full text-xs font-bold rounded-xl h-10 border-slate-200/60 dark:border-slate-800 flex justify-between"
                    onClick={() => window.open('/api/v1/exports/pdf/current-affairs-summary', '_blank')}
                  >
                    <span>Print Current Affairs Report</span>
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[9px]">PDF Layout</Badge>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full text-xs font-bold rounded-xl h-10 border-slate-200/60 dark:border-slate-800 flex justify-between"
                    onClick={() => window.open('/api/v1/exports/pdf/study-plan', '_blank')}
                  >
                    <span>Print Study Plan & Calendar</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[9px]">PDF Layout</Badge>
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-4 mb-1">Spreadsheet Data Exports</p>
                <div className="grid gap-2">
                  <Button 
                    variant="secondary" 
                    className="w-full text-xs font-bold rounded-xl h-10 flex justify-between"
                    onClick={() => window.location.href = '/api/v1/exports/csv/practice-history'}
                  >
                    <span>Export Practice Logs</span>
                    <span className="text-[9px] opacity-75 font-semibold">CSV Format</span>
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full text-xs font-bold rounded-xl h-10 flex justify-between"
                    onClick={() => window.location.href = '/api/v1/exports/csv/revision-history'}
                  >
                    <span>Export Revision Records</span>
                    <span className="text-[9px] opacity-75 font-semibold">CSV Format</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
