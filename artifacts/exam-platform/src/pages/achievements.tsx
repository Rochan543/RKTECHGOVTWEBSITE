import { useListResults, useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Zap, Target, Clock, Award, CheckCircle2, BookOpen, Flame, Medal } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  xp: number;
  category: string;
}

function buildAchievements(totalTests: number, avgScore: number, totalCorrect: number, bestScore: number): Achievement[] {
  return [
    {
      id: 'first_test',
      title: 'First Step',
      description: 'Complete your first test',
      icon: <CheckCircle2 className="h-6 w-6" />,
      unlocked: totalTests >= 1,
      progress: Math.min(totalTests, 1),
      maxProgress: 1,
      xp: 50,
      category: 'Milestone',
    },
    {
      id: 'tests_5',
      title: 'Getting Started',
      description: 'Complete 5 tests',
      icon: <Star className="h-6 w-6" />,
      unlocked: totalTests >= 5,
      progress: Math.min(totalTests, 5),
      maxProgress: 5,
      xp: 100,
      category: 'Milestone',
    },
    {
      id: 'tests_10',
      title: 'Consistent Learner',
      description: 'Complete 10 tests',
      icon: <Flame className="h-6 w-6" />,
      unlocked: totalTests >= 10,
      progress: Math.min(totalTests, 10),
      maxProgress: 10,
      xp: 200,
      category: 'Milestone',
    },
    {
      id: 'tests_25',
      title: 'Dedicated Aspirant',
      description: 'Complete 25 tests',
      icon: <Medal className="h-6 w-6" />,
      unlocked: totalTests >= 25,
      progress: Math.min(totalTests, 25),
      maxProgress: 25,
      xp: 500,
      category: 'Milestone',
    },
    {
      id: 'accuracy_70',
      title: 'Sharp Mind',
      description: 'Achieve 70%+ accuracy',
      icon: <Target className="h-6 w-6" />,
      unlocked: avgScore >= 70,
      progress: Math.round(Math.min(avgScore, 70)),
      maxProgress: 70,
      xp: 150,
      category: 'Accuracy',
    },
    {
      id: 'accuracy_85',
      title: 'Expert Solver',
      description: 'Achieve 85%+ accuracy',
      icon: <Zap className="h-6 w-6" />,
      unlocked: avgScore >= 85,
      progress: Math.round(Math.min(avgScore, 85)),
      maxProgress: 85,
      xp: 300,
      category: 'Accuracy',
    },
    {
      id: 'perfect_score',
      title: 'Perfectionist',
      description: 'Score 100% on any test',
      icon: <Trophy className="h-6 w-6" />,
      unlocked: bestScore >= 100,
      progress: Math.round(Math.min(bestScore, 100)),
      maxProgress: 100,
      xp: 500,
      category: 'Accuracy',
    },
    {
      id: 'correct_100',
      title: 'Century Club',
      description: 'Answer 100 questions correctly',
      icon: <BookOpen className="h-6 w-6" />,
      unlocked: totalCorrect >= 100,
      progress: Math.min(totalCorrect, 100),
      maxProgress: 100,
      xp: 250,
      category: 'Knowledge',
    },
    {
      id: 'correct_500',
      title: 'Knowledge Champion',
      description: 'Answer 500 questions correctly',
      icon: <Award className="h-6 w-6" />,
      unlocked: totalCorrect >= 500,
      progress: Math.min(totalCorrect, 500),
      maxProgress: 500,
      xp: 750,
      category: 'Knowledge',
    },
  ];
}

export default function Achievements() {
  const { data: resultsData, isLoading: resultsLoading } = useListResults({ page: 1, limit: 100 });
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  const results = resultsData?.data ?? [];
  const totalCorrect = results.reduce((s, r) => s + r.correct, 0);
  const bestScore = results.length > 0
    ? Math.max(...results.map(r => Math.round((r.score / r.totalMarks) * 100)))
    : 0;

  const achievements = buildAchievements(
    stats?.totalTestsTaken ?? 0,
    stats?.overallAccuracy ?? 0,
    totalCorrect,
    bestScore,
  );

  const unlocked = achievements.filter(a => a.unlocked);
  const totalXP = unlocked.reduce((s, a) => s + a.xp, 0);
  const categories = [...new Set(achievements.map(a => a.category))];

  if (resultsLoading || statsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid gap-4 md:grid-cols-3">{[...Array(9)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground mt-1">Track your milestones and earn XP</p>
      </div>

      {/* XP card */}
      <div className="rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-6 flex items-center gap-6">
        <Trophy className="h-16 w-16 opacity-70" />
        <div>
          <p className="text-yellow-100 text-sm font-medium">Total XP Earned</p>
          <p className="text-4xl font-bold">{totalXP.toLocaleString()}</p>
          <p className="text-yellow-100 text-sm mt-1">{unlocked.length} / {achievements.length} achievements unlocked</p>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {achievements.filter(a => a.category === category).map((achievement) => (
              <Card
                key={achievement.id}
                className={`transition-all ${achievement.unlocked ? 'border-yellow-300 dark:border-yellow-700 shadow-sm' : 'opacity-60'}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2.5 rounded-xl ${achievement.unlocked ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-muted text-muted-foreground'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{achievement.title}</h3>
                        {achievement.unlocked && <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Unlocked</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{achievement.description}</p>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">+{achievement.xp} XP</span>
                  </div>
                  <Progress
                    value={(achievement.progress / achievement.maxProgress) * 100}
                    className="h-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {achievement.progress} / {achievement.maxProgress}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
