import React from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard, FileText, BarChart2, Trophy, BookOpen, User as UserIcon,
  LogOut, ShieldCheck, Database, Menu, Bell, TrendingUp, Target, Bookmark,
  XCircle, Settings, Newspaper, Award, Users, BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r">
          <SidebarHeader className="h-16 flex items-center px-4 border-b">
            <div className="font-bold text-xl tracking-tight text-primary flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              SSC Platform
            </div>
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
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
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
            {children}
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
    <header className="h-14 border-b flex items-center px-4 bg-background sticky top-0 z-10">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>
      <span className="ml-4 font-bold text-lg text-primary">SSC Platform</span>
    </header>
  );
}

function NavItem({ href, label, icon: Icon, exact = false }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }) {
  const [location] = useLocation();
  const isActive = exact ? location === href : location === href || location.startsWith(href + '/');
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={href} className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function StudentNav() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Overview</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} exact />
          <NavItem href="/notifications" label="Notifications" icon={Bell} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Practice</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/practice" label="Practice Hub" icon={Target} />
          <NavItem href="/exams" label="Test Series" icon={FileText} />
          <NavItem href="/daily-gk" label="Daily GK" icon={Newspaper} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Performance</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/results" label="My Results" icon={BarChart2} />
          <NavItem href="/performance" label="Analytics" icon={TrendingUp} />
          <NavItem href="/wrong-answers" label="Wrong Answers" icon={XCircle} />
          <NavItem href="/leaderboard" label="Leaderboard" icon={Trophy} />
          <NavItem href="/achievements" label="Achievements" icon={Award} />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Study</SidebarGroupLabel>
        <SidebarMenu>
          <NavItem href="/notes" label="Study Material" icon={BookOpen} />
          <NavItem href="/bookmarks" label="Bookmarks" icon={Bookmark} />
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
  const [location] = useLocation();

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/exams', label: 'Exams', icon: FileText },
    { href: '/admin/questions', label: 'Question Bank', icon: Database },
    { href: '/admin/subjects', label: 'Subjects & Topics', icon: BookMarked },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/notes', label: 'Notes & PDFs', icon: BookOpen },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Administration</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={item.exact ? location === item.href : location === item.href || location.startsWith(item.href + '/')}
            >
              <Link href={item.href} className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
