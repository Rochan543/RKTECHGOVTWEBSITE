import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useParams, Link } from 'wouter';
import {
  ChevronLeft,
  Award,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  MinusCircle,
  TrendingUp,
  BookOpen,
  PieChart,
  BarChart2
} from 'lucide-react';

interface PracticeResultsResponse {
  session: {
    id: number;
    mode: 'timed' | 'untimed';
    status: string;
    startedAt: string;
    completedAt: string;
    score: number;
    accuracy: number;
    timeTakenSeconds: number;
    totalQuestions: number;
  };
  stats: {
    attempted: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    timeTakenSeconds: number;
    averageTimeSeconds: number;
    score: number;
  };
  difficultyBreakdown: Record<string, { total: number; correct: number; attempted: number }>;
  subjectBreakdown: Record<string, { total: number; correct: number; attempted: number }>;
  topicBreakdown: Record<string, { total: number; correct: number; attempted: number }>;
}

export default function PracticeResults() {
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = parseInt(sessionIdParam || '0', 10);

  const { data, isLoading } = useQuery<PracticeResultsResponse>({
    queryKey: ['practice-results', sessionId],
    queryFn: () => customFetch(`/api/v1/practice/sessions/${sessionId}/results`),
    enabled: !!sessionId,
  });

  if (isLoading || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const { session, stats, difficultyBreakdown, subjectBreakdown, topicBreakdown } = data;

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return hrs > 0
      ? `${hrs} hr ${mins} min ${secs} sec`
      : `${mins} min ${secs} sec`;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* Back link */}
      <div>
        <Button variant="ghost" asChild className="pl-0 text-muted-foreground hover:text-foreground">
          <Link href="/practice">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Practice Dashboard
          </Link>
        </Button>
      </div>

      {/* Main header block */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border border-indigo-100 dark:border-indigo-950/40">
          <Award className="h-10 w-10 animate-bounce" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">Practice Performance Analysis</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Review your stats for the {session.mode} practice set completed on {new Date(session.completedAt).toLocaleDateString()}.
        </p>
      </div>

      {/* Core Metrics Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {/* Attempted */}
        <Card className="border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-indigo-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase leading-none">Attempted</p>
              <h3 className="text-xl font-bold text-foreground mt-1.5 leading-none">{stats.attempted} / {session.totalQuestions}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Correct */}
        <Card className="border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase leading-none">Correct</p>
              <h3 className="text-xl font-bold text-foreground mt-1.5 leading-none">{stats.correct} Qs</h3>
            </div>
          </CardContent>
        </Card>

        {/* Accuracy */}
        <Card className="border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase leading-none">Accuracy</p>
              <h3 className="text-xl font-bold text-foreground mt-1.5 leading-none">{Math.round(stats.accuracy)}%</h3>
            </div>
          </CardContent>
        </Card>

        {/* Time Taken */}
        <Card className="border shadow-xs bg-card">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-xl text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase leading-none">Time Taken</p>
              <h3 className="text-sm font-bold text-foreground mt-1.5 leading-none">{formatTime(stats.timeTakenSeconds)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Difficulty breakdown & speed stats */}
        <div className="space-y-6">
          {/* Difficulty breakdown */}
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <BarChart2 className="h-4.5 w-4.5 text-indigo-500" /> Difficulty breakdown
              </CardTitle>
              <CardDescription className="text-[10px]">Your performance categorized by question complexity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['easy', 'medium', 'hard'].map((diff) => {
                const item = difficultyBreakdown[diff] || { total: 0, correct: 0, attempted: 0 };
                const pct = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;

                const color = {
                  easy: 'bg-green-500',
                  medium: 'bg-amber-500',
                  hard: 'bg-rose-500',
                }[diff];

                return (
                  <div key={diff} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="capitalize">{diff}</span>
                      <span className="text-muted-foreground">{item.correct} correct of {item.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Speed stats */}
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-indigo-500" /> Speed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground font-semibold">Average Time per Question</span>
                <span className="font-bold text-foreground">{stats.averageTimeSeconds} seconds</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground font-semibold">Total Practice Score</span>
                <span className="font-bold text-foreground">{stats.score} Marks</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground font-semibold">Skipped / Unattempted Questions</span>
                <span className="font-bold text-foreground">{stats.skipped} Qs</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Subject & Topic breakdown */}
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <PieChart className="h-4.5 w-4.5 text-indigo-500" /> Subject Breakdown
            </CardTitle>
            <CardDescription className="text-[10px]">Track subject strength based on accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(subjectBreakdown).map(([subName, item]) => {
              const pct = item.attempted > 0 ? Math.round((item.correct / item.attempted) * 100) : 0;

              return (
                <div key={subName} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="truncate max-w-[150px]">{subName}</span>
                    <span className="text-muted-foreground">{item.correct}/{item.attempted} correct ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(subjectBreakdown).length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No subject stats available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retake / Back Buttons */}
      <div className="flex gap-4 justify-center pt-4">
        <Button asChild variant="outline" className="rounded-xl h-11 px-6 text-xs font-bold">
          <Link href="/practice">Back to Dashboard</Link>
        </Button>
        <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl h-11 px-6 text-xs font-bold shadow-md">
          <Link href={`/practice/setup?type=random`}>Start Another Set</Link>
        </Button>
      </div>
    </div>
  );
}
