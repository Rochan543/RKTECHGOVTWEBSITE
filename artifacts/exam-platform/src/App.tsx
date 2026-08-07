import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, useAuth } from '@/lib/auth';
import Lottie from 'lottie-react';
import splashAnimation from '@/components/splash-animation.json';

// Layouts
import { DashboardLayout } from '@/components/layout';

// Pages (Static)
import Login from '@/pages/login';
import Register from '@/pages/register';
import ForgotPassword from '@/pages/forgot-password';

// Pages (Lazy)
const Dashboard = React.lazy(() => import('@/pages/dashboard'));
const Exams = React.lazy(() => import('@/pages/exams'));
const ScheduledExams = React.lazy(() => import('@/pages/scheduled-exams'));
const ExamDetail = React.lazy(() => import('@/pages/exam-detail'));
const ExamEngine = React.lazy(() => import('@/pages/exam-engine'));
const Results = React.lazy(() => import('@/pages/results'));
const ResultDetail = React.lazy(() => import('@/pages/result-detail'));
const Leaderboard = React.lazy(() => import('@/pages/leaderboard'));
const Notes = React.lazy(() => import('@/pages/notes'));
const Profile = React.lazy(() => import('@/pages/profile'));
const Notifications = React.lazy(() => import('@/pages/notifications'));
const Performance = React.lazy(() => import('@/pages/performance'));
const Practice = React.lazy(() => import('@/pages/practice'));
const WrongAnswers = React.lazy(() => import('@/pages/wrong-answers'));
const Bookmarks = React.lazy(() => import('@/pages/bookmarks'));
const Settings = React.lazy(() => import('@/pages/settings'));
const DailyGK = React.lazy(() => import('@/pages/daily-gk'));
const Achievements = React.lazy(() => import('@/pages/achievements'));
const PracticeSetup = React.lazy(() => import('@/pages/practice-setup'));
const PracticeSession = React.lazy(() => import('@/pages/practice-session'));
const PracticeResults = React.lazy(() => import('@/pages/practice-results'));

const CurrentAffairsDashboard = React.lazy(() => import('@/pages/current-affairs-dashboard'));
const CurrentAffairsArticle = React.lazy(() => import('@/pages/current-affairs-article'));
const CurrentAffairsQuiz = React.lazy(() => import('@/pages/current-affairs-quiz'));
const CurrentAffairsBookmarks = React.lazy(() => import('@/pages/current-affairs-bookmarks'));
const CurrentAffairsHistory = React.lazy(() => import('@/pages/current-affairs-history'));


// Admin Pages (Lazy)
const AdminDashboard = React.lazy(() => import('@/pages/admin-dashboard'));
const AdminExams = React.lazy(() => import('@/pages/admin-exams'));
const AdminExamForm = React.lazy(() => import('@/pages/admin-exam-form'));
const AdminQuestions = React.lazy(() => import('@/pages/admin-questions'));
const AdminSubjects = React.lazy(() => import('@/pages/admin-subjects'));
const AdminUsers = React.lazy(() => import('@/pages/admin-users'));
const AdminNotes = React.lazy(() => import('@/pages/admin-notes'));
const AdminCurrentAffairs = React.lazy(() => import('@/pages/admin-current-affairs'));
const AdminRepository = React.lazy(() => import('@/pages/admin-repository'));
const AdminCollectionDetails = React.lazy(() => import('@/pages/admin-collection-details'));
const AdminAdaptive = React.lazy(() => import('@/pages/admin-adaptive'));

// New Pages (Lazy)
const SuperAdmin = React.lazy(() => import('@/pages/super-admin'));
const Certificates = React.lazy(() => import('@/pages/certificates'));
const StudyPlanner = React.lazy(() => import('@/pages/study-planner'));
const AdaptiveLearning = React.lazy(() => import('@/pages/adaptive'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403 || error?.statusCode === 401 || error?.statusCode === 403) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  superAdminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) {
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

  // Permission hierarchy: super_admin ⊇ admin ⊇ student
  if (superAdminOnly && user.role !== 'super_admin') {
    window.location.href = '/dashboard';
    return null;
  }

  if (adminOnly && user.role !== 'admin' && user.role !== 'super_admin') {
    window.location.href = '/dashboard';
    return null;
  }

  return <Component />;
}

