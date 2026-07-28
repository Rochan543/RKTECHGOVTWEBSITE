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

// Admin Pages
import AdminDashboard from '@/pages/admin-dashboard';
import AdminExams from '@/pages/admin-exams';

const queryClient = new QueryClient();

// Auth Guard for routes
function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  
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

// Layout wrapper for Student/Admin standard pages
function DashboardRoute({ component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  return (
    <ProtectedRoute 
      adminOnly={adminOnly} 
      component={() => (
        <DashboardLayout>
          {component()}
        </DashboardLayout>
      )} 
    />
  );
}

function NotFound() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-xl mt-4 text-muted-foreground">Page Not Found</p>
      <a href="/login" className="mt-8 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        Go Home
      </a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Student Protected Routes (with DashboardLayout) */}
      <Route path="/dashboard">
        {() => <DashboardRoute component={Dashboard} />}
      </Route>
      <Route path="/exams">
        {() => <DashboardRoute component={Exams} />}
      </Route>
      <Route path="/exams/:id">
        {() => <DashboardRoute component={ExamDetail} />}
      </Route>
      <Route path="/results">
        {() => <DashboardRoute component={Results} />}
      </Route>
      <Route path="/results/:id">
        {() => <DashboardRoute component={ResultDetail} />}
      </Route>
      <Route path="/leaderboard">
        {() => <DashboardRoute component={Leaderboard} />}
      </Route>
      <Route path="/notes">
        {() => <DashboardRoute component={Notes} />}
      </Route>
      <Route path="/profile">
        {() => <DashboardRoute component={Profile} />}
      </Route>

      {/* Fullscreen Engine (No Layout) */}
      <Route path="/exam/:sessionId">
        {() => <ProtectedRoute component={ExamEngine} />}
      </Route>

      {/* Admin Protected Routes */}
      <Route path="/admin">
        {() => <DashboardRoute adminOnly component={AdminDashboard} />}
      </Route>
      <Route path="/admin/exams">
        {() => <DashboardRoute adminOnly component={AdminExams} />}
      </Route>
      
      {/* Fallback */}
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
