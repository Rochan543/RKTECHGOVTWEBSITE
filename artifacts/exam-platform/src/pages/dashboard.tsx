import { useState, useEffect } from 'react';
import { 
  useGetDashboardStats, 
  getGetDashboardStatsQueryKey,
  useGetUpcomingTests,
  getGetUpcomingTestsQueryKey,
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
  useGetSubjectPerformance,
  getGetSubjectPerformanceQueryKey,
  useGetGamificationProfile,
  getGetGamificationProfileQueryKey,
  useClaimLoginReward,
  useGetDailyMissions,
  getGetDailyMissionsQueryKey,
  useGetGoals,
  getGetGoalsQueryKey,
  useGetAiInsights,
  getGetAiInsightsQueryKey,
  customFetch
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Trophy, Target, Clock, CheckCircle2, AlertCircle, ArrowRight, Flame, Award, Zap, BookOpen, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useServerTime, useSyncedNow, formatCountdown, formatRemainingTime } from '@/hooks/use-server-time';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: serverTime } = useServerTime();
  const now = useSyncedNow(serverTime);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Standard stats & feeds
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });
  const { data: upcoming, isLoading: upcomingLoading } = useGetUpcomingTests({
    query: { queryKey: getGetUpcomingTestsQueryKey() }
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });
  const { data: subjectPerf, isLoading: subjectLoading } = useGetSubjectPerformance({
    query: { queryKey: getGetSubjectPerformanceQueryKey() }
  });

  // Gamification & Success module hooks
  const { data: profile, isLoading: profileLoading } = useGetGamificationProfile({
    query: { queryKey: getGetGamificationProfileQueryKey() }
  });
  const { data: missionData, isLoading: missionsLoading } = useGetDailyMissions({
    query: { queryKey: getGetDailyMissionsQueryKey() }
  });
  const { data: goalData, isLoading: goalsLoading } = useGetGoals({
    query: { queryKey: getGetGoalsQueryKey() }
  });
  const { data: aiInsights, isLoading: aiLoading } = useGetAiInsights({
    query: { queryKey: getGetAiInsightsQueryKey() }
  });

  const { data: adaptiveDashboard } = useQuery<any>({
    queryKey: ['adaptive', 'dashboard'],
    queryFn: () => customFetch('/api/v1/adaptive/dashboard'),
  });

  // Claim Daily login reward mutation
  const claimRewardMutation = useClaimLoginReward({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Reward Claimed!",
          description: `You earned +${data.xpEarned} XP! ${data.leveledUp ? "LEVEL UP!" : ""}`,
        });
        // Invalidate queries to reload stats
        queryClient.invalidateQueries({ queryKey: getGetGamificationProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDailyMissionsQueryKey() });
      },
      onError: (err: any) => {
        toast({
          title: "Claim Failed",
          description: err.response?.data?.error || "Unable to claim reward. Try again later.",
          variant: "destructive",
        });
      }
    }
  });

  const handleClaimReward = () => {
    claimRewardMutation.mutate();
  };

  const handleMissionClick = (missionType: string) => {
    switch (missionType) {
      case 'solve_questions':
        setLocation('/practice');
        break;
      case 'read_ca':
        setLocation('/current-affairs');
        break;
      case 'complete_revision':
        setLocation('/adaptive?tab=revision');
        break;
      case 'finish_study_task':
        setLocation('/study-planner');
        break;
      case 'take_mock':
        setLocation('/exams');
        break;
      case 'practice_weak': {
        if (!adaptiveDashboard) {
          toast({
            title: "Loading data...",
            description: "Please wait a moment while we retrieve your study insights.",
          });
          break;
        }
        const weakTopics = adaptiveDashboard?.weakTopics || [];
        if (weakTopics.length > 0) {
          const weakestTopic = weakTopics[0];
          if (weakestTopic && weakestTopic.topicId) {
            setLocation(`/practice/setup?type=topic&topicId=${weakestTopic.topicId}`);
          } else {
            toast({
              title: "No Weak Topics Detected",
              description: "No weak topics detected! Keep up the high accuracy.",
            });
          }
        } else {
          toast({
            title: "No Weak Topics Detected",
            description: "No weak topics detected! Keep up the high accuracy.",
          });
        }
        break;
      }
      case 'complete_quiz':
        setLocation('/current-affairs?tab=quizzes');
        break;
      default:
        break;
    }
  };

  const xpProgress = (profile && profile.xp !== undefined) ? (profile.xp % 500) : 0;
  const xpPercent = Math.min((xpProgress / 500) * 100, 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Next-Gen Success Hub</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor your goals, claim rewards, and build your streaks.</p>
        </div>
        
        {/* Daily reward claim widget */}
        {profile && (
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Daily login reward</p>
              <p className="text-xs text-foreground font-bold">Claim 20 XP bonus</p>
            </div>
            <Button 
              size="sm" 
              onClick={handleClaimReward} 
              disabled={profile.loginClaimedToday || claimRewardMutation.isPending}
              className={`font-bold text-xs h-9 rounded-xl ${
                profile.loginClaimedToday 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-0 cursor-default" 
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow"
              }`}
            >
              {profile.loginClaimedToday ? "Claimed" : "Claim Reward"}
            </Button>
          </div>
        )}
      </div>

      {/* Grid Row 1: XP Progress, Streaks & Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Gamification Stats */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-slate-50/50 dark:to-slate-900/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-500" />
              Level {profile?.level ?? 1} Progress
            </CardTitle>
            <CardDescription className="text-xs">Accumulate XP to unlock levels and badges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{profile?.xp ?? 0} Total XP</span>
                <span className="text-indigo-600 dark:text-indigo-400">{500 - xpProgress} XP to Level {(profile?.level ?? 1) + 1}</span>
              </div>
              <Progress value={xpPercent} className="h-3 bg-slate-100 dark:bg-slate-800" />
            </div>
            
            {/* Badges preview */}
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Unlocked Badges</p>
              <div className="flex flex-wrap gap-2">
                {profile?.badges && profile.badges.length > 0 ? (
                  profile.badges.map((b, i) => (
                    <Badge key={i} variant="secondary" className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/40 text-[10px] py-1 px-2 font-semibold">
                      {b.badgeType?.replace('_', ' ')}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No badges earned yet. Solve daily quizzes to unlock!</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streaks Tracker */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Study Streaks
            </CardTitle>
            <CardDescription className="text-xs">Prepare consistently to grow your streaks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center pt-2">
            <div className="bg-orange-50/50 dark:bg-orange-950/20 p-3 rounded-2xl border border-orange-100/30 dark:border-orange-900/20">
              <Flame className={`h-6 w-6 mx-auto mb-1 ${profile?.dailyStreak ? "text-orange-500 fill-orange-500" : "text-slate-300"}`} />
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{profile?.dailyStreak ?? 0}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Daily</p>
            </div>
            <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-100/30 dark:border-amber-900/20">
              <Flame className={`h-6 w-6 mx-auto mb-1 ${profile?.weeklyStreak ? "text-amber-500 fill-amber-500" : "text-slate-300"}`} />
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{profile?.weeklyStreak ?? 0}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Weekly</p>
            </div>
            <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-2xl border border-rose-100/30 dark:border-rose-900/20">
              <Flame className={`h-6 w-6 mx-auto mb-1 ${profile?.monthlyStreak ? "text-rose-500 fill-rose-500" : "text-slate-300"}`} />
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{profile?.monthlyStreak ?? 0}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Monthly</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Goals Progress */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Today's Goal</span>
              <Target className="h-5 w-5 opacity-80" />
            </CardTitle>
            <CardDescription className="text-xs text-indigo-100">Your targets for today: {goalData?.targets?.targetExam || "SSC Exams"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-indigo-100">
                <span>Questions Solved</span>
                <span>{goalData?.progress?.dailyQuestions ?? 0} / {goalData?.targets?.dailyQuestions ?? 20}</span>
              </div>
              <Progress 
                value={goalData ? Math.min(((goalData?.progress?.dailyQuestions ?? 0) / (goalData?.targets?.dailyQuestions ?? 20)) * 100, 100) : 0} 
                className="h-2 bg-indigo-800/80" 
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-indigo-100">
                <span>Study Hours</span>
                <span>{goalData?.progress?.dailyHours ?? 0}h / {goalData?.targets?.dailyHours ?? 1}h</span>
              </div>
              <Progress 
                value={goalData ? Math.min(((goalData?.progress?.dailyHours ?? 0) / (goalData?.targets?.dailyHours ?? 1)) * 100, 100) : 0} 
                className="h-2 bg-indigo-800/80" 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Daily Missions checklist */}
        <Card className="lg:col-span-2 border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              Daily Missions
            </CardTitle>
            <CardDescription className="text-xs">Complete these tasks today to earn extra experience points</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 pt-2">
            {missionsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted/40 animate-pulse rounded-xl border border-slate-200/40" />
                ))}
              </div>
            ) : missionData?.missions && missionData.missions.length > 0 ? (
              <div className="grid gap-3">
                {missionData.missions.map((m: any) => (
                  <div 
                    key={m.id} 
                    onClick={() => {
                      if (!m.completed) {
                        handleMissionClick(m.missionType);
                      }
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                      m.completed 
                        ? "bg-slate-50 dark:bg-slate-900/30 border-slate-200/40 text-slate-400 line-through dark:text-slate-500" 
                        : "bg-card hover:bg-slate-50 dark:hover:bg-slate-900/50 border-slate-200/60 dark:border-slate-800 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center border transition-all ${
                        m.completed 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "border-slate-300 dark:border-slate-700 bg-background"
                      }`}>
                        {m.completed && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold leading-none">{m.description}</span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Progress: {m.currentCount} / {m.targetCount}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${
                      m.completed 
                        ? "bg-slate-100 text-slate-400 border-0" 
                        : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-500 dark:border-amber-900/20"
                    }`}>
                      +{m.xpReward} XP
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                <p className="text-xs font-bold">All missions complete for today!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI study insights & Weak topics */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-500" />
              AI Success Insights
            </CardTitle>
            <CardDescription className="text-xs">Personalized study advice generated based on performance</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 pt-2">
            {aiLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : aiInsights ? (
              <div className="space-y-4">
                {/* Expected readiness */}
                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100/30 dark:border-indigo-900/20">
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Exam Readiness</p>
                  <p className="text-xl font-black mt-1 text-indigo-950 dark:text-indigo-100">{aiInsights?.expectedExamReadiness}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Based on accuracy in recent mocks.</p>
                </div>

                {/* Study suggestion list */}
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Recommended Next Steps</p>
                  <ul className="space-y-2">
                    {aiInsights?.studySuggestions?.map((suggestion: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Best time to study */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">Best Time To Study:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiInsights?.bestTimeToStudy}</span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <AlertCircle className="h-6 w-6 mr-2 opacity-50" />
                <span className="text-xs">Not enough performance logs to generate insights.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Recent Performance and Mock test lists */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col border border-slate-200/60 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Recent Performance</CardTitle>
              <CardDescription className="text-xs">Your latest mock test attempts</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-indigo-500 hover:text-indigo-600">
              <Link href="/results">View All <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse border border-slate-200/40" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-card hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-300">
                    <div>
                      <h4 className="font-bold text-xs leading-tight text-foreground">{item.examTitle}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                        {new Date(item.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{item.score} / {item.totalMarks}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{item.accuracy.toFixed(1)}% Accuracy</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <Target className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-semibold">No recent activity</p>
                <Button variant="outline" className="mt-4 h-8 text-xs font-bold" asChild>
                  <Link href="/exams">Take a Test</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mock recommendations */}
        <Card className="flex flex-col border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Upcoming Recommended Tests</CardTitle>
            <CardDescription className="text-xs">Based on target exam: {goalData?.targets?.targetExam || "SSC CGL"}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingLoading ? (
               <div className="space-y-4">
                 {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse border border-slate-200/40" />
                 ))}
               </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((test) => {
                  const hasSchedule = test.scheduledAt !== null && test.scheduledAt !== undefined;
                  const startMs = hasSchedule ? new Date(test.scheduledAt!).getTime() : 0;
                  const endMs = hasSchedule && test.endsAt ? new Date(test.endsAt).getTime() : Infinity;

                  const isUpcoming = hasSchedule && now < startMs;
                  const isClosed = hasSchedule && now > endMs;
                  const isLive = !hasSchedule || (now >= startMs && now <= endMs);

                  let countdown = null;
                  let remainingSeconds = 0;
                  if (isUpcoming) {
                    countdown = formatCountdown(startMs - now);
                  } else if (isLive && hasSchedule) {
                    remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));
                  }

                  return (
                    <div key={test.id} className={`p-4 rounded-xl border ${isUpcoming ? 'border-amber-100 dark:border-amber-950/20 bg-amber-50/5' : isLive && hasSchedule ? 'border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/5' : 'border-slate-100 dark:border-slate-800 bg-card'} hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all duration-300`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-xs leading-tight text-foreground line-clamp-1">{test.title}</h4>
                        <div className="flex gap-1 items-center">
                          <Badge variant="outline" className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 font-bold rounded-lg whitespace-nowrap">
                            {test.type.replace('_', ' ')}
                          </Badge>
                          {isUpcoming && (
                            <Badge className="bg-amber-500 text-white text-[8px] uppercase font-bold rounded-lg">
                              Scheduled
                            </Badge>
                          )}
                          {isLive && hasSchedule && (
                            <Badge className="bg-emerald-500 text-white text-[8px] uppercase font-bold rounded-lg animate-pulse">
                              Exam Live
                            </Badge>
                          )}
                          {isClosed && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[8px] uppercase font-bold rounded-lg">
                              Closed
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isUpcoming && countdown && (
                        <div className="my-3 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg flex flex-col items-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Starts In</span>
                          <div className="flex gap-1.5 text-center text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                            <span>{countdown.days}d</span>
                            <span>:</span>
                            <span>{countdown.hours}h</span>
                            <span>:</span>
                            <span>{countdown.minutes}m</span>
                            <span>:</span>
                            <span>{countdown.seconds}s</span>
                          </div>
                        </div>
                      )}

                      {isLive && hasSchedule && (
                        <div className="my-3 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex flex-col items-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Remaining Time</span>
                          <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatRemainingTime(remainingSeconds)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-3 font-medium">
                        <span className="flex items-center"><Clock className="mr-1 h-3 w-3" /> {test.durationMinutes} mins</span>
                        <span className="flex items-center"><Target className="mr-1 h-3 w-3" /> {test.questionCount} Qs</span>
                      </div>

                      {isUpcoming ? (
                        <Button size="sm" className="w-full h-8 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0" disabled>
                          Not Yet Available
                        </Button>
                      ) : isClosed ? (
                        <Button size="sm" className="w-full h-8 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0" disabled>
                          Exam Closed
                        </Button>
                      ) : (
                        <Button size="sm" className={`w-full h-8 text-xs font-bold ${hasSchedule ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`} asChild>
                          <Link href={`/exams/${test.id}`}>
                            {hasSchedule ? 'Start Exam' : 'Start Details'}
                          </Link>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 text-center p-4">
                <Clock className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-semibold">No tests scheduled</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Check back later or browse standard test series.</p>
                <Button variant="outline" className="mt-4 w-full h-8 text-xs font-bold" asChild>
                  <Link href="/exams">View Tests</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
