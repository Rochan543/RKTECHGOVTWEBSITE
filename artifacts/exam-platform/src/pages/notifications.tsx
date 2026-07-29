import { useState } from 'react';
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, Trophy, FileText, Megaphone, Info, Loader2, Calendar } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';

const typeIcon: Record<string, React.ReactNode> = {
  exam_result: <Trophy className="h-4 w-4 text-amber-500" />,
  new_exam: <FileText className="h-4 w-4 text-blue-500" />,
  announcement: <Megaphone className="h-4 w-4 text-indigo-500" />,
  achievement: <Trophy className="h-4 w-4 text-emerald-500" />,
  system: <Info className="h-4 w-4 text-slate-500" />,
};

const filterTabs = [
  { id: 'all', label: 'All' },
  { id: 'exam_result', label: 'Results' },
  { id: 'new_exam', label: 'Exams' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'system', label: 'System' },
];

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [activeFilter, setActiveFilter] = useState('all');

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    });
  };

  // Filter notifications
  const filtered = (notifications ?? []).filter(n => {
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  // Group notifications by Date
  const groupNotifications = (items: typeof filtered) => {
    const groups: Record<string, typeof filtered> = {
      Today: [],
      Yesterday: [],
      Older: [],
    };

    items.forEach(n => {
      const date = new Date(n.createdAt);
      if (isToday(date)) {
        groups.Today.push(n);
      } else if (isYesterday(date)) {
        groups.Yesterday.push(n);
      } else {
        groups.Older.push(n);
      }
    });

    return groups;
  };

  const grouped = groupNotifications(filtered);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Notifications</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You are all caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={markAll.isPending} className="h-9 font-bold">
            {markAll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
            Mark All Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`
              px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap
              ${activeFilter === tab.id
                ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                : 'bg-background hover:bg-muted text-muted-foreground border-slate-200/60 dark:border-slate-800'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card className="border border-slate-200/60 dark:border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-sm">No notifications found</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
              {activeFilter === 'all'
                ? "You'll see exam results, announcements, and achievements here."
                : `No notifications matching the "${filterTabs.find(t => t.id === activeFilter)?.label}" filter.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([groupName, items]) => {
            if (!items.length) return null;
            return (
              <div key={groupName} className="space-y-2.5">
                <h3 className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider flex items-center gap-1.5 px-1">
                  <Calendar className="h-3.5 w-3.5" /> {groupName}
                </h3>
                <div className="space-y-2">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={`
                        flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer
                        hover:scale-[1.005] hover:shadow-sm group relative overflow-hidden
                        ${!n.isRead 
                          ? 'bg-primary/5 dark:bg-primary/10 border-primary/20 hover:bg-primary/10' 
                          : 'bg-card border-slate-200/60 dark:border-slate-800/80 hover:bg-muted/30'}
                        animate-in slide-in-from-bottom-2 duration-300
                      `}
                      onClick={() => !n.isRead && handleMarkRead(n.id)}
                    >
                      {/* Left color bar for unread notifications */}
                      {!n.isRead && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      
                      <div className="mt-1 flex-shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                        {typeIcon[n.type] ?? <Info className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold ${!n.isRead ? 'text-foreground' : 'text-slate-700 dark:text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-2 font-medium">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>

                      <Badge 
                        variant={n.isRead ? 'secondary' : 'default'} 
                        className="flex-shrink-0 text-[10px] capitalize font-bold rounded-lg px-2.5 py-0.5"
                      >
                        {n.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