function DashboardRoute({
  component,
  adminOnly = false,
  superAdminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) {
  return (
    <ProtectedRoute
      adminOnly={adminOnly}
      superAdminOnly={superAdminOnly}
      component={() => (
        <DashboardLayout>
          {React.createElement(component)}
        </DashboardLayout>
      )}
    />
  );
}

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
      <Route path="/exams/scheduled">{() => <DashboardRoute component={ScheduledExams} />}</Route>
      <Route path="/exams/:id">{() => <DashboardRoute component={ExamDetail} />}</Route>
      <Route path="/exams">{() => <DashboardRoute component={Exams} />}</Route>
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
      <Route path="/current-affairs">{() => <DashboardRoute component={CurrentAffairsDashboard} />}</Route>
      <Route path="/current-affairs/articles/:id">{() => <DashboardRoute component={CurrentAffairsArticle} />}</Route>
      <Route path="/current-affairs/quiz/:id">{() => <DashboardRoute component={CurrentAffairsQuiz} />}</Route>
      <Route path="/current-affairs/bookmarks">{() => <DashboardRoute component={CurrentAffairsBookmarks} />}</Route>
      <Route path="/current-affairs/history">{() => <DashboardRoute component={CurrentAffairsHistory} />}</Route>

      {/* Practice Module */}
      <Route path="/practice/setup">{() => <DashboardRoute component={PracticeSetup} />}</Route>
      <Route path="/practice/session/:sessionId">{() => <ProtectedRoute component={PracticeSession} />}</Route>
      <Route path="/practice/results/:sessionId">{() => <DashboardRoute component={PracticeResults} />}</Route>

      {/* Fullscreen Exam Engine */}
      <Route path="/exam/:sessionId">{() => <ProtectedRoute component={ExamEngine} />}</Route>

      {/* Student extra pages */}
      <Route path="/certificates">{() => <DashboardRoute component={Certificates} />}</Route>
      <Route path="/study-planner">{() => <DashboardRoute component={StudyPlanner} />}</Route>
      <Route path="/adaptive">{() => <DashboardRoute component={AdaptiveLearning} />}</Route>

      {/* Admin */}
      <Route path="/admin">{() => <DashboardRoute adminOnly component={AdminDashboard} />}</Route>
      {/* More-specific exam routes MUST come before the generic /admin/exams list */}
      <Route path="/admin/exams/new">{() => <DashboardRoute adminOnly component={AdminExamForm} />}</Route>
      <Route path="/admin/exams/:id/edit">{() => <DashboardRoute adminOnly component={AdminExamForm} />}</Route>
      <Route path="/admin/exams">{() => <DashboardRoute adminOnly component={AdminExams} />}</Route>
      <Route path="/admin/questions">{() => <DashboardRoute adminOnly component={AdminQuestions} />}</Route>
      <Route path="/admin/repository">{() => <DashboardRoute adminOnly component={AdminRepository} />}</Route>
      <Route path="/admin/repository/subject/:subjectId">{() => <DashboardRoute adminOnly component={AdminRepository} />}</Route>
      <Route path="/admin/repository/subject/:subjectId/topic/:topicId">{() => <DashboardRoute adminOnly component={AdminRepository} />}</Route>
      <Route path="/admin/collections/:id">{() => <DashboardRoute adminOnly component={AdminCollectionDetails} />}</Route>
      <Route path="/admin/subjects">{() => <DashboardRoute adminOnly component={AdminSubjects} />}</Route>
      <Route path="/admin/users">{() => <DashboardRoute adminOnly component={AdminUsers} />}</Route>
      <Route path="/admin/notes">{() => <DashboardRoute adminOnly component={AdminNotes} />}</Route>
      <Route path="/admin/current-affairs">{() => <DashboardRoute adminOnly component={AdminCurrentAffairs} />}</Route>
      <Route path="/admin/adaptive">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/recommendations">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/mastery">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/study-plans">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/revision">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/analytics">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>
      <Route path="/admin/adaptive/settings">{() => <DashboardRoute adminOnly component={AdminAdaptive} />}</Route>

      {/* Super Admin Only */}
      <Route path="/super-admin">{() => <DashboardRoute superAdminOnly component={SuperAdmin} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export function prefetchRoute(path: string) {
  if (path === '/dashboard') import('@/pages/dashboard');
  else if (path === '/exams/scheduled') import('@/pages/scheduled-exams');
  else if (path.startsWith('/exams/')) import('@/pages/exam-detail');
  else if (path === '/exams') import('@/pages/exams');
  else if (path.startsWith('/results/')) import('@/pages/result-detail');
  else if (path === '/results') import('@/pages/results');
  else if (path === '/leaderboard') import('@/pages/leaderboard');
  else if (path === '/notes') import('@/pages/notes');
  else if (path === '/profile') import('@/pages/profile');
  else if (path === '/notifications') import('@/pages/notifications');
  else if (path === '/performance') import('@/pages/performance');
  else if (path === '/practice') import('@/pages/practice');
  else if (path === '/wrong-answers') import('@/pages/wrong-answers');
  else if (path === '/bookmarks') import('@/pages/bookmarks');
  else if (path === '/settings') import('@/pages/settings');
  else if (path === '/daily-gk') import('@/pages/daily-gk');
  else if (path === '/achievements') import('@/pages/achievements');
  else if (path === '/certificates') import('@/pages/certificates');
  else if (path === '/study-planner') import('@/pages/study-planner');
  else if (path === '/adaptive') import('@/pages/adaptive');
  else if (path.startsWith('/admin/adaptive')) import('@/pages/admin-adaptive');
  else if (path === '/super-admin') import('@/pages/super-admin');
  else if (path.startsWith('/admin/repository')) import('@/pages/admin-repository');
  else if (path.startsWith('/admin/collections/')) import('@/pages/admin-collection-details');
}

function RouteTracker({ onReady }: { onReady: () => void }) {
  React.useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function SplashScreenWrapper({
  children,
  isAppReady,
}: {
  children: React.ReactNode;
  isAppReady: boolean;
}) {
  const { isLoading: isAuthLoading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);
  const [animationComplete, setAnimationComplete] = React.useState(false);

  const isReady = !isAuthLoading && isAppReady;

  React.useEffect(() => {
    let timer: any = null;
    if (isReady && animationComplete) {
      setFadeOut(true);
      timer = setTimeout(() => {
        setShowSplash(false);
      }, 400);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isReady, animationComplete]);

  // Memoize Lottie element to prevent useless re-renders during state changes
  const lottieElement = React.useMemo(() => {
    return (
      <Lottie
        animationData={splashAnimation}
        loop={false}
        autoplay={true}
        onComplete={() => setAnimationComplete(true)}
        style={{
          width: '100%',
          height: '100%',
          transform: 'scale(1.35)',
          transformOrigin: 'center center',
        }}
      />
    );
  }, []);

  return (
    <>
      <div
        className="w-full h-full min-h-screen"
        style={{
          display: showSplash && !fadeOut ? 'none' : 'block',
        }}
      >
        {children}
      </div>
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999, // Ensure z-index is higher than all components
            backgroundColor: '#ffffff', // Clean white background matching Lottie
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: fadeOut ? 0 : 1,
            pointerEvents: fadeOut ? 'none' : 'auto',
            transition: 'opacity 400ms ease-in-out',
          }}
        >
          <div className="relative overflow-hidden flex items-center justify-center w-[200px] md:w-[260px] lg:w-[320px] max-w-[35vw] aspect-square">
            {lottieElement}
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const [isAppReady, setIsAppReady] = React.useState(false);

  return (
    <ThemeProvider defaultTheme="light" storageKey="exam-platform-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <SplashScreenWrapper isAppReady={isAppReady}>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <React.Suspense fallback={null}>
                  <RouteTracker onReady={() => setIsAppReady(true)} />
                  <Router />
                </React.Suspense>
              </WouterRouter>
            </SplashScreenWrapper>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
