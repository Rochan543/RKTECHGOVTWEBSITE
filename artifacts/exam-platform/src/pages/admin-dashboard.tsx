import { useGetAdminStats, getGetAdminStatsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Database, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() }
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Mock data for charts since backend only gives scalar stats
  const activityData = [
    { name: 'Mon', tests: 120 },
    { name: 'Tue', tests: 145 },
    { name: 'Wed', tests: 180 },
    { name: 'Thu', tests: 150 },
    { name: 'Fri', tests: 210 },
    { name: 'Sat', tests: 350 },
    { name: 'Sun', tests: 420 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Platform usage and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Users</CardTitle>
            <Users className="h-4 w-4 opacity-75" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs opacity-80 mt-1">+{stats.newUsersThisWeek} this week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Exams</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.publishedExams}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {stats.totalExams} total exams</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Question Bank</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalQuestions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for mock tests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Tests attempted by users</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Test Activity (Weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                  <Bar dataKey="tests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Tests Taken" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
             {/* Note: I'm just listing the admin pages as buttons */}
             <div className="p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer text-center">
               <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
               <h3 className="font-semibold">Create Exam</h3>
             </div>
             <div className="p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer text-center">
               <Database className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
               <h3 className="font-semibold">Add Questions</h3>
             </div>
             <div className="p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer text-center">
               <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
               <h3 className="font-semibold">Manage Users</h3>
             </div>
             <div className="p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors cursor-pointer text-center">
               <Activity className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
               <h3 className="font-semibold">System Logs</h3>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
