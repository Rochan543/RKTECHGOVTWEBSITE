import React from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, FileText, BarChart, Trophy, BookOpen, User as UserIcon, LogOut, Settings, ShieldCheck, Database, Menu } from 'lucide-react';
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
          
          <SidebarContent>
            {user.role === 'admin' || user.role === 'super_admin' ? (
              <AdminNav />
            ) : (
              <StudentNav />
            )}
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate capitalize">{user.role}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleLogout}>
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

function StudentNav() {
  const [location] = useLocation();
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/exams', label: 'Test Series', icon: FileText },
    { href: '/results', label: 'My Results', icon: BarChart },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/notes', label: 'Study Material', icon: BookOpen },
    { href: '/profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={location.startsWith(item.href)}>
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

function AdminNav() {
  const [location] = useLocation();
  
  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/exams', label: 'Exams', icon: FileText },
    { href: '/admin/questions', label: 'Question Bank', icon: Database },
    { href: '/admin/subjects', label: 'Subjects & Topics', icon: BookOpen },
    { href: '/admin/users', label: 'Users', icon: UserIcon },
    { href: '/admin/notes', label: 'Notes & PDFs', icon: FileText },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Administration</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={location === item.href || (item.href !== '/admin' && location.startsWith(item.href))}>
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
