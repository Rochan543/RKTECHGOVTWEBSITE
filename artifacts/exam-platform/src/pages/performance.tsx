import { useGetSubjectPerformance, useListResults, useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Clock, CheckCircle2, XCircle, Trophy } from 'lucide-react';

export default function Performance() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: subjectPerf, isLoading: subjectLoading } = useGetSubjectPerformance();
  const { data: resultsData, isLoading: resultsLoading } = useListResults({ page: 1, limit: 50 });

  const results = resultsData?.data ?? [];

  // Build trend data from results
  const trendData = results.slice(-10).reverse().map((r, i) => ({
    attempt: `#${i + 1}`,
    score: Math.round((r.score / r.totalMarks) * 100),
    accuracy: r.accuracy,
  }));

  // Subject performance for radar
  const radarData = (subjectPerf ?? []).map((s: { subjectName: string; accuracy: number }) => ({
    subject: s.subjectName.length > 10 ? s.subjectName.slice(0, 10) + '…' : s.subjectName,
    accuracy: Math.round(s.accuracy),
  }));

  // Aggregate stats
  const totalCorrect = results.reduce((s, r) => s + r.correct, 0);
  const totalIncorrect = results.reduce((s, r) => s + r.incorrect, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const totalTime = results.reduce((s, r) => s + r.timeTakenSeconds, 0);

  if (statsLoading || subjectLoading || resultsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div>
        <div className="grid gap-6 md:grid-cols-2">{[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep dive into your preparation progress</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Avg Score</p>
                <p className="text-3xl font-bold mt-1">{stats?.averageScore.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Correct Answers</p>
                <p className="text-3xl font-bold mt-1 text-green-500">{totalCorrect}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Wrong Answers</p>
                <p className="text-3xl font-bold mt-1 text-red-500">{totalIncorrect}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Study Time</p>
                <p className="text-3xl font-bold mt-1">{Math.round(totalTime / 3600)}h</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Score trend */}
        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Your last 10 attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="attempt" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Take a test to see your trend</div>
            )}
          </CardContent>
        </Card>

        {/* Subject radar */}
        <Card>
          <CardHeader>
            <CardTitle>Subject Mastery</CardTitle>
            <CardDescription>Accuracy by subject</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No subject data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Accuracy breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Answer Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Correct', value: totalCorrect, total: totalCorrect + totalIncorrect + totalSkipped, color: 'bg-green-500' },
              { label: 'Wrong', value: totalIncorrect, total: totalCorrect + totalIncorrect + totalSkipped, color: 'bg-red-500' },
              { label: 'Skipped', value: totalSkipped, total: totalCorrect + totalIncorrect + totalSkipped, color: 'bg-yellow-500' },
            ].map((item) => {
              const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.value} ({pct}%)</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Subject performance bars */}
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            {(subjectPerf ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={(subjectPerf ?? []).map((s: { subjectName: string; accuracy: number }) => ({ name: s.subjectName.slice(0, 12), accuracy: Math.round(s.accuracy) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
