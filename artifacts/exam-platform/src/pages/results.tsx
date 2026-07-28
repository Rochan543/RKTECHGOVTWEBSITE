import { useListResults, getListResultsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Trophy, Target, Clock, ArrowRight, BarChart3, SearchX } from 'lucide-react';

export default function Results() {
  const { data: resultsResponse, isLoading } = useListResults({ limit: 50 }, {
    query: { queryKey: getListResultsQueryKey({ limit: 50 }) }
  });

  const results = resultsResponse?.data || [];

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground mt-1">Review your past performance and analyze your progress.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {results.map((result) => (
            <Card key={result.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center">
                <CardHeader className="flex-1 pb-2 lg:pb-6">
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-xl">{result.examTitle}</CardTitle>
                    <Badge variant={result.accuracy > 80 ? "default" : result.accuracy > 50 ? "secondary" : "destructive"}>
                      {result.accuracy.toFixed(1)}% Accuracy
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Attempted on {new Date(result.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 py-4 lg:py-6 border-t lg:border-t-0 lg:border-l bg-muted/10">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center"><Target className="h-3 w-3 mr-1" /> Score</span>
                    <p className="text-2xl font-bold text-primary">{result.score} <span className="text-sm font-normal text-muted-foreground">/ {result.totalMarks}</span></p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center"><Trophy className="h-3 w-3 mr-1" /> Rank</span>
                    <p className="text-2xl font-bold">{result.rank ? `#${result.rank}` : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center"><Clock className="h-3 w-3 mr-1" /> Time</span>
                    <p className="text-lg font-semibold mt-1">{Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button variant="default" asChild>
                      <Link href={`/results/${result.id}`}>
                        Analysis <BarChart3 className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <SearchX className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No results yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md">You haven't completed any tests yet. Take a test to start generating performance data.</p>
          <Button className="mt-8" asChild>
            <Link href="/exams">Browse Test Series</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
