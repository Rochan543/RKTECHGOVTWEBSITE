import { useParams, Link, useLocation } from 'wouter';
import { useGetExam, getGetExamQueryKey, useStartSession } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, Target, CheckCircle2, AlertCircle, BookOpen, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ExamDetail() {
  const params = useParams();
  const id = parseInt(params.id || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: exam, isLoading } = useGetExam(id, {
    query: { enabled: !!id, queryKey: getGetExamQueryKey(id) }
  });

  const startSession = useStartSession();

  const handleStartExam = () => {
    startSession.mutate(
      { data: { examId: id } },
      {
        onSuccess: (session) => {
          setLocation(`/exam/${session.id}`);
        },
        onError: (err) => {
          toast({
            title: 'Failed to start exam',
            description: (err.data as { error?: string })?.error || 'Please try again later.',
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
          <Card className="border-primary shadow-lg overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{exam.durationMinutes}</div>
              <p className="text-sm text-muted-foreground mt-1">Minutes</p>
            </CardContent>
            <CardFooter className="bg-primary/5 pt-4">
              <Button 
                size="lg" 
                className="w-full text-lg shadow-md hover:shadow-lg transition-all"
                onClick={handleStartExam}
                disabled={startSession.isPending}
              >
                {startSession.isPending ? 'Preparing Engine...' : 'Start Exam Now'}
                {!startSession.isPending && <ChevronRight className="ml-2 h-5 w-5" />}
              </Button>
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
