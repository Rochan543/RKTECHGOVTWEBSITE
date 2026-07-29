import { useState } from 'react';
import { useListResults, getListResultsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { Trophy, Target, Clock, BarChart3, SearchX, Search, SlidersHorizontal, ArrowUpDown, Calendar, Percent } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Results() {
  const { data: resultsResponse, isLoading } = useListResults({ limit: 50 }, {
    query: { queryKey: getListResultsQueryKey({ limit: 50 }) }
  });

  const results = resultsResponse?.data || [];

  // Filter & Sorting State
  const [search, setSearch] = useState('');
  const [accuracyFilter, setAccuracyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Calculate metrics based on ALL results
  const totalAttempts = results.length;
  const avgScore = results.length
    ? (results.reduce((sum, r) => sum + (r.score / r.totalMarks), 0) / results.length * 100).toFixed(1)
    : '0.0';
  const avgAccuracy = results.length
    ? (results.reduce((sum, r) => sum + r.accuracy, 0) / results.length).toFixed(1)
    : '0.0';
  const totalMinutes = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.timeTakenSeconds, 0) / 60)
    : 0;

  // Filtered results
  const filteredResults = results.filter((result) => {
    const matchesSearch = result.examTitle.toLowerCase().includes(search.toLowerCase());
    
    let matchesAccuracy = true;
    if (accuracyFilter === 'high') matchesAccuracy = result.accuracy >= 80;
    else if (accuracyFilter === 'med') matchesAccuracy = result.accuracy >= 50 && result.accuracy < 80;
    else if (accuracyFilter === 'low') matchesAccuracy = result.accuracy < 50;

    return matchesSearch && matchesAccuracy;
  });

  // Sorted results
  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime();
    if (sortBy === 'oldest') return new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime();
    if (sortBy === 'score-desc') return (b.score / b.totalMarks) - (a.score / a.totalMarks);
    if (sortBy === 'score-asc') return (a.score / a.totalMarks) - (b.score / b.totalMarks);
    return 0;
  });

  // Chronological score progress for chart (last 8 attempts)
  const progressData = [...results]
    .reverse()
    .slice(-8)
    .map((r) => ({
      name: r.examTitle.length > 15 ? r.examTitle.substring(0, 12) + '...' : r.examTitle,
      Score: Math.round((r.score / r.totalMarks) * 100),
      Accuracy: Math.round(r.accuracy)
    }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 will-change-[transform,opacity]">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">My Results</h1>
        <p className="text-muted-foreground mt-1.5 text-base">Track your exam performances, analyze progress trends, and review detailed solutions.</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
            ))}
          </div>
        </div>
      ) : results.length > 0 ? (
        <>
          {/* Stats Cards Dashboard */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border/60 shadow-xs hover:shadow-sm transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Attempts</p>
                  <p className="text-3xl font-extrabold text-foreground">{totalAttempts}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <Calendar className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs hover:shadow-sm transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Score</p>
                  <p className="text-3xl font-extrabold text-foreground">{avgScore}%</p>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                  <Trophy className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs hover:shadow-sm transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Accuracy</p>
                  <p className="text-3xl font-extrabold text-foreground">{avgAccuracy}%</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                  <Percent className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs hover:shadow-sm transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Practice Time</p>
                  <p className="text-3xl font-extrabold text-foreground">{totalMinutes} <span className="text-sm font-semibold text-muted-foreground">mins</span></p>
                </div>
                <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-500">
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart Trend */}
          {progressData.length > 1 && (
            <Card className="border border-border/60 shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">Performance Trend</CardTitle>
                <CardDescription>Visualizing score vs accuracy percentages over your last {progressData.length} attempts.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="accuracyColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <Tooltip formatter={(value) => [`${value}%`]} />
                    <Area type="monotone" dataKey="Score" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
                    <Area type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#accuracyColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Filtering and Search Controls */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mock test name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 rounded-xl border-border/70 focus:border-primary"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <Select value={accuracyFilter} onValueChange={setAccuracyFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] rounded-xl border-border/70">
                    <SelectValue placeholder="Accuracy Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accuracies</SelectItem>
                    <SelectItem value="high">High (&ge; 80%)</SelectItem>
                    <SelectItem value="med">Medium (50% - 80%)</SelectItem>
                    <SelectItem value="low">Low (&lt; 50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[160px] rounded-xl border-border/70">
                    <SelectValue placeholder="Sort Results" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="score-desc">Highest Score</SelectItem>
                    <SelectItem value="score-asc">Lowest Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results List */}
          {sortedResults.length > 0 ? (
            <div className="grid gap-4">
              {sortedResults.map((result) => {
                const pctScore = ((result.score / result.totalMarks) * 100);
                return (
                  <Card key={result.id} className="overflow-hidden border border-border/60 hover:border-primary/40 shadow-xs hover:shadow-md transition-all duration-300 rounded-2xl group">
                    <div className="flex flex-col lg:flex-row lg:items-center">
                      <CardHeader className="flex-1 pb-4 lg:pb-6 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{result.examTitle}</CardTitle>
                          <Badge 
                            variant={result.accuracy >= 80 ? "default" : result.accuracy >= 50 ? "secondary" : "destructive"}
                            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          >
                            {result.accuracy.toFixed(1)}% Accuracy
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center font-medium">
                          Attempted on {new Date(result.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 px-6 border-t lg:border-t-0 lg:border-l border-border/50 bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center"><Target className="h-3.5 w-3.5 mr-1 text-primary/80" /> Score</span>
                          <p className="text-2xl font-extrabold text-primary">{result.score} <span className="text-xs font-semibold text-muted-foreground">/ {result.totalMarks}</span></p>
                          <p className="text-[10px] font-medium text-emerald-600">({pctScore.toFixed(1)}%)</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center"><Trophy className="h-3.5 w-3.5 mr-1 text-yellow-500/80" /> Rank</span>
                          <p className="text-2xl font-extrabold text-foreground">{result.rank ? `#${result.rank}` : '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1 text-sky-500/80" /> Time</span>
                          <p className="text-xl font-bold text-foreground mt-0.5">{Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s</p>
                        </div>
                        <div className="flex items-center justify-end">
                          <Button variant="default" asChild className="rounded-xl font-bold shadow-xs hover:shadow-md transition-all group-hover:bg-primary">
                            <Link href={`/results/${result.id}`}>
                              Analysis <BarChart3 className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border/50 rounded-2xl">
              <div className="h-20 w-20 bg-muted/60 rounded-full flex items-center justify-center mb-6">
                <SearchX className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No matches found</h3>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">No results match your search query or accuracy filters. Try clearing or relaxing them.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-border/50 rounded-2xl">
          <div className="h-20 w-20 bg-muted/60 rounded-full flex items-center justify-center mb-6">
            <SearchX className="h-10 w-10 text-muted-foreground animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No results yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">You haven't completed any tests yet. Take a test to start generating performance statistics.</p>
          <Button className="mt-8 rounded-xl font-bold py-6 px-6 shadow-md hover:shadow-lg transition-all" asChild>
            <Link href="/exams">Browse Test Series</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
