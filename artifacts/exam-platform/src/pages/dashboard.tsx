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
import { Link } from 'wouter';

export default function Dashboard() {
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
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground mt-2">Here's your preparation summary.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium opacity-90">All India Rank</CardTitle>
              <Trophy className="h-4 w-4 opacity-75" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.currentRank ? `#${stats.currentRank}` : 'N/A'}</div>
              <p className="text-xs opacity-80 mt-1">Keep practicing to improve!</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tests Taken</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.totalTestsTaken}</div>
              <p className="text-xs text-muted-foreground mt-1">+{stats.testsThisWeek} this week</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Accuracy</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.overallAccuracy.toFixed(1)}%</div>
              <div className="w-full bg-secondary h-2 mt-2 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full" style={{ width: `${stats.overallAccuracy}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</div>
              <p className="text-xs text-muted-foreground mt-1">Total time spent</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Subject Performance</CardTitle>
            <CardDescription>Your accuracy across different subjects</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading ? (
              <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
            ) : subjectPerf && subjectPerf.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerf} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="subjectName" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{fill: 'hsl(var(--muted))'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                    />
                    <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Accuracy (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p>Not enough data to generate chart.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Strengths & Weaknesses</CardTitle>
            <CardDescription>Radar view of your capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading ? (
              <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
            ) : subjectPerf && subjectPerf.length > 2 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectPerf}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subjectName" fontSize={11} tick={{ fill: 'hsl(var(--foreground))' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p>Take tests in at least 3 subjects to see radar.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest test attempts</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/results">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                    <div>
                      <h4 className="font-medium">{item.examTitle}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{item.score} / {item.totalMarks}</div>
                      <div className="text-xs text-muted-foreground">{item.accuracy.toFixed(1)}% Acc.</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <Target className="h-12 w-12 mb-4 opacity-20" />
                <p>No recent activity.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/exams">Take a Test</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Upcoming Scheduled Tests</CardTitle>
            <CardDescription>Don't miss these live mocks</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingLoading ? (
               <div className="space-y-4">
                 {[...Array(3)].map((_, i) => (
                   <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                 ))}
               </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-4">
                {upcoming.map((test) => (
                  <div key={test.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm leading-tight">{test.title}</h4>
                      <span className="text-[10px] uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-1 rounded-full font-semibold">
                        {test.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center"><Clock className="mr-1 h-3 w-3" /> {test.durationMinutes} mins</span>
                      <span className="flex items-center"><Target className="mr-1 h-3 w-3" /> {test.questionCount} Qs</span>
                    </div>
                    <Button size="sm" className="w-full" asChild>
                      <Link href={`/exams/${test.id}`}>Details</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <Clock className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-center">No tests scheduled.<br/>Browse the test series.</p>
                <Button variant="outline" className="mt-4 w-full" asChild>
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
