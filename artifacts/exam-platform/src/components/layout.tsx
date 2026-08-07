import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { 
  useListNotifications, 
  getListNotificationsQueryKey,
  getGetDashboardStatsQueryOptions,
  getGetUpcomingTestsQueryOptions,
  getGetRecentActivityQueryOptions,
  getGetSubjectPerformanceQueryOptions,
  getListResultsQueryOptions,
  getListNotificationsQueryOptions,
  getListExamsQueryOptions
} from '@workspace/api-client-react';
import { API_BASE_URL } from '@workspace/api-client-react';
import { prefetchRoute } from '@/App';
import {
  LayoutDashboard, FileText, BarChart2, Trophy, BookOpen, User as UserIcon,
  LogOut, ShieldCheck, Database, Menu, Bell, TrendingUp, Target, Bookmark,
  XCircle, Settings, Newspaper, Award, Users, BookMarked, CalendarDays,
  Medal, Shield, Globe, FolderTree, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r">
          <SidebarHeader className="flex flex-col items-center justify-center py-6 px-4 border-b gap-3">
            <img src="/logo.png" alt="SSC Portal Logo" className="h-14 w-14 object-contain transition-transform hover:scale-105" />
            <span className="font-extrabold text-2xl tracking-tight text-primary">
              RK TECH Portal
            </span>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto">
            {user.role === 'admin' || user.role === 'super_admin' ? (
              <AdminNav />
            ) : (
              <StudentNav />
            )}
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={optimizeCloudinaryUrl(user.avatarUrl, { width: 40, height: 40 })} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate capitalize">{user.role.replace('_', ' ')}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MobileHeader />
          <div className="flex-1 overflow-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="w-full h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function MobileHeader() {
  const { toggleSidebar, isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <header className="h-16 border-b flex items-center px-4 bg-background/90 backdrop-blur-md sticky top-0 z-10 justify-between w-full transition-all">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hover:bg-accent/50 rounded-xl" aria-label="Toggle Navigation Sidebar">
          <Menu className="h-5 w-5 text-foreground" />
        </Button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="SSC Portal Logo" className="h-9 w-9 object-contain" />
          <span className="font-extrabold text-xl tracking-tight text-primary">
            RK TECH Portal
          </span>
        </div>
      </div>
    </header>
  );
}

function NavItem({ href, label, icon: Icon, exact = false, badge }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; badge?: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = exact ? location === href : location === href || location.startsWith(href + '/');
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    prefetchRoute(href);
    try {
      if (href === '/dashboard') {
        queryClient.prefetchQuery(getGetDashboardStatsQueryOptions());
        queryClient.prefetchQuery(getGetUpcomingTestsQueryOptions());
        queryClient.prefetchQuery(getGetRecentActivityQueryOptions());
        queryClient.prefetchQuery(getGetSubjectPerformanceQueryOptions());
      } else if (href === '/results') {
        queryClient.prefetchQuery(getListResultsQueryOptions({ limit: 50 }));
      } else if (href === '/notifications') {
        queryClient.prefetchQuery(getListNotificationsQueryOptions());
      } else if (href === '/exams') {
        queryClient.prefetchQuery(getListExamsQueryOptions({ limit: 100 }));
      } else if (href === '/exams/scheduled') {
        queryClient.prefetchQuery(getListExamsQueryOptions({ limit: 100 }));
        queryClient.prefetchQuery(getListResultsQueryOptions({ limit: 100 }));
      } else if (href === '/practice') {
        queryClient.prefetchQuery(getListExamsQueryOptions({ limit: 100 }));
        queryClient.prefetchQuery(getListResultsQueryOptions({ limit: 100 }));
      }
    } catch (e) {
      console.warn("Failed to prefetch queries", e);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link 
          href={href}
          onMouseEnter={handleMouseEnter}
          onFocus={handleMouseEnter}
          className={`flex items-center justify-between w-full transition-all duration-200 hover:pl-1.5 ${
            isActive 
              ? 'font-bold text-primary bg-primary/5 shadow-2xs border-l-2 border-primary pl-2' 
              : 'hover:text-primary hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110 text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
            <span>{label}</span>
          </div>
          {badge}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function StudentNav() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/notifications/stream`, { withCredentials: true });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_notification') {
            queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
          }
        } catch (e) {
          console.error("Error parsing notification stream data:", e);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [queryClient]);

  const { data: notifications } = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      refetchInterval: 60000, // Poll notifications every 60s fallback, relying on SSE for instant unread badge!
    }
  });
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Overview</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} exact />
          <NavItem 
            href="/notifications" 
            label="Notifications" 
            icon={Bell} 
            badge={unreadCount > 0 ? (
              <span className="h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            ) : null}
          />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Practice</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/practice" label="Practice Hub" icon={Target} />
          <NavItem href="/exams" label="Test Series" icon={FileText} />
          <NavItem href="/exams/scheduled" label="Scheduled Exams" icon={CalendarDays} />
          <NavItem href="/adaptive" label="Adaptive Learning" icon={Sparkles} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Performance</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/results" label="My Results" icon={BarChart2} />
          <NavItem href="/performance" label="Analytics" icon={TrendingUp} />
          <NavItem href="/wrong-answers" label="Wrong Answers" icon={XCircle} />
          <NavItem href="/leaderboard" label="Leaderboard" icon={Trophy} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Study</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/notes" label="Study Material" icon={BookOpen} />
          <NavItem href="/bookmarks" label="Bookmarks" icon={Bookmark} />
          <NavItem href="/study-planner" label="Study Planner" icon={CalendarDays} />
          <NavItem href="/current-affairs" label="Current Affairs" icon={Globe} />
          <NavItem href="/daily-gk" label="Daily GK" icon={Newspaper} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Credentials</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/achievements" label="Achievements" icon={Award} />
          <NavItem href="/certificates" label="Certificates" icon={Medal} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Account</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/profile" label="Profile" icon={UserIcon} />
          <NavItem href="/settings" label="Settings" icon={Settings} />
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}

function AdminNav() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <>
      {/* ── Overview ─────────────────────────────────── */}
      <SidebarGroup>
        <SidebarGroupLabel>Overview</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} exact />
        </SidebarMenu>
      </SidebarGroup>

      {/* ── Content Management ───────────────────────── */}
      <SidebarGroup>
        <SidebarGroupLabel>Content</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/admin/exams" label="Exams" icon={FileText} />
          <NavItem href="/admin/questions" label="Question Bank" icon={Database} />
          <NavItem href="/admin/repository" label="Question Repository" icon={FolderTree} />
          <NavItem href="/admin?tab=collections" label="Collections" icon={BookMarked} />
          <NavItem href="/admin/subjects" label="Subjects & Topics" icon={BookMarked} />
          <NavItem href="/admin/notes" label="Notes & PDFs" icon={BookOpen} />
          <NavItem href="/admin/current-affairs" label="Current Affairs CMS" icon={Globe} />
          <NavItem href="/admin/adaptive" label="Adaptive Learning" icon={Sparkles} />
          <NavItem href="/admin/adaptive/analytics" label="Analytics" icon={BarChart2} />
        </SidebarMenu>
      </SidebarGroup>

      {/* ── User Management ──────────────────────────── */}
      <SidebarGroup>
        <SidebarGroupLabel>Users</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/admin/users" label="All Users" icon={Users} />
        </SidebarMenu>
      </SidebarGroup>

      {/* ── Super Admin Only ─────────────────────────── */}
      {isSuperAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
          <SidebarMenu>
            <NavItem href="/super-admin" label="Control Panel" icon={Shield} />
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );
}
