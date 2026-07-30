import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLocation } from 'wouter';
import { Clock, Calendar, ArrowLeft, Flame, Eye, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  categoryName: string | null;
  imageUrl: string | null;
  readingTime: number;
}

interface ReadHistoryItem {
  historyId: number;
  progress: number;
  secondsRead: number;
  completed: boolean;
  lastReadAt: string;
  article: Article;
}

interface HistoryStatsResponse {
  history: ReadHistoryItem[];
  streak: number;
  todayProgress: {
    reads: number;
    target: number;
  };
}

export default function CurrentAffairsHistory() {
  const [, setLocation] = useLocation();

  const { data: statsData, isLoading } = useQuery<HistoryStatsResponse>({
    queryKey: ['current-affairs-stats'],
    queryFn: () => customFetch('/api/v1/current-affairs/history'),
  });

  const streak = statsData?.streak ?? 0;
  const history = statsData?.history ?? [];
  const todayProgress = statsData?.todayProgress ?? { reads: 0, target: 3 };

  // Calculations
  const completedCount = history.filter((h) => h.completed).length;
  const totalSeconds = history.reduce((acc, h) => acc + h.secondsRead, 0);
  const totalMins = Math.round(totalSeconds / 60);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setLocation('/current-affairs')}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <span className="text-xs text-muted-foreground font-semibold">
          Active streak & learning logs
        </span>
      </div>

      {/* Streak Dashboard stats banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-amber-100 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Current Streak</span>
              <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">{streak} Days Reading</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-gradient-to-br from-indigo-500/10 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Reading Time</span>
              <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">{totalMins} Minutes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Completed Articles</span>
              <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{completedCount} of {history.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Reading History Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">You haven't read any current affairs articles yet.</p>
              <Button onClick={() => setLocation('/current-affairs')} className="mt-4 rounded-xl text-xs font-bold">
                Start Reading Articles
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {history.map((item) => (
                <div
                  key={item.historyId}
                  className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer group"
                  onClick={() => setLocation(`/current-affairs/articles/${item.article.id}`)}
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-none px-1 py-0">
                        {item.article.categoryName || 'GK'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-semibold">
                        <Calendar className="h-3 w-3" /> {new Date(item.lastReadAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-xs leading-snug group-hover:text-primary truncate transition-colors">
                      {item.article.title}
                    </h3>
                    <div className="w-48 flex items-center gap-3">
                      <Progress value={item.progress} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground font-bold shrink-0">{item.progress}% read</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                    <span className="flex items-center gap-0.5"><Clock className="h-3.5 w-3.5" /> {Math.round(item.secondsRead / 60)} min read</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
