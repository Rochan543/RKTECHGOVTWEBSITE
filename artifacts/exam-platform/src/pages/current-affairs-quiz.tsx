import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Bookmark, Clock, CheckCircle2,
  XCircle, AlertCircle, ArrowLeft, Trophy, BarChart2, BookOpen
} from 'lucide-react';

interface Option {
  id: number;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  id: number;
  text: string;
  type: string;
  difficulty: string;
  imageUrl: string | null;
  positiveMarks: number;
  negativeMarks: number;
  explanation: string | null;
  hint: string | null;
  order: number;
  options: Option[];
}

interface QuizAttempt {
  id: number;
  score: number;
  maxScore: number;
  timeSpent: number;
  completed: boolean;
  answers: string; // JSON string of [{questionId, selectedOptionId, correctOptionId, isCorrect}]
  createdAt: string;
}

interface QuizResponse {
  quiz: {
    id: number;
    title: string;
    description: string | null;
    type: 'daily' | 'weekly' | 'monthly';
    duration: number | null;
    publishedDate: string;
  };
  questions: Question[];
  attempt?: QuizAttempt;
}

export default function CurrentAffairsQuiz() {
  const { id: idParam } = useParams();
  const quizId = parseInt(idParam || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'timed' | 'untimed'>('timed');
  const [isStarted, setIsStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | null>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);

  const timerRef = useRef<any>(null);
  const questionStartRef = useRef<number>(Date.now());

  // Fetch Quiz Details
  const { data, isLoading } = useQuery<QuizResponse>({
    queryKey: ['current-affairs-quiz', quizId],
    queryFn: () => customFetch(`/api/v1/current-affairs/quiz/${quizId}`),
    enabled: !!quizId,
  });

  const quiz = data?.quiz;
  const questions = data?.questions ?? [];
  const attempt = data?.attempt;
  const currentQ = questions[currentIndex];

  // Submit Mutation
  const submitQuizMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/current-affairs/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-quiz', quizId] });
      queryClient.invalidateQueries({ queryKey: ['current-affairs-quizzes'] });
      toast({
        title: 'Quiz Submitted Successfully',
        description: 'Your score has been registered. You can now review the explanations.',
      });
      setIsStarted(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to submit quiz',
        description: err.message || String(err),
        variant: 'destructive',
      });
    },
  });

  // Track total quiz timer
  useEffect(() => {
    if (isStarted && mode === 'timed') {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          // If duration exists and is reached, auto submit
          if (quiz?.duration && prev >= quiz.duration * 60) {
            clearInterval(timerRef.current);
            handleForceSubmit();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, mode, quiz]);

  // Sync question timing on changing current question index
  useEffect(() => {
    if (isStarted && currentQ) {
      questionStartRef.current = Date.now();
    }
  }, [currentIndex, isStarted, currentQ]);

  const handleStartQuiz = () => {
    // Check if timed mode duration is available
    if (mode === 'timed' && !quiz?.duration) {
      // Default to 10 minutes if no duration configured
      quiz!.duration = 10;
    }
    setIsStarted(true);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setQuestionTimes({});
    setElapsedTime(0);
    questionStartRef.current = Date.now();
  };

  const handleOptionSelect = (optionId: number) => {
    if (attempt) return; // Read-only in review mode

    // Save selected answer
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionId,
    }));

    // Save time spent on question
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
    setQuestionTimes((prev) => ({
      ...prev,
      [currentQ.id]: (prev[currentQ.id] || 0) + spent,
    }));
    questionStartRef.current = Date.now(); // reset timer
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      // Record time spent on previous
      const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + spent,
      }));

      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      // Record time spent
      const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + spent,
      }));

      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleForceSubmit = () => {
    // Record time on current question
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const finalTimes = {
      ...questionTimes,
      [currentQ.id]: (questionTimes[currentQ.id] || 0) + spent,
    };

    const formattedAnswers = questions.map((q) => ({
      questionId: q.id,
      selectedOptionId: selectedAnswers[q.id] || null,
      timeSpent: finalTimes[q.id] || 0,
    }));

    submitQuizMutation.mutate({
      quizId,
      answers: formattedAnswers,
    });
  };

  const handleConfirmSubmit = () => {
    setShowConfirmComplete(false);
    handleForceSubmit();
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Quiz not found</h2>
        <Button onClick={() => setLocation('/current-affairs')} className="mt-4 rounded-xl">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // REVIEW MODE LAYOUT (If already completed or attempted)
  if (attempt && !isStarted) {
    const attemptAnswers = attempt.answers ? JSON.parse(attempt.answers) : [];
    const answerMap = new Map(attemptAnswers.map((a: any) => [a.questionId, a]));

    const currentAnswerDetails: any = answerMap.get(currentQ.id);

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setLocation('/current-affairs')}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border-none px-2.5 py-0.5 rounded-md">
            Attempted Compilations
          </Badge>
        </div>

        {/* Results Stats Banner */}
        <Card className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs text-indigo-200 uppercase font-bold tracking-wider">Quiz Title</span>
              <h2 className="text-lg font-extrabold line-clamp-1">{quiz.title}</h2>
            </div>
            <div className="text-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold mb-1">Your Score</span>
              <span className="text-xl font-extrabold">{attempt.score} <span className="text-xs font-semibold text-indigo-300">/ {attempt.maxScore}</span></span>
            </div>
            <div className="text-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold mb-1">Accuracy</span>
              <span className="text-xl font-extrabold">
                {attempt.maxScore > 0 ? `${Math.round((attempt.score / attempt.maxScore) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="text-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <span className="text-[10px] text-indigo-200 block uppercase font-bold mb-1">Time Spent</span>
              <span className="text-xl font-extrabold">{formatTime(attempt.timeSpent)}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Question Display area (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="rounded-xl border">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <div className="flex gap-2">
                    {currentAnswerDetails?.isCorrect ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-xs px-2 py-0.5 rounded">Correct</Badge>
                    ) : currentAnswerDetails?.selectedOptionId ? (
                      <Badge className="bg-red-100 text-red-700 border-none font-bold text-xs px-2 py-0.5 rounded">Incorrect</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-xs px-2 py-0.5 rounded">Skipped</Badge>
                    )}
                  </div>
                </div>

                <div className="text-base font-bold leading-relaxed whitespace-pre-wrap">
                  {currentQ.text}
                </div>

                {currentQ.imageUrl && (
                  <div className="max-h-60 w-full overflow-hidden border rounded-lg">
                    <img src={currentQ.imageUrl} alt="" className="object-contain max-h-60 mx-auto" />
                  </div>
                )}

                {/* Options list */}
                <div className="grid gap-3">
                  {currentQ.options.map((opt) => {
                    const isSelected = opt.id === currentAnswerDetails?.selectedOptionId;
                    const isCorrect = opt.isCorrect;
                    
                    let optStyle = 'border-muted hover:border-slate-300';
                    if (isSelected && isCorrect) {
                      optStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 font-bold';
                    } else if (isSelected && !isCorrect) {
                      optStyle = 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-300 font-bold';
                    } else if (isCorrect) {
                      optStyle = 'border-emerald-500 bg-emerald-50/50 text-emerald-900 dark:bg-emerald-950/10 dark:text-emerald-300 font-bold';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`border rounded-lg p-3 text-xs flex items-center justify-between ${optStyle}`}
                      >
                        <span className="font-semibold">{opt.text}</span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                        {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {/* Question Explanation Box */}
                {currentQ.explanation && (
                  <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/30 rounded-lg">
                    <CardContent className="p-4 space-y-2">
                      <h4 className="text-xs font-bold text-primary flex items-center gap-1 uppercase tracking-wide">
                        <BookOpen className="h-3.5 w-3.5" /> Explanation
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium">
                        {currentQ.explanation}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Navigation footer */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="gap-1 rounded-lg text-xs"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="gap-1 rounded-lg text-xs"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Question Palette Sidebar (4 cols) */}
          <div className="lg:col-span-4">
            <Card className="rounded-xl border">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-primary" /> Questions Navigator
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const qAns: any = answerMap.get(q.id);
                    let btnClass = 'bg-muted hover:bg-slate-200 text-muted-foreground';
                    
                    if (idx === currentIndex) {
                      btnClass = 'bg-primary text-primary-foreground border-2 border-primary ring-2 ring-primary/20 ring-offset-2';
                    } else if (qAns?.isCorrect) {
                      btnClass = 'bg-emerald-500 text-white hover:bg-emerald-600';
                    } else if (qAns?.selectedOptionId) {
                      btnClass = 'bg-red-500 text-white hover:bg-red-600';
                    } else {
                      btnClass = 'bg-slate-300 text-slate-700 hover:bg-slate-400';
                    }

                    return (
                      <button
                        key={q.id}
                        className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${btnClass}`}
                        onClick={() => setCurrentIndex(idx)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ WELCOME SCREEN (Choose mode, start button)
  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-10 pb-12">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setLocation('/current-affairs')}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="p-6 md:p-8 text-center space-y-3">
            <Badge className="bg-primary/10 text-primary w-fit mx-auto border-none uppercase text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {quiz.type} compilation
            </Badge>
            <CardTitle className="text-2xl font-bold tracking-tight">{quiz.title}</CardTitle>
            {quiz.description && <CardDescription className="text-sm">{quiz.description}</CardDescription>}
          </CardHeader>
          <CardContent className="p-6 md:p-8 pt-0 space-y-6">
            <div className="grid grid-cols-2 gap-4 border-y py-4 text-center text-sm font-semibold">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-bold uppercase">Questions</span>
                <span className="text-lg text-foreground">{questions.length} Questions</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-bold uppercase">Time Limit</span>
                <span className="text-lg text-foreground">{quiz.duration || 10} Mins</span>
              </div>
            </div>

            {/* Mode selection config */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-center">Choose Practice Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`border-2 rounded-xl p-4 cursor-pointer text-center space-y-1 hover:border-primary/50 transition-colors ${
                    mode === 'timed' ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}
                  onClick={() => setMode('timed')}
                >
                  <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
                  <span className="text-xs font-bold block">Timed Mode</span>
                  <span className="text-[10px] text-muted-foreground block">Has time limit, auto-submits.</span>
                </div>
                <div
                  className={`border-2 rounded-xl p-4 cursor-pointer text-center space-y-1 hover:border-primary/50 transition-colors ${
                    mode === 'untimed' ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}
                  onClick={() => setMode('untimed')}
                >
                  <BookOpen className="h-5 w-5 mx-auto text-primary mb-1" />
                  <span className="text-xs font-bold block">Untimed Mode</span>
                  <span className="text-[10px] text-muted-foreground block">No time limit, practice relaxed.</span>
                </div>
              </div>
            </div>

            <Button onClick={handleStartQuiz} className="w-full h-11 rounded-lg gap-1.5 font-bold">
              <Trophy className="h-4 w-4" /> Start Daily Learning Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // QUIZ TAKING LAYOUT (Timed/Untimed active mode)
  const durationLimit = (quiz.duration || 10) * 60;
  const isSelected = selectedAnswers[currentQ.id] !== undefined && selectedAnswers[currentQ.id] !== null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Quiz Progress header with timers */}
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border">
        <div>
          <h2 className="text-sm font-bold truncate max-w-xs">{quiz.title}</h2>
          <span className="text-[10px] text-muted-foreground uppercase font-bold">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {mode === 'timed' && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              <Clock className="h-3.5 w-3.5" />
              <span>Time Left: {formatTime(Math.max(0, durationLimit - elapsedTime))}</span>
            </div>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="text-xs font-bold rounded-lg px-3.5"
            onClick={() => setShowConfirmComplete(true)}
          >
            Submit Quiz
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Question / Options selection */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-xl border">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded">
                  Marks: +{currentQ.positiveMarks} / -{currentQ.negativeMarks}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold capitalize">
                  Difficulty: {currentQ.difficulty}
                </span>
              </div>

              <div className="text-base font-bold leading-relaxed whitespace-pre-wrap">
                {currentQ.text}
              </div>

              {currentQ.imageUrl && (
                <div className="max-h-60 w-full overflow-hidden border rounded-lg">
                  <img src={currentQ.imageUrl} alt="" className="object-contain max-h-60 mx-auto" />
                </div>
              )}

              {/* Options mapping */}
              <div className="grid gap-3 pt-2">
                {currentQ.options.map((opt) => {
                  const active = selectedAnswers[currentQ.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      className={`w-full border rounded-lg p-3 text-left text-xs font-semibold transition-all hover:bg-slate-50 ${
                        active 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-muted text-foreground'
                      }`}
                      onClick={() => handleOptionSelect(opt.id)}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Navigation Controls footer */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="gap-1 rounded-lg text-xs"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="gap-1 rounded-lg text-xs"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Question grid palette sidebar (4 cols) */}
        <div className="lg:col-span-4">
          <Card className="rounded-xl border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold">Questions Grid</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== null;
                  let paletteStyle = 'bg-muted text-muted-foreground hover:bg-slate-200';
                  
                  if (idx === currentIndex) {
                    paletteStyle = 'bg-primary text-primary-foreground border-2 border-primary ring-2 ring-primary/20 ring-offset-2';
                  } else if (isAnswered) {
                    paletteStyle = 'bg-indigo-600 text-white hover:bg-indigo-700';
                  }

                  return (
                    <button
                      key={q.id}
                      className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${paletteStyle}`}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog on submit click */}
      <Dialog open={showConfirmComplete} onOpenChange={setShowConfirmComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz Attempt?</DialogTitle>
            <DialogDescription>
              Are you sure you want to finish this quiz? You have answered{' '}
              {Object.values(selectedAnswers).filter(Boolean).length} out of {questions.length} questions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmComplete(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSubmit} 
              disabled={submitQuizMutation.isPending}
            >
              Confirm and Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
