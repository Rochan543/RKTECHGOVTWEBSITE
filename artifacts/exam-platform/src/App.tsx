import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, useAuth } from '@/lib/auth';

// Layouts
import { DashboardLayout } from '@/components/layout';

// Pages
import Login from '@/pages/login';
import Register from '@/pages/register';
import ForgotPassword from '@/pages/forgot-password';
import Dashboard from '@/pages/dashboard';
import Exams from '@/pages/exams';
import ExamDetail from '@/pages/exam-detail';
import ExamEngine from '@/pages/exam-engine';
import Results from '@/pages/results';
import ResultDetail from '@/pages/result-detail';
import Leaderboard from '@/pages/leaderboard';
import Notes from '@/pages/notes';
import Profile from '@/pages/profile';
import Notifications from '@/pages/notifications';
import Performance from '@/pages/performance';
import Practice from '@/pages/practice';
import WrongAnswers from '@/pages/wrong-answers';
import Bookmarks from '@/pages/bookmarks';
import Settings from '@/pages/settings';
import DailyGK from '@/pages/daily-gk';
import Achievements from '@/pages/achievements';

// Admin Pages
import AdminDashboard from '@/pages/admin-dashboard';
import AdminExams from '@/pages/admin-exams';
import AdminQuestions from '@/pages/admin-questions';
import AdminSubjects from '@/pages/admin-subjects';
import AdminUsers from '@/pages/admin-users';
import AdminNotes from '@/pages/admin-notes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  if (adminOnly && user.role !== 'admin' && user.role !== 'super_admin') {
    window.location.href = '/dashboard';
    return null;
  }

  return <Component />;
}

function DashboardRoute({ component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  return (
    <ProtectedRoute
      adminOnly={adminOnly}
      component={() => (
        <DashboardLayout>
          {React.createElement(component)}
        </DashboardLayout>
      )}
    />
  );
}

import React from 'react';

function NotFound() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
      <div className="text-8xl font-bold text-muted/30">404</div>
      <h1 className="text-2xl font-bold mt-4">Page Not Found</h1>
      <p className="text-muted-foreground mt-2">The page you're looking for doesn't exist.</p>
      <a href="/dashboard" className="mt-8 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors">
        Go to Dashboard
      </a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Student */}
      <Route path="/dashboard">{() => <DashboardRoute component={Dashboard} />}</Route>
      <Route path="/exams">{() => <DashboardRoute component={Exams} />}</Route>
      <Route path="/exams/:id">{() => <DashboardRoute component={ExamDetail} />}</Route>
      <Route path="/results">{() => <DashboardRoute component={Results} />}</Route>
      <Route path="/results/:id">{() => <DashboardRoute component={ResultDetail} />}</Route>
      <Route path="/leaderboard">{() => <DashboardRoute component={Leaderboard} />}</Route>
      <Route path="/notes">{() => <DashboardRoute component={Notes} />}</Route>
      <Route path="/profile">{() => <DashboardRoute component={Profile} />}</Route>
      <Route path="/notifications">{() => <DashboardRoute component={Notifications} />}</Route>
      <Route path="/performance">{() => <DashboardRoute component={Performance} />}</Route>
      <Route path="/practice">{() => <DashboardRoute component={Practice} />}</Route>
      <Route path="/wrong-answers">{() => <DashboardRoute component={WrongAnswers} />}</Route>
      <Route path="/bookmarks">{() => <DashboardRoute component={Bookmarks} />}</Route>
      <Route path="/settings">{() => <DashboardRoute component={Settings} />}</Route>
      <Route path="/daily-gk">{() => <DashboardRoute component={DailyGK} />}</Route>
      <Route path="/achievements">{() => <DashboardRoute component={Achievements} />}</Route>

      {/* Fullscreen Exam Engine */}
      <Route path="/exam/:sessionId">{() => <ProtectedRoute component={ExamEngine} />}</Route>

      {/* Admin */}
      <Route path="/admin">{() => <DashboardRoute adminOnly component={AdminDashboard} />}</Route>
      <Route path="/admin/exams">{() => <DashboardRoute adminOnly component={AdminExams} />}</Route>
      <Route path="/admin/questions">{() => <DashboardRoute adminOnly component={AdminQuestions} />}</Route>
      <Route path="/admin/subjects">{() => <DashboardRoute adminOnly component={AdminSubjects} />}</Route>
      <Route path="/admin/users">{() => <DashboardRoute adminOnly component={AdminUsers} />}</Route>
      <Route path="/admin/notes">{() => <DashboardRoute adminOnly component={AdminNotes} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="exam-platform-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
