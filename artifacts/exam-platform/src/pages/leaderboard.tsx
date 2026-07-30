import { useState } from 'react';
import { 
  useGetLeaderboard, 
  getGetLeaderboardQueryKey,
  useListSubjects,
  useListExams
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Trophy, Medal, Crown, Filter, MapPin, School, BookOpen, Target } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { optimizeCloudinaryUrl } from '@/lib/utils';

export default function Leaderboard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'overall'>('overall');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [collegeFilter, setCollegeFilter] = useState<string>('');
  const { user } = useAuth();

  // Fetch filters list
  const { data: subjectsData } = useListSubjects();
  const { data: examsData } = useListExams();

  const subjects = subjectsData || [];
  const exams = examsData?.data || [];

  // Query parameters mapping
  const queryParams = {
    period,
    subjectId: selectedSubject !== 'all' ? Number(selectedSubject) : undefined,
    examId: selectedExam !== 'all' ? Number(selectedExam) : undefined,
    city: cityFilter.trim() || undefined,
    college: collegeFilter.trim() || undefined,
    limit: 100
  };

  const { data: leaderboard, isLoading } = useGetLeaderboard(queryParams, {
    query: { 
      queryKey: getGetLeaderboardQueryKey(queryParams)
    }
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">Compare your standing with top aspirants across India. Filter by city, subject, or college.</p>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Rank Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Subject Select */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><BookOpen className="h-3 w-3" /> Subject</span>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exam Select */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Target className="h-3 w-3" /> Specific Mock</span>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="All Mocks" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Mocks</SelectItem>
                  {exams.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City input */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><MapPin className="h-3 w-3" /> City</span>
              <Input 
                placeholder="Enter city..." 
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>

            {/* College input */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><School className="h-3 w-3" /> College</span>
              <Input 
                placeholder="Enter college..." 
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period selection tabs */}
      <div className="flex justify-center">
        <Tabs value={period} onValueChange={(v: any) => setPeriod(v)} className="w-[450px]">
          <TabsList className="grid w-full grid-cols-4 rounded-xl h-10 p-1">
            <TabsTrigger value="daily" className="rounded-lg text-xs font-bold">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-lg text-xs font-bold">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-lg text-xs font-bold">Monthly</TabsTrigger>
            <TabsTrigger value="overall" className="rounded-lg text-xs font-bold">Overall</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
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
                <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboard.map((entry) => {
                const isCurrentUser = user?.id === entry.userId;
                return (
                  <div 
                    key={entry.userId} 
                    className={`grid grid-cols-12 gap-4 items-center p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30 ${isCurrentUser ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                  >
                    <div className="col-span-2 md:col-span-1 flex justify-center items-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="col-span-6 md:col-span-5 flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-10 w-10 border border-slate-200 shadow-sm flex-shrink-0">
                        <AvatarImage src={optimizeCloudinaryUrl(entry.avatarUrl, { width: 80, height: 80 })} />
                        <AvatarFallback className={isCurrentUser ? 'bg-primary text-primary-foreground font-black' : 'font-black'}>
                          {entry.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className={`font-semibold text-xs truncate ${isCurrentUser ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>
                          {entry.name} {isCurrentUser && <span className="text-[9px] font-bold ml-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-500 uppercase">You</span>}
                        </p>
                        {((entry as any).city || (entry as any).college) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {(entry as any).city && <span>{(entry as any).city}</span>}
                            {(entry as any).city && (entry as any).college && <span> • </span>}
                            {(entry as any).college && <span>{(entry as any).college}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-2 text-right">
                      <span className="font-bold text-base text-slate-800 dark:text-slate-100">{entry.score.toLocaleString()}</span>
                    </div>
                    <div className="hidden md:block col-span-2 text-right font-bold text-xs text-muted-foreground">
                      {entry.accuracy.toFixed(1)}%
                    </div>
                    <div className="hidden md:block col-span-2 text-right font-bold text-xs text-muted-foreground">
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
               <p className="text-muted-foreground max-w-sm mt-1 text-xs">Check back later when more tests have been completed matching these filters.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
