import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useReportQuestionMutation } from '@/hooks/use-analytics';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useParams } from 'wouter';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkX,
  Flag,
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Option {
  id: number;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  text: string;
  type: string;
  difficulty: string;
  explanation: string | null;
  hint: string | null;
  imageUrl: string | null;
  positiveMarks: number;
  negativeMarks: number;
  subjectName: string | null;
  topicName: string | null;
  options: Option[];
  isBookmarked: boolean;
  selectedOptionId: number | null;
  timeSpentSeconds: number;
  status: 'unvisited' | 'visited' | 'answered' | 'skipped';
  flagged: boolean;
}

interface PracticeSessionResponse {
  session: {
    id: number;
    mode: 'timed' | 'untimed';
    status: 'in_progress' | 'completed';
    totalQuestions: number;
    currentQuestionIndex: number;
    startedAt: string;
    durationSeconds?: number;
  };
  questions: Question[];
}

export default function PracticeSession() {
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = parseInt(sessionIdParam || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reportMutation = useReportQuestionMutation();

  // Local state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  // Track start time for current question to compute duration
  const questionStartTimeRef = useRef<number>(Date.now());

  // Fetch practice session details
  const { data, isLoading } = useQuery<PracticeSessionResponse>({
    queryKey: ['practice-session', sessionId],
    queryFn: () => customFetch(`/api/v1/practice/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  const session = data?.session;
  const questions = data?.questions ?? [];
  const currentQ = questions[currentIndex];

  const completePracticeRef = useRef<() => void>(() => {});

  // Sync elapsed or countdown timer
  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;

    const started = new Date(session.startedAt).getTime();

    if (session.mode === 'timed') {
      const duration = session.durationSeconds || (session.totalQuestions * 90);
      
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          toast({ title: 'Time is up!', description: 'Submitting your practice session...', variant: 'default' });
          completePracticeRef.current();
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      // Untimed mode: elapsed time counts up
      setElapsedTime(Math.floor((Date.now() - started) / 1000));

      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - started) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [session]);

  // Sync initial question index from session
  const hasSyncedInitialIndexRef = useRef(false);
  useEffect(() => {
    if (session && !hasSyncedInitialIndexRef.current) {
      if (session.currentQuestionIndex >= 0 && session.currentQuestionIndex < questions.length) {
        setCurrentIndex(session.currentQuestionIndex);
      }
      hasSyncedInitialIndexRef.current = true;
    }
  }, [session, questions.length]);

  // Sync state when current question changes
  useEffect(() => {
    if (currentQ) {
      setSelectedOptionId(currentQ.selectedOptionId);
      // Reset question timer
      questionStartTimeRef.current = Date.now();
      // Show explanation if already answered in untimed mode
      setShowExplanation(session?.mode === 'untimed' && currentQ.selectedOptionId !== null);
    }
  }, [currentIndex, currentQ, session?.mode]);

  // Mutations
  const submitAnswerMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch(`/api/v1/practice/sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['practice-session', sessionId] });
      if (session?.mode === 'untimed') {
        setShowExplanation(true);
      } else {
        // In timed mode, move next automatically
        handleNext();
      }
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save response', description: String(err.message || err), variant: 'destructive' });
    },
  });

  const flagMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch(`/api/v1/practice/sessions/${sessionId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-session', sessionId] });
      toast({ title: 'Question status updated' });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: ({ qId, isBookmarked }: { qId: number; isBookmarked: boolean }) => {
      if (isBookmarked) {
        return customFetch(`/api/v1/bookmarks/${qId}`, { method: 'DELETE' });
      }
      return customFetch('/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['practice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['adaptive'] });
      toast({ title: currentQ?.isBookmarked ? 'Bookmark removed' : 'Question bookmarked' });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/v1/practice/sessions/${sessionId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Practice session completed!' });
      setLocation(`/practice/results/${sessionId}`);
    },
    onError: (err: any) => {
      toast({ title: 'Completion failed', description: String(err.message || err), variant: 'destructive' });
    },
  });

  const handleCompletePractice = () => {
    completeSessionMutation.mutate();
  };

  useEffect(() => {
    completePracticeRef.current = handleCompletePractice;
  }, [handleCompletePractice]);

  if (isLoading || !session) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return hrs > 0
      ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optId: number) => {
    // In untimed mode, disable modifying answer once verified
    if (session.mode === 'untimed' && currentQ.selectedOptionId !== null) return;
    setSelectedOptionId(optId);
  };

  const handleSaveAnswer = () => {
    if (selectedOptionId === null) return;

    const timeTakenSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    submitAnswerMutation.mutate({
      questionId: currentQ.id,
      selectedOptionId,
      timeTakenSeconds,
      status: 'answered',
    });
  };

  const handleSkip = () => {
    const timeTakenSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    submitAnswerMutation.mutate({
      questionId: currentQ.id,
      selectedOptionId: null,
      timeTakenSeconds,
      status: 'skipped',
    });
    handleNext();
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleToggleFlag = () => {
    flagMutation.mutate({
      questionId: currentQ.id,
      flagged: !currentQ.flagged,
    });
  };

  const handleToggleBookmark = () => {
    bookmarkMutation.mutate({
      qId: currentQ.id,
      isBookmarked: currentQ.isBookmarked,
    });
  };

  const handleReportQuestion = () => {
    if (!reportReason.trim() || !currentQ) return;
    reportMutation.mutate({
      questionId: currentQ.id,
      reason: reportReason,
    }, {
      onSuccess: () => {
        toast({ title: 'Report submitted', description: 'Thank you. Our review team will verify the report.' });
        setShowReportDialog(false);
        setReportReason('');
      },
      onError: (err: any) => {
        toast({
          title: 'Failed to submit report',
          description: err.message || 'Something went wrong.',
          variant: 'destructive'
        });
      }
    });
  };

  const difficultyColors = {
    easy: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-rose-700 dark:text-rose-400 border-red-500/20',
  }[currentQ?.difficulty ?? 'medium'];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-300">
      {/* Top Navigation / Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setLocation('/practice')} className="h-9 px-3 rounded-lg text-slate-500">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quit Practice
          </Button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider capitalize hidden sm:block">
            {session.mode} Practice Mode
          </span>
        </div>

        {/* Time elapsed / Countdown */}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-full border">
          <Clock className="h-4 w-4 text-indigo-500" />
          <span className="font-mono text-sm font-bold">
            {session.mode === 'timed' ? formatTime(timeLeft ?? 0) : formatTime(elapsedTime)}
          </span>
        </div>

        {/* Action button */}
        <Button
          onClick={() => setShowCompleteConfirm(true)}
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl h-9 text-xs"
        >
          Submit Session
        </Button>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left column: Question area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {/* Subject/Difficulty header */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                {currentQ.subjectName && (
                  <Badge variant="secondary" className="text-[10px] font-bold py-0.5 rounded-full">
                    {currentQ.subjectName}
                  </Badge>
                )}
                {currentQ.topicName && (
                  <Badge variant="outline" className="text-[10px] font-bold py-0.5 rounded-full">
                    {currentQ.topicName}
                  </Badge>
                )}
                <Badge variant="outline" className={`capitalize text-[9px] font-bold py-0.5 rounded-full ${difficultyColors}`}>
                  {currentQ.difficulty}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleToggleBookmark} className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  {currentQ.isBookmarked ? (
                    <BookmarkX className="h-4 w-4 text-indigo-600 fill-indigo-600" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleToggleFlag} className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <Flag className={`h-4 w-4 ${currentQ.flagged ? 'text-purple-600 fill-purple-600' : 'text-slate-500'}`} />
                </Button>
              </div>
            </div>

            {/* Question Text */}
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-card rounded-2xl">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed text-sm md:text-base select-none">
                  {currentQ.text}
                </div>

                {currentQ.imageUrl && (
                  <div className="rounded-xl overflow-hidden border bg-slate-50 dark:bg-slate-900 p-2 flex justify-center">
                    <img src={currentQ.imageUrl} alt="Question figure" className="max-h-60 w-auto object-contain rounded-lg" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Option</h4>
              <div className="space-y-2.5">
                {currentQ.options.map((opt, i) => {
                  const isSelected = selectedOptionId === opt.id;
                  const hasAnswered = currentQ.selectedOptionId !== null;

                  // Compute formatting for immediate feedback in untimed mode
                  let optionClass = 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-card';
                  let bulletClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500';

                  if (session.mode === 'untimed' && hasAnswered) {
                    if (opt.isCorrect) {
                      optionClass = 'border-green-500 bg-green-50/20 text-green-900 dark:text-green-300 dark:bg-green-950/20';
                      bulletClass = 'bg-green-500 text-white';
                    } else if (isSelected && !opt.isCorrect) {
                      optionClass = 'border-red-500 bg-red-50/20 text-red-900 dark:text-red-300 dark:bg-red-950/20';
                      bulletClass = 'bg-red-500 text-white';
                    } else {
                      optionClass = 'border-slate-100 dark:border-slate-800 opacity-60 bg-card';
                    }
                  } else {
                    if (isSelected) {
                      optionClass = 'border-indigo-600 bg-indigo-50/10 text-indigo-900 dark:text-indigo-300';
                      bulletClass = 'bg-indigo-600 text-white';
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      disabled={session.mode === 'untimed' && hasAnswered}
                      className={`w-full text-left py-3.5 px-4 rounded-xl border-2 transition-all flex items-center gap-3.5 min-h-[52px] font-medium text-sm md:text-base focus:outline-none ${optionClass}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${bulletClass}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <div className="flex-1 text-slate-700 dark:text-slate-200 text-sm leading-snug">{opt.text}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation panel (Immediate feedback for untimed mode) */}
            {showExplanation && currentQ.explanation && (
              <Card className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <BookOpen className="h-4 w-4" /> Explanation & Concept
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm leading-relaxed">{currentQ.explanation}</p>
                </CardContent>
              </Card>
            )}

            {/* Action panel */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="h-10 px-4 rounded-xl text-xs font-bold"
              >
                Previous
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowReportDialog(true)}
                  className="text-xs text-muted-foreground hover:text-slate-800 h-10 px-3.5 rounded-xl font-semibold"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" /> Report Issue
                </Button>

                {session.mode === 'untimed' && currentQ.selectedOptionId === null ? (
                  <>
                    <Button variant="outline" onClick={handleSkip} className="h-10 px-4 rounded-xl text-xs font-bold">
                      Skip Question
                    </Button>
                    <Button
                      onClick={handleSaveAnswer}
                      disabled={selectedOptionId === null}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold h-10 px-5 rounded-xl text-xs"
                    >
                      Check Answer
                    </Button>
                  </>
                ) : session.mode === 'timed' ? (
                  <>
                    <Button variant="outline" onClick={handleSkip} className="h-10 px-4 rounded-xl text-xs font-bold mr-2">
                      Skip Question
                    </Button>
                    {selectedOptionId !== null && selectedOptionId !== currentQ.selectedOptionId ? (
                      <Button
                        onClick={handleSaveAnswer}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold h-10 px-5 rounded-xl text-xs flex items-center gap-1"
                      >
                        {currentIndex === questions.length - 1 ? 'Save Answer' : 'Save & Next'} <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={currentIndex === questions.length - 1}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold h-10 px-5 rounded-xl text-xs flex items-center gap-1"
                      >
                        Next Question <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={currentIndex === questions.length - 1}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold h-10 px-5 rounded-xl text-xs flex items-center gap-1"
                  >
                    Next Question <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Question palette */}
        <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l flex flex-col p-5 space-y-5 flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm text-foreground">Practice Progress</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Completed {questions.filter((q) => q.status === 'answered').length} of {questions.length} questions
            </p>
          </div>

          {/* Palette grid */}
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 overflow-y-auto max-h-48 lg:max-h-none flex-1 pr-1">
            {questions.map((q, idx) => {
              let btnClass = 'bg-slate-50 border text-slate-600 dark:bg-slate-800 dark:text-slate-400';
              if (idx === currentIndex) {
                btnClass = 'ring-2 ring-indigo-600 bg-white border-indigo-600 text-indigo-600 dark:bg-slate-900 font-extrabold';
              } else if (q.status === 'answered') {
                btnClass = 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400 dark:bg-green-950/20 font-bold';
              } else if (q.flagged) {
                btnClass = 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400 dark:bg-purple-950/20 font-bold';
              } else if (q.status === 'skipped') {
                btnClass = 'bg-slate-200 border-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`aspect-square w-full rounded-xl flex items-center justify-center text-xs font-semibold focus:outline-none transition-all ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold border-t pt-4">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 border inline-block"></span> Unvisited
            </div>
            <div className="flex items-center gap-1.5 text-green-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-green-500/20 border-green-500/20 inline-block"></span> Answered
            </div>
            <div className="flex items-center gap-1.5 text-purple-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-purple-500/20 border-purple-500/20 inline-block"></span> Flagged
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 inline-block"></span> Skipped
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Complete Practice Dialog */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Complete Practice Session?</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to finish this practice set? This will calculate your statistics and unlock detailed results.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowCompleteConfirm(false)} className="rounded-xl text-xs h-9">
              Continue Practice
            </Button>
            <Button
              onClick={handleCompletePractice}
              disabled={completeSessionMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 font-bold"
            >
              {completeSessionMutation.isPending ? 'Saving Results...' : 'Finish Practice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Question Issue Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Report Question Error</DialogTitle>
            <DialogDescription className="text-xs">
              Please describe the issue with this question (e.g. translation mistake, incorrect options, typos).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-background resize-none focus:outline-indigo-500"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowReportDialog(false)} className="rounded-xl text-xs h-9">
              Cancel
            </Button>
            <Button
              onClick={handleReportQuestion}
              disabled={!reportReason.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 font-bold"
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
