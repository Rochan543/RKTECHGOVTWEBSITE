import { useState, useEffect } from 'react';
import { 
  useGetDashboardStats, 
  getGetDashboardStatsQueryKey,
  useGetUpcomingTests,
  getGetUpcomingTestsQueryKey,
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
  useGetSubjectPerformance,
  getGetSubjectPerformanceQueryKey
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, Target, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });
  const { data: upcoming, isLoading: upcomingLoading } = useGetUpcomingTests({
    query: { queryKey: getGetUpcomingTestsQueryKey() }
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });
  const { data: subjectPerf, isLoading: subjectLoading } = useGetSubjectPerformance({
    query: { queryKey: getGetSubjectPerformanceQueryKey() }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Welcome back!</h1>
        <p className="text-muted-foreground mt-1 text-sm">Here's your preparation summary.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-slate-200/40" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary via-indigo-600 to-indigo-700 text-primary-foreground shadow-lg border-0 transition-transform duration-300 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-90">All India Rank</CardTitle>
              <Trophy className="h-4 w-4 opacity-75" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.currentRank ? `#${stats.currentRank}` : 'N/A'}</div>
              <p className="text-[10px] opacity-85 mt-1 font-medium">Keep practicing to improve!</p>
            </CardContent>
          </Card>
          
          <Card className="transition-transform duration-300 hover:-translate-y-0.5 border border-slate-200/60 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tests Taken</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.totalTestsTaken}</div>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">+{stats.testsThisWeek} this week</p>
            </CardContent>
          </Card>
          
          <Card className="transition-transform duration-300 hover:-translate-y-0.5 border border-slate-200/60 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall Accuracy</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.overallAccuracy.toFixed(1)}%</div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 mt-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${stats.overallAccuracy}%` }} />
              </div>
            </CardContent>
          </Card>
          
          <Card className="transition-transform duration-300 hover:-translate-y-0.5 border border-slate-200/60 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</div>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">Total time spent preparing</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border border-slate-200/60 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Subject Performance</CardTitle>
            <CardDescription className="text-xs">Your accuracy across different subjects</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading || !mounted ? (
              <div className="h-[300px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-xl animate-pulse" />
            ) : subjectPerf && subjectPerf.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerf} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="subjectName" axisLine={false} tickLine={false} fontSize={10} tickMargin={10} stroke="hsl(var(--muted-foreground))" />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Accuracy (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">Not enough data to generate chart.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border border-slate-200/60 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Strengths & Weaknesses</CardTitle>
            <CardDescription className="text-xs">Radar view of your capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading || !mounted ? (
              <div className="h-[300px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-xl animate-pulse" />
            ) : subjectPerf && subjectPerf.length > 2 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectPerf}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subjectName" fontSize={9} tick={{ fill: 'hsl(var(--foreground))' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={9} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">Radar view unavailable</p>
                <p className="text-[10px] text-muted-foreground mt-1">Take tests in at least 3 subjects to analyze strengths.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col border border-slate-200/60 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Recent Activity</CardTitle>
              <CardDescription className="text-xs">Your latest test attempts</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs font-bold">
              <Link href="/results">View All <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse border border-slate-200/40" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-card hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-300">
                    <div>
                      <h4 className="font-bold text-xs leading-tight text-foreground">{item.examTitle}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(item.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-primary">{item.score} / {item.totalMarks}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{item.accuracy.toFixed(1)}% Acc.</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <Target className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-semibold">No recent activity</p>
                <Button variant="outline" className="mt-4 h-8 text-xs font-bold" asChild>
                  <Link href="/exams">Take a Test</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border border-slate-200/60 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Upcoming Scheduled Tests</CardTitle>
            <CardDescription className="text-xs">Don't miss these live mocks</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingLoading ? (
               <div className="space-y-4">
                 {[...Array(3)].map((_, i) => (
                   <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse border border-slate-200/40" />
                 ))}
               </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((test) => (
                  <div key={test.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-card hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-xs leading-tight text-foreground line-clamp-1">{test.title}</h4>
                      <Badge variant="secondary" className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 font-bold rounded-lg whitespace-nowrap">
                        {test.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-3 font-medium">
                      <span className="flex items-center"><Clock className="mr-1 h-3 w-3" /> {test.durationMinutes} mins</span>
                      <span className="flex items-center"><Target className="mr-1 h-3 w-3" /> {test.questionCount} Qs</span>
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs font-bold" asChild>
                      <Link href={`/exams/${test.id}`}>Start Details</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 text-center p-4">
                <Clock className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-semibold">No tests scheduled</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Check back later or browse standard test series.</p>
                <Button variant="outline" className="mt-4 w-full h-8 text-xs font-bold" asChild>
                  <Link href="/exams">View Tests</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
