import { useGetAdminStats, getGetAdminStatsQueryKey, useListSubjects, useListTopics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Database, Activity, TrendingUp, CheckCircle, Hash, Layers, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: stats, isLoading, dataUpdatedAt } = useGetAdminStats({
    query: {
      queryKey: getGetAdminStatsQueryKey(),
      refetchInterval: 30_000, // auto-refresh every 30 seconds
    }
  });

  const { data: subjects } = useListSubjects();
  const { data: topics } = useListTopics({});

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      sub: `${stats.activeUsers} active`,
      icon: Users,
      color: 'bg-primary text-primary-foreground',
    },
    {
      title: 'Total Exams',
      value: stats.totalExams.toLocaleString(),
      sub: `${stats.publishedExams} published`,
      icon: FileText,
      color: 'bg-card',
    },
    {
      title: 'Question Bank',
      value: stats.totalQuestions.toLocaleString(),
      sub: 'Available for tests',
      icon: Database,
      color: 'bg-card',
    },
    {
      title: 'Test Sessions',
      value: stats.totalSessions.toLocaleString(),
      sub: 'Total attempts',
      icon: Activity,
      color: 'bg-card',
    },
    {
      title: 'Subjects',
      value: (subjects ?? []).length.toString(),
      sub: `${(topics ?? []).length} topics`,
      icon: Hash,
      color: 'bg-card',
    },
    {
      title: 'New This Week',
      value: stats.newUsersThisWeek.toLocaleString(),
      sub: 'User registrations',
      icon: TrendingUp,
      color: 'bg-card',
    },
  ];

  // Chart data built from real stats
  const overviewData = [
    { name: 'Users', value: stats.totalUsers },
    { name: 'Exams', value: stats.totalExams },
    { name: 'Questions', value: stats.totalQuestions },
    { name: 'Sessions', value: stats.totalSessions },
  ];

  const quickLinks = [
    { label: 'Manage Exams', href: '/admin/exams', icon: FileText },
    { label: 'Question Bank', href: '/admin/questions', icon: Database },
    { label: 'Subjects & Topics', href: '/admin/subjects', icon: Hash },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Notes & PDFs', href: '/admin/notes', icon: Layers },
    { label: 'Current Affairs', href: '/admin/current-affairs', icon: TrendingUp },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Auto-refreshes every 30s · Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className={card.color === 'bg-primary text-primary-foreground' ? 'border-0 shadow-md bg-primary text-primary-foreground' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-90' : 'text-muted-foreground'}`}>
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-75' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className={`text-xs mt-1 ${card.color === 'bg-primary text-primary-foreground' ? 'opacity-80' : 'text-muted-foreground'}`}>{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3">
                  <link.icon className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">User Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Users</span><span className="font-semibold">{stats.totalUsers}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Active Users</span><span className="font-semibold text-green-600">{stats.activeUsers}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">New This Week</span><span className="font-semibold">{stats.newUsersThisWeek}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Exam Stats</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Exams</span><span className="font-semibold">{stats.totalExams}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Published</span><span className="font-semibold text-green-600">{stats.publishedExams}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Draft</span><span className="font-semibold">{stats.totalExams - stats.publishedExams}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Content Stats</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Questions</span><span className="font-semibold">{stats.totalQuestions}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subjects</span><span className="font-semibold">{(subjects ?? []).length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Topics</span><span className="font-semibold">{(topics ?? []).length}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
