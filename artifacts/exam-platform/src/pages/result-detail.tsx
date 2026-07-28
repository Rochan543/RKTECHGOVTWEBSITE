import { useParams, Link } from 'wouter';
import { useGetResult, getGetResultQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Target, Trophy, Clock, CheckCircle2, XCircle, MinusCircle, AlertCircle, BookOpen } from 'lucide-react';

export default function ResultDetail() {
  const params = useParams();
  const id = parseInt(params.id || '0', 10);

  const { data: result, isLoading } = useGetResult(id, {
    query: { enabled: !!id, queryKey: getGetResultQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded"></div>
      <div className="h-64 bg-muted rounded-xl"></div>
    </div>;
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-bold">Result Not Found</h3>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/results">Back to Results</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/results" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Results
        </Link>
        
        <h1 className="text-3xl font-bold tracking-tight">{result.examTitle} - Analysis</h1>
        <p className="text-muted-foreground mt-1">
          Attempted on {new Date(result.attemptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-primary text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Total Score</p>
                <p className="text-4xl font-bold">{result.score} <span className="text-xl font-normal opacity-80">/ {result.totalMarks}</span></p>
              </div>
              <Target className="h-8 w-8 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">All India Rank</p>
                <p className="text-4xl font-bold text-foreground">{result.rank ? `#${result.rank}` : 'N/A'}</p>
                {result.percentile && <p className="text-xs text-muted-foreground">{result.percentile.toFixed(1)} Percentile</p>}
              </div>
              <Trophy className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Accuracy</p>
                <p className="text-4xl font-bold text-foreground">{result.accuracy.toFixed(1)}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Time Taken</p>
                <p className="text-3xl font-bold text-foreground">{Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Attempt Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">
                  <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5" /> Correct</div>
                  <div className="text-xl font-bold">{result.correct}</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  <div className="flex items-center gap-2 font-medium"><XCircle className="h-5 w-5" /> Incorrect</div>
                  <div className="text-xl font-bold">{result.incorrect}</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                  <div className="flex items-center gap-2 font-medium"><MinusCircle className="h-5 w-5" /> Skipped</div>
                  <div className="text-xl font-bold">{result.skipped}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="solutions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="solutions">Solutions & Explanations</TabsTrigger>
              <TabsTrigger value="subjects">Subject Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="solutions" className="mt-6 space-y-6">
              {result.questions.map((q, idx) => (
                <Card key={q.questionId} className={`overflow-hidden border-l-4 ${q.isSkipped ? 'border-l-slate-400' : q.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">Q.{idx + 1}</span>
                        {q.isSkipped ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-100">Skipped</Badge>
                        ) : q.isCorrect ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Correct (+{q.marksAwarded})</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Incorrect ({q.marksAwarded})</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Clock className="mr-1 h-3 w-3" /> {q.timeSpentSeconds}s
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-base font-medium mb-6">{q.text}</div>
                    
                    <div className="space-y-3 mb-6">
                      {q.options?.map((opt, i) => {
                        const isChosen = opt.id === q.yourAnswer;
                        const isCorrectOpt = opt.id === q.correctAnswer;
                        
                        let optClass = "border p-3 rounded-lg flex gap-3 ";
                        if (isCorrectOpt) {
                          optClass += "bg-green-50 border-green-200 text-green-900 font-medium";
                        } else if (isChosen && !isCorrectOpt) {
                          optClass += "bg-red-50 border-red-200 text-red-900";
                        } else {
                          optClass += "bg-background text-muted-foreground";
                        }

                        return (
                          <div key={opt.id} className={optClass}>
                            <div className="font-bold">{String.fromCharCode(65 + i)}.</div>
                            <div>{opt.text}</div>
                            {isChosen && <div className="ml-auto text-xs font-bold uppercase tracking-wider">Your Answer</div>}
                            {isCorrectOpt && !isChosen && <div className="ml-auto text-xs font-bold uppercase tracking-wider text-green-700">Correct Answer</div>}
                          </div>
                        );
                      })}
                    </div>
                    
                    {q.explanation && (
                      <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" /> Explanation
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-6 space-y-4">
              {result.subjectBreakdown.map((subj) => (
                <Card key={subj.subjectId}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">{subj.subjectName}</h3>
                      <Badge variant={subj.accuracy > 70 ? 'default' : subj.accuracy > 40 ? 'secondary' : 'destructive'}>
                        {subj.accuracy.toFixed(1)}% Accuracy
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="text-2xl font-bold text-green-700">{subj.correct}</div>
                        <div className="text-xs font-medium text-green-800 uppercase tracking-wider mt-1">Correct</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <div className="text-2xl font-bold text-red-700">{subj.incorrect}</div>
                        <div className="text-xs font-medium text-red-800 uppercase tracking-wider mt-1">Incorrect</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="text-2xl font-bold text-slate-700">{subj.skipped}</div>
                        <div className="text-xs font-medium text-slate-600 uppercase tracking-wider mt-1">Skipped</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
