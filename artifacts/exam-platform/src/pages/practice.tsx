import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import {
  Clock,
  Target,
  BookOpen,
  ChevronRight,
  Zap,
  Bookmark,
  XCircle,
  Award,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  Compass,
  ArrowRight
} from 'lucide-react';

interface PracticeStats {
  questionsPracticed: number;
  accuracy: number;
  timeSpent: number;
  collectionsCompleted: number;
  todayPractice: number;
  bookmarkedQuestions: number;
  wrongAnswerQuestions: number;
}

interface RecommendedCollection {
  id: number;
  name: string;
  description: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  questionCount: number;
}

interface RecentSession {
  id: number;
  mode: 'timed' | 'untimed';
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  accuracy: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  collectionName: string | null;
  subjectName: string | null;
  topicName: string | null;
}

interface SubjectStat {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  questionsPracticed: number;
}

interface PracticeStatsResponse {
  stats: PracticeStats;
  recommendedCollections: RecommendedCollection[];
  recentSessions: RecentSession[];
  subjects: SubjectStat[];
}

export default function Practice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<PracticeStatsResponse>({
    queryKey: ['practice-stats'],
    queryFn: () => customFetch('/api/v1/practice/stats'),
  });

  const resetWrongAnswers = useMutation({
    mutationFn: () => customFetch('/api/v1/practice/wrong-answers/reset', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-stats'] });
      toast({ title: 'Mistakes reset successfully', description: 'Your wrong answers list has been cleared.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to reset mistakes', description: String(err.message || err), variant: 'destructive' });
    }
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded-xl w-48" />
        <div className="h-6 bg-muted rounded-xl w-96" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-6">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-2xl" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-3 mt-8">
          <div className="md:col-span-2 space-y-6">
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-48 bg-muted rounded-2xl" />
          </div>
          <div className="space-y-6">
            <div className="h-96 bg-muted rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const { stats, recommendedCollections, recentSessions, subjects } = data;

  const statsCards = [
    { label: 'Total Practiced', value: `${stats.questionsPracticed} Qs`, desc: 'Questions completed', icon: Target, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20' },
    { label: 'Overall Accuracy', value: `${stats.accuracy}%`, desc: 'Correct rate', icon: Award, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
    { label: 'Time Spent', value: stats.timeSpent > 3600 ? `${Math.round(stats.timeSpent / 3600)} hrs` : `${Math.round(stats.timeSpent / 60)} mins`, desc: 'Total focus duration', icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
    { label: 'Sets Completed', value: `${stats.collectionsCompleted}`, desc: 'Collections completed', icon: Layers, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
    { label: 'Today\'s Work', value: `${stats.todayPractice} Qs`, desc: 'Practiced today', icon: Zap, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/20' },
  ];

  // Helper to format session name
  const getSessionName = (session: RecentSession) => {
    if (session.collectionName) return session.collectionName;
    if (session.topicName) return `Topic: ${session.topicName}`;
    if (session.subjectName) return `Subject: ${session.subjectName}`;
    return `Practice Session #${session.id}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Practice Hub</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Strengthen your concepts, track weaknesses, and practice at your own pace.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {statsCards.map((c, i) => (
          <Card key={i} className="border border-slate-100 dark:border-slate-800 shadow-sm bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-muted-foreground leading-none">{c.label}</span>
                <div className={`p-1.5 rounded-lg ${c.color}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground leading-none">{c.value}</h3>
                <p className="text-[10px] text-muted-foreground mt-1.5">{c.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Action Cards (Bookmarks & Wrong Answers) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bookmarks Practice Card */}
        <Card className="border border-indigo-100 dark:border-indigo-950/40 bg-gradient-to-br from-indigo-50/50 via-background to-background dark:from-indigo-950/10">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bookmark className="h-4.5 w-4.5 text-indigo-500 fill-indigo-500" /> Bookmarked Questions
                </CardTitle>
                <CardDescription className="text-xs mt-1">Review or practice questions you flagged for later.</CardDescription>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold">
                {stats.bookmarkedQuestions} Saved
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2 flex gap-3">
            <Button size="sm" asChild className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs font-semibold">
              <Link href={`/practice/setup?type=bookmarks`}>
                <Play className="h-3 w-3 mr-1.5 fill-current" /> Practice Bookmarks
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-xl h-9 text-xs font-semibold">
              <Link href="/bookmarks">View Saved</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Wrong Answers Practice Card */}
        <Card className="border border-rose-100 dark:border-rose-950/40 bg-gradient-to-br from-rose-50/50 via-background to-background dark:from-rose-950/10">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <XCircle className="h-4.5 w-4.5 text-rose-500" /> Wrong Answer Revision
                </CardTitle>
                <CardDescription className="text-xs mt-1">Convert mistakes into strengths. Questions clear automatically when answered correctly.</CardDescription>
              </div>
              <Badge variant="destructive" className="font-bold">
                {stats.wrongAnswerQuestions} Mistakes
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2 flex gap-3">
            <Button size="sm" asChild variant="destructive" className="rounded-xl h-9 text-xs font-semibold">
              <Link href={`/practice/setup?type=wrong_answers`}>
                <Play className="h-3 w-3 mr-1.5 fill-current" /> Practice Mistakes
              </Link>
            </Button>
            {stats.wrongAnswerQuestions > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetWrongAnswers.mutate()}
                disabled={resetWrongAnswers.isPending}
                className="rounded-xl h-9 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 border-rose-200 hover:text-rose-700"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" /> Reset Mistakes
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild className="rounded-xl h-9 text-xs font-semibold">
              <Link href="/wrong-answers">Review List</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Subjects & Topic Selector + Sidebar */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Subjects & Practice flow */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="h-5 w-5 text-indigo-500" /> Practice by Subject
            </h2>
            <Button variant="ghost" size="sm" asChild className="text-xs text-indigo-600 dark:text-indigo-400">
              <Link href="/practice/setup">
                Advanced Setup <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {subjects.map((sub) => (
              <Card key={sub.id} className="group hover:border-indigo-500/30 transition-all duration-300 bg-card flex flex-col justify-between">
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors text-sm">
                      {sub.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {sub.description || 'Practice mock questions and previous year question sets.'}
                    </p>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-800/60 pt-3">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {sub.questionsPracticed} questions practiced
                    </span>
                    <Button size="sm" asChild className="h-8 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700">
                      <Link href={`/practice/setup?subjectId=${sub.id}&type=subject`}>
                        Practice Now <ChevronRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recommended Collections */}
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 border-b pb-3">
              <Sparkles className="h-5 w-5 text-amber-500" /> Recommended Practice Sets
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {recommendedCollections.map((col) => {
                const diffColor = {
                  easy: 'bg-green-500/10 text-green-700 border-green-500/20',
                  medium: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                  hard: 'bg-red-500/10 text-rose-700 border-red-500/20',
                }[col.difficulty];

                return (
                  <Card key={col.id} className="hover:shadow-sm border border-slate-200/60 dark:border-slate-800 bg-card">
                    <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-2.5">
                          <Badge variant="outline" className={`capitalize font-bold text-[9px] ${diffColor}`}>
                            {col.difficulty}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {col.estimatedTime} mins
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-foreground line-clamp-1">{col.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {col.description || 'Collection curated specifically for revision and timed practice sets.'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/60 pt-3">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {col.questionCount} Questions
                        </span>
                        <Button size="sm" asChild className="h-8 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700">
                          <Link href={`/practice/setup?collectionId=${col.id}&type=collection`}>
                            Start Practice <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {recommendedCollections.length === 0 && (
                <div className="sm:col-span-2 text-center py-12 text-muted-foreground bg-card border rounded-2xl">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30 text-amber-500" />
                  <p className="text-xs font-semibold">No recommended collections available at the moment.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Configure practice availability in the Admin Collections repository.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Sessions & Continue Practice */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 border-b pb-3">
            <Layers className="h-5 w-5 text-indigo-500" /> Recently Practiced
          </h2>

          <div className="space-y-3.5">
            {recentSessions.map((session) => {
              const isCompleted = session.status === 'completed';
              const progressPct = !isCompleted && session.totalQuestions > 0
                ? Math.round((session.currentQuestionIndex / session.totalQuestions) * 100)
                : 100;

              return (
                <Card key={session.id} className="border border-slate-200/60 dark:border-slate-800/80 bg-card">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-foreground truncate max-w-[160px] sm:max-w-none">
                          {getSessionName(session)}
                        </h4>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                          {session.mode} Mode · {new Date(session.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={isCompleted ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border-transparent text-[9px] h-5 py-0' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border-transparent text-[9px] h-5 py-0'}>
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </Badge>
                    </div>

                    {!isCompleted ? (
                      <div className="space-y-2 mt-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                          <span>Progress: {session.currentQuestionIndex}/{session.totalQuestions} Qs</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-semibold bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                        <span>Accuracy: <strong className="text-emerald-600 dark:text-emerald-400">{Math.round(session.accuracy)}%</strong></span>
                        <span>Total Questions: <strong>{session.totalQuestions}</strong></span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      {isCompleted ? (
                        <Button size="sm" variant="ghost" asChild className="h-7 text-[10px] font-bold rounded-md">
                          <Link href={`/practice/results/${session.id}`}>
                            View Analysis <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" asChild className="bg-indigo-600 text-white hover:bg-indigo-700 h-7 text-[10px] font-bold rounded-md">
                          <Link href={`/practice/session/${session.id}`}>
                            Resume Session <Play className="h-2.5 w-2.5 ml-1 fill-current" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {recentSessions.length === 0 && (
              <div className="text-center py-16 text-muted-foreground bg-card border border-dashed rounded-2xl">
                <Target className="h-10 w-10 mx-auto mb-2 opacity-35" />
                <p className="text-xs font-semibold">No recent practice history.</p>
                <p className="text-[10px] text-muted-foreground mt-1">Select a subject or collection above to begin practicing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
