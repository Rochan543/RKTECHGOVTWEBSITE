import { useState } from 'react';
import { useGetLeaderboard, getGetLeaderboardQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Crown } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function Leaderboard() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'overall'>('weekly');
  const { user } = useAuth();

  const { data: leaderboard, isLoading } = useGetLeaderboard({ period, limit: 100 }, {
    query: { queryKey: getGetLeaderboardQueryKey({ period, limit: 100 }) }
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500" />;
      case 2: return <Medal className="h-6 w-6 text-slate-400 fill-slate-400" />;
      case 3: return <Medal className="h-6 w-6 text-amber-700 fill-amber-700" />;
      default: return <span className="font-bold text-muted-foreground w-6 text-center">{rank}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">Compare your standing with top aspirants across India.</p>
      </div>

      <div className="flex justify-center">
        <Tabs value={period} onValueChange={(v: any) => setPeriod(v)} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="overall">Overall</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-0 shadow-lg bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2 md:col-span-1 text-center">Rank</div>
            <div className="col-span-6 md:col-span-5">Aspirant</div>
            <div className="col-span-4 md:col-span-2 text-right">Score</div>
            <div className="hidden md:block col-span-2 text-right">Accuracy</div>
            <div className="hidden md:block col-span-2 text-right">Tests</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="divide-y">
              {leaderboard.map((entry) => {
                const isCurrentUser = user?.id === entry.userId;
                return (
                  <div 
                    key={entry.userId} 
                    className={`grid grid-cols-12 gap-4 items-center p-4 transition-colors hover:bg-muted/50 ${isCurrentUser ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                  >
                    <div className="col-span-2 md:col-span-1 flex justify-center items-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="col-span-6 md:col-span-5 flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-10 w-10 border shadow-sm flex-shrink-0">
                        <AvatarImage src={entry.avatarUrl || ''} />
                        <AvatarFallback className={isCurrentUser ? 'bg-primary text-primary-foreground' : ''}>
                          {entry.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className={`font-semibold truncate ${isCurrentUser ? 'text-primary' : ''}`}>
                          {entry.name} {isCurrentUser && <span className="text-xs ml-2 opacity-70">(You)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-2 text-right">
                      <span className="font-bold text-lg">{entry.score.toLocaleString()}</span>
                    </div>
                    <div className="hidden md:block col-span-2 text-right font-medium text-muted-foreground">
                      {entry.accuracy.toFixed(1)}%
                    </div>
                    <div className="hidden md:block col-span-2 text-right font-medium text-muted-foreground">
                      {entry.testsCount}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
             <div className="py-24 flex flex-col items-center text-center">
               <Trophy className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
               <p className="text-lg font-medium text-foreground">No rankings yet</p>
               <p className="text-muted-foreground max-w-sm mt-1">Check back later when more tests have been completed in this period.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
