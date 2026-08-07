import { useParams, Link, useLocation } from 'wouter';
import { useGetExam, getGetExamQueryKey, useStartSession, useListSessions, useListResults } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, Target, CheckCircle2, AlertCircle, BookOpen, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServerTime, useSyncedNow, formatHms, formatRemainingTime } from '@/hooks/use-server-time';

export default function ExamDetail() {
  const params = useParams();
  const id = parseInt(params.id || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: exam, isLoading } = useGetExam(id, {
    query: { enabled: !!id, queryKey: getGetExamQueryKey(id) }
  });

  const { data: sessions, isLoading: isLoadingSessions } = useListSessions();
  const { data: resultsResponse, isLoading: isLoadingResults } = useListResults({ limit: 100 });

  const results = resultsResponse?.data || [];
  const lastAttempt = results.find(r => r.examId === id);

  const examSessions = sessions?.filter(s => s.examId === id) || [];
  const activeSession = examSessions.find(s => s.status === 'in_progress');
  const hasCompletedSession = examSessions.some(s => ['submitted', 'auto_submitted', 'completed', 'finished'].includes(s.status));
  const isAttempted = lastAttempt !== undefined || hasCompletedSession;
  const isLoadingStatus = isLoadingSessions || isLoadingResults;

  const { data: serverTime } = useServerTime();
  const now = useSyncedNow(serverTime);

  const startSession = useStartSession();

  const hasSchedule = exam?.scheduledAt !== null && exam?.scheduledAt !== undefined;
  const startMs = hasSchedule ? new Date(exam.scheduledAt!).getTime() : 0;
  const endMs = hasSchedule && exam.endsAt ? new Date(exam.endsAt).getTime() : Infinity;

  const isUpcoming = hasSchedule && now < startMs;
  const isClosed = hasSchedule && now > endMs;
  const isLive = !hasSchedule || (now >= startMs && now <= endMs);

  const handleStartExam = () => {
    startSession.mutate(
      { data: { examId: id } },
      {
        onSuccess: (session) => {
          setLocation(`/exam/${session.id}`);
        },
        onError: (err: any) => {
          const isAttemptedError = err.status === 409 || err.data?.code === 'EXAM_ALREADY_ATTEMPTED';
          toast({
            title: 'Failed to start exam',
            description: isAttemptedError 
              ? (err.data?.message || 'You have already attempted this exam.')
              : (err.data as { error?: string })?.error || 'Please try again later.',
            variant: 'destructive',
          });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded"></div>
      <div className="h-64 bg-muted rounded-xl"></div>
    </div>;
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-bold">Exam Not Found</h3>
        <p className="text-muted-foreground mt-2">The test you are looking for does not exist or has been removed.</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/exams">Back to Tests</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/exams" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Test Series
        </Link>
        
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="secondary" className="uppercase tracking-wider text-xs font-semibold px-3 py-1">
            {exam.type.replace('_', ' ')}
          </Badge>
          {exam.categoryName && (
            <span className="text-sm font-medium text-primary">{exam.categoryName}</span>
          )}
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{exam.title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {exam.description || 'No description provided for this test.'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-md border-0 bg-card">
          <CardHeader>
            <CardTitle>Exam Structure</CardTitle>
            <CardDescription>Sections and marks distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {exam.sections && exam.sections.length > 0 ? (
              <div className="space-y-4">
                {exam.sections.map((section, idx) => (
                  <div key={section.id} className="flex items-center justify-between p-4 rounded-lg border bg-background">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{section.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{section.questionCount} Questions</p>
                      </div>
                    </div>
                    {section.durationMinutes && (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {section.durationMinutes} mins
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground">
                This test has a single unified section.
              </div>
            )}

            <Separator className="my-6" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Questions</span>
                <p className="text-2xl font-bold">{exam.totalQuestions}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Marks</span>
                <p className="text-2xl font-bold">{exam.totalMarks}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Correct</span>
                <p className="text-2xl font-bold text-green-700">+{exam.positiveMarks}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Incorrect</span>
                <p className="text-2xl font-bold text-red-700">-{exam.negativeMarks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={`${isUpcoming ? 'border-amber-500/50' : isLive && hasSchedule ? 'border-emerald-500/50' : 'border-primary'} shadow-lg overflow-hidden relative`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${isUpcoming ? 'bg-amber-500' : isLive && hasSchedule ? 'bg-emerald-500' : 'bg-primary'}`}></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className={`h-5 w-5 ${isUpcoming ? 'text-amber-500' : isLive && hasSchedule ? 'text-emerald-500' : 'text-primary'}`} />
                {isUpcoming ? 'Starts In' : isLive && hasSchedule ? 'Remaining Time' : 'Duration'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isUpcoming ? (
                <div className="text-3xl font-mono font-black text-amber-600 dark:text-amber-400">
                  {formatHms(startMs - now)}
                </div>
              ) : isLive && hasSchedule ? (
                <div className="text-4xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {formatRemainingTime(Math.max(0, Math.floor((endMs - now) / 1000)))}
                </div>
              ) : isClosed ? (
                <div className="text-3xl font-bold text-slate-500">
                  Exam Closed
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-foreground">{exam.durationMinutes}</div>
                  <p className="text-sm text-muted-foreground mt-1">Minutes</p>
                </>
              )}
            </CardContent>
            <CardFooter className={`${isUpcoming ? 'bg-amber-500/5' : isLive && hasSchedule ? 'bg-emerald-500/5' : 'bg-primary/5'} pt-4`}>
              {isUpcoming ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg shadow-md bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0 hover:bg-slate-100"
                  disabled
                >
                  Not Yet Available
                </Button>
              ) : isClosed ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg shadow-md bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0 hover:bg-slate-100"
                  disabled
                >
                  Exam Closed
                </Button>
              ) : isLoadingStatus ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg shadow-md bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0 hover:bg-slate-100"
                  disabled
                >
                  Checking Status...
                </Button>
              ) : activeSession ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg font-bold h-12 shadow-md hover:shadow-lg transition-all bg-amber-600 hover:bg-amber-700 text-white"
                  asChild
                >
                  <Link href={`/exam/${activeSession.id}`}>
                    Resume Exam
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (exam.type === 'full_mock' || exam.type === 'weekly_quiz') && lastAttempt ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg font-bold h-12 shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/95 text-primary-foreground"
                  asChild
                >
                  <Link href={`/results/${lastAttempt.id}`}>
                    View Result
                  </Link>
                </Button>
              ) : (exam.type === 'full_mock' || exam.type === 'weekly_quiz') && isAttempted ? (
                <Button 
                  size="lg" 
                  className="w-full text-lg shadow-md bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0 hover:bg-slate-100"
                  disabled
                >
                  Already Attempted
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className={`w-full text-lg shadow-md hover:shadow-lg transition-all ${hasSchedule ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-primary hover:bg-primary/95 text-primary-foreground'}`}
                  onClick={handleStartExam}
                  disabled={startSession.isPending}
                >
                  {startSession.isPending ? 'Preparing Engine...' : hasSchedule ? 'Start Exam' : 'Start Exam Now'}
                  {!startSession.isPending && <ChevronRight className="ml-2 h-5 w-5" />}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Important Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>• Test will auto-submit when timer ends.</p>
              <p>• Do not switch tabs or exit fullscreen mode. Your test may be cancelled.</p>
              <p>• Ensure stable internet connection before starting.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
