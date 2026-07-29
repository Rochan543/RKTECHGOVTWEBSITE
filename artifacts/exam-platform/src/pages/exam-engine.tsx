import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { 
  useGetSession, 
  getGetSessionQueryKey, 
  useSubmitAnswer, 
  useSubmitSession,
  customFetch,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, BookmarkIcon, List, EyeOff, Calculator, X, Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { optimizeCloudinaryUrl } from '@/lib/utils';

type ViolationType = 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'context_menu' | 'copy_attempt';

async function recordViolation(sessionId: number, type: ViolationType): Promise<{ autoSubmitted?: boolean; violationCount?: number }> {
  try {
    const data = await customFetch<{ autoSubmitted?: boolean; violationCount?: number }>(`/api/v1/sessions/${sessionId}/violations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    return data || {};
  } catch { /* silent */ }
  return {};
}

// Status colors mapping
const statusColors = {
  not_visited: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  visited: 'bg-red-600 text-white border-red-600',
  answered: 'bg-green-600 text-white border-green-600',
  marked: 'bg-orange-500 text-white border-orange-500',
  marked_answered: 'bg-purple-600 text-white border-purple-600',
};

export default function ExamEngine() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [sectionTimeLeft, setSectionTimeLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [localSelectedOption, setLocalSelectedOption] = useState<number | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolationType, setLastViolationType] = useState<ViolationType | null>(null);
  const [maxViolations, setMaxViolations] = useState(5);
  const [hasEntered, setHasEntered] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Timer tracking per question
  const questionStartTimeRef = useRef<number>(Date.now());
  const engineRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  const { data: session, isLoading } = useGetSession(sessionId, {
    query: { 
      enabled: !!sessionId, 
      queryKey: getGetSessionQueryKey(sessionId),
      refetchOnWindowFocus: false,
    }
  });

  const submitAnswer = useSubmitAnswer();
  const submitSession = useSubmitSession();

  // Active section helper
  const currentQ = session?.questions[currentIndex];
  const activeSection = session && currentQ ? session.sections.find((s: any) => s.id === currentQ.sectionId) : null;

  // Initialize time and local state
  // Load initial violations count
  useEffect(() => {
    if (sessionId && session?.status === 'in_progress') {
      customFetch(`/api/v1/sessions/${sessionId}/violations`)
        .then((res: any) => {
          if (res && typeof res.total === 'number') {
            setViolationCount(res.total);
            setMaxViolations(res.maxViolations || 5);
          }
        })
        .catch(err => console.error(err));
    }
  }, [sessionId, session?.status]);

  useEffect(() => {
    if (session && timeLeft === null && session.status === 'in_progress') {
      const started = new Date(session.startedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - started) / 1000);
      const totalSeconds = session.durationMinutes * 60;
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(remaining);
      
      // Fullscreen requested on user gesture overlay
      setIsFullscreen(true);
    }
  }, [session, timeLeft]);

  // Mobile detection for calculator layout
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize and track sectional timer
  useEffect(() => {
    if (!session || !activeSection || session.status !== 'in_progress') {
      setSectionTimeLeft(null);
      return;
    }

    if (activeSection.durationMinutes) {
      // Derive section start time from the exam start + sum of all preceding
      // sections' durations.  This is fully server-authoritative: no
      // localStorage or in-memory state needed, so it survives page refreshes.
      const examStartMs = new Date(session.startedAt).getTime();
      const precedingMs = session.sections
        .filter((s: any) => s.order < activeSection.order && s.durationMinutes)
        .reduce((acc: number, s: any) => acc + s.durationMinutes * 60 * 1000, 0);
      const sectionStartMs = examStartMs + precedingMs;
      const elapsed = Math.floor((Date.now() - sectionStartMs) / 1000);
      const limit = activeSection.durationMinutes * 60;
      const remaining = Math.max(0, limit - elapsed);
      setSectionTimeLeft(remaining);
    } else {
      setSectionTimeLeft(null);
    }
  }, [session, activeSection?.id, sessionId]);

  // Section Timer Ticker
  useEffect(() => {
    if (sectionTimeLeft === null || sectionTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setSectionTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleSectionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sectionTimeLeft]);

  const handleSectionEnd = () => {
    if (!session || !activeSection) return;
    toast({ title: `Section "${activeSection.name}" time expired!`, variant: "destructive" });
    
    // Find next section
    const nextSec = session.sections.find((s: any) => s.order === activeSection.order + 1);
    if (nextSec && activeSection.autoMove !== false) {
      const nextQIndex = session.questions.findIndex((q: any) => q.sectionId === nextSec.id);
      if (nextQIndex >= 0) {
        setCurrentIndex(nextQIndex);
        toast({ title: `Moving to Section: ${nextSec.name}` });
        return;
      }
    }
    
    handleAutoSubmit();
  };

  // Initialize per-question timer
  useEffect(() => {
    if (session && session.questionTimerSeconds && session.status === 'in_progress') {
      setQuestionTimeLeft(session.questionTimerSeconds);
    } else {
      setQuestionTimeLeft(null);
    }
  }, [session, currentIndex]);

  // Question Timer Ticker
  useEffect(() => {
    if (questionTimeLeft === null || questionTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleQuestionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questionTimeLeft]);

  const handleQuestionEnd = () => {
    if (!session) return;
    toast({ title: "Question timer expired!", description: "Moving to next question...", variant: "default" });
    
    const status = localSelectedOption ? 'answered' : 'visited';
    saveCurrentAnswer(status);

    if (currentIndex + 1 < session.questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleAutoSubmit();
    }
  };

  // Update local selection when changing questions
  useEffect(() => {
    if (session?.questions && session.questions[currentIndex]) {
      const q = session.questions[currentIndex];
      setLocalSelectedOption(q.selectedOptionId || null);
      questionStartTimeRef.current = Date.now();
      isInitialLoadRef.current = true;
    }
  }, [currentIndex, session]);

  // Automatically mark current question as visited if it is not_visited
  useEffect(() => {
    if (session && session.status === 'in_progress' && hasEntered) {
      const q = session.questions[currentIndex];
      if (q && q.status === 'not_visited') {
        queryClient.setQueryData(getGetSessionQueryKey(sessionId), (old: any) => {
          if (!old) return old;
          const updatedQs = [...old.questions];
          updatedQs[currentIndex] = {
            ...updatedQs[currentIndex],
            status: 'visited'
          };
          return { ...old, questions: updatedQs };
        });

        const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
        submitAnswer.mutate({
          id: sessionId,
          data: {
            questionId: q.questionId,
            selectedOptionId: q.selectedOptionId || null,
            status: 'visited',
            timeSpentSeconds: timeSpent
          }
        });
      }
    }
  }, [currentIndex, session, hasEntered]);

  // Auto-Save Trigger on Selection Change
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    
    if (session && session.autoSave !== false && session.status === 'in_progress') {
      const q = session.questions[currentIndex];
      if (q) {
        const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
        const status = localSelectedOption ? 'answered' : 'visited';
        
        queryClient.setQueryData(getGetSessionQueryKey(sessionId), (old: any) => {
          if (!old) return old;
          const updatedQs = [...old.questions];
          updatedQs[currentIndex] = {
            ...updatedQs[currentIndex],
            status: status,
            selectedOptionId: localSelectedOption
          };
          return { ...old, questions: updatedQs };
        });

        submitAnswer.mutate({
          id: sessionId,
          data: {
            questionId: q.questionId,
            selectedOptionId: localSelectedOption,
            status: status,
            timeSpentSeconds: timeSpent
          }
        });
      }
    }
  }, [localSelectedOption]);

  // Master Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        
        // Warnings
        if (prev === 600) toast({ title: "10 Minutes Remaining", variant: "destructive" });
        if (prev === 300) toast({ title: "5 Minutes Remaining", variant: "destructive" });
        if (prev === 60) toast({ title: "1 Minute Remaining", variant: "destructive" });
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, toast]);

  // Anti-cheat violation handler ref — set after handleAutoSubmit is declared below
  const handleViolationAutoSubmitRef = useRef<() => void>(() => {});

  const triggerRecordViolation = useCallback((type: ViolationType) => {
    recordViolation(sessionId, type).then((r: any) => {
      // Invalidate dashboard stats and user stats immediately
      queryClient.invalidateQueries({ queryKey: ['/api/v1/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });

      if (r.autoSubmitted) {
        handleViolationAutoSubmitRef.current();
      } else {
        if (r.violationCount !== undefined) {
          setViolationCount(r.violationCount);
          setMaxViolations(r.maxViolations || 5);
          setLastViolationType(type);
          setShowWarning(true);
        }
      }
    });
  }, [sessionId, queryClient]);

  // Prevent right click and copy
  useEffect(() => {
    const preventDefault = (e: Event) => {
      e.preventDefault();
      if (sessionId && session?.status === 'in_progress') {
        const type = e.type === 'contextmenu' ? 'context_menu' : 'copy_attempt';
        triggerRecordViolation(type as ViolationType);
      }
    };
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
    };
  }, [sessionId, session?.status, triggerRecordViolation]);

  const handleAutoSubmit = useCallback(() => {
    if (!session || session.status !== 'in_progress') return;
    toast({ title: "Time's up! Auto-submitting exam...", variant: "default" });
    submitSession.mutate(
      { id: sessionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/v1/dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
          setLocation(`/results`);
        },
        onError: () => setLocation(`/dashboard`)
      }
    );
  }, [session, sessionId, submitSession, setLocation, toast, queryClient]);

  // Keep the violation auto-submit ref in sync
  handleViolationAutoSubmitRef.current = handleAutoSubmit;

  // Anti-cheat: Fullscreen + Tab Switch + Window Blur monitoring
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;

    const onFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        triggerRecordViolation('fullscreen_exit');
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerRecordViolation('tab_switch');
      }
    };

    const onWindowBlur = () => {
      triggerRecordViolation('window_blur');
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [session?.status, sessionId, toast]);

  const saveCurrentAnswer = (newStatus: 'answered' | 'marked' | 'marked_answered' | 'visited', nextIndex?: number) => {
    if (!session || session.status !== 'in_progress') return;
    const q = session.questions[currentIndex];
    if (!q) return;

    queryClient.setQueryData(getGetSessionQueryKey(sessionId), (old: any) => {
      if (!old) return old;
      const updatedQs = [...old.questions];
      updatedQs[currentIndex] = {
        ...updatedQs[currentIndex],
        status: newStatus,
        selectedOptionId: localSelectedOption
      };
      return { ...old, questions: updatedQs };
    });

    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    submitAnswer.mutate({
      id: sessionId,
      data: {
        questionId: q.questionId,
        selectedOptionId: localSelectedOption,
        status: newStatus,
        timeSpentSeconds: timeSpent
      }
    }, {
      onSuccess: () => {
        if (nextIndex !== undefined && nextIndex >= 0 && nextIndex < session.questions.length) {
          setCurrentIndex(nextIndex);
        }
      }
    });
  };

  const handleSaveAndNext = () => {
    const status = localSelectedOption ? 'answered' : 'visited';
    saveCurrentAnswer(status, currentIndex + 1);
  };

  const handleMarkForReview = () => {
    const status = localSelectedOption ? 'marked_answered' : 'marked';
    saveCurrentAnswer(status, currentIndex + 1);
  };

  const handleClearResponse = () => {
    setLocalSelectedOption(null);
  };

  const handleJumpToQuestion = (index: number) => {
    if (session?.questionTimerSeconds) {
      toast({ title: "Navigation Restricted", description: "Jumping questions is disabled in timed quiz mode.", variant: "destructive" });
      return;
    }

    const targetQ = session?.questions[index];
    const targetSection = session?.sections.find((s: any) => s.id === targetQ?.sectionId);
    
    if (activeSection && targetSection && targetSection.order < activeSection.order) {
      if (activeSection.navigationRule === 'lock_previous') {
        toast({ title: "Navigation Blocked", description: "This section is locked. You cannot return to previous sections.", variant: "destructive" });
        return;
      }
    }

    // Save current as visited if not answered
    const currentQ = session?.questions[currentIndex];
    if (currentQ && currentQ.status === 'not_visited' && !localSelectedOption) {
      saveCurrentAnswer('visited', index);
    } else {
      // Just jump, the current status is preserved
      setCurrentIndex(index);
    }
  };

  const handleFinalSubmit = () => {
    // Save current question first before submitting
    const status = localSelectedOption ? 'answered' : 'visited';
    saveCurrentAnswer(status);
    
    submitSession.mutate({ id: sessionId }, {
      onSuccess: (res) => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(e => console.log(e));
        }
        queryClient.invalidateQueries({ queryKey: ['/api/v1/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
        setLocation(`/results`);
      },
      onError: (err) => {
        toast({ title: 'Error submitting exam', description: (err.data as { error?: string })?.error, variant: 'destructive' });
      }
    });
  };

  if (isLoading || !session) {
    return <div className="h-screen w-full flex items-center justify-center bg-indigo-950 text-white">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-indigo-400 border-t-white rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">Loading Exam Environment...</h2>
      </div>
    </div>;
  }

  if (session.status !== 'in_progress') {
    return <div className="h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <AlertTriangle className="h-16 w-16 text-orange-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Exam Not Active</h2>
      <p className="text-muted-foreground mb-6">This exam session has already been submitted or abandoned.</p>
      <Button onClick={() => setLocation('/dashboard')}>Return to Dashboard</Button>
    </div>;
  }

  if (session.status === 'in_progress' && !hasEntered) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-white p-4">
        <Card className="max-w-md w-full border-0 shadow-2xl bg-slate-900 text-white">
          <CardHeader className="text-center pb-2">
            <Shield className="h-12 w-12 text-primary mx-auto mb-3" />
            <CardTitle className="text-2xl font-bold">Secure Exam Environment</CardTitle>
            <CardDescription className="text-slate-400">
              You are about to enter the official testing environment for {session.examTitle}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-sm text-slate-300">
            <p>• Fullscreen mode is mandatory and will be locked during the exam.</p>
            <p>• Tab switching, minimizing the window, or copying content is strictly monitored.</p>
            <p>• Ensure your browser fullscreen permissions are active.</p>
            
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg shadow-md mt-6"
              onClick={() => {
                setHasEntered(true);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(e => {
                    console.error("Fullscreen request failed:", e);
                  });
                }
              }}
            >
              Enter Exam Mode
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate palette stats
  const stats = session.questions.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={engineRef} className="h-[100dvh] w-full bg-background flex flex-col select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#1e293b] text-white flex items-center justify-between px-4 flex-shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg hidden md:block">{session.examTitle}</div>
        </div>
        
        <div className="flex items-center gap-6">
          {activeSection && (
            <div className="text-sm font-semibold px-3 py-1 bg-slate-800 rounded-md border border-slate-700 hidden sm:block">
              Section: <span className="text-yellow-400">{activeSection.name}</span>
            </div>
          )}
          
          {sectionTimeLeft !== null && (
            <div className="flex items-center gap-2 bg-purple-950 px-3 py-1.5 rounded-md border border-purple-800 animate-pulse">
              <Clock className="h-4 w-4 text-purple-400" />
              <span className="font-mono text-sm font-bold tracking-wider text-purple-200">
                Sec Time: {formatTime(sectionTimeLeft).slice(3)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
            <Clock className={`h-4 w-4 ${timeLeft && timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`} />
            <span className={`font-mono text-lg font-bold tracking-wider ${timeLeft && timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Pane - Question Area */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="h-12 bg-muted/30 border-b flex items-center justify-between px-4 flex-shrink-0">
            <h3 className="font-semibold">Question {currentIndex + 1} of {session.questions.length}</h3>
            {activeSection && <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded sm:hidden">Section: {activeSection.name}</span>}
          </div>

          {questionTimeLeft !== null && session.questionTimerSeconds && (
            <div className="w-full bg-slate-100 dark:bg-slate-900 h-4 flex-shrink-0 relative overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${questionTimeLeft < 10 ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}
                style={{ width: `${(questionTimeLeft / session.questionTimerSeconds) * 100}%` }}
              ></div>
              <div className="absolute right-3 top-0.5 text-[10px] font-bold text-muted-foreground">
                Question Timer: {questionTimeLeft}s remaining
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-auto p-6 lg:p-10 scroll-smooth">
            <div className="max-w-4xl mx-auto">
              <div className="text-xl leading-relaxed font-medium mb-8 text-foreground select-none">
                {currentQ?.text}
              </div>
              
              {currentQ?.imageUrl && (
                <div className="mb-8 rounded-lg overflow-hidden border inline-block">
                  <img src={optimizeCloudinaryUrl(currentQ.imageUrl, { width: 800 })} alt="Question figure" className="max-h-80 object-contain" draggable="false" loading="lazy" />
                </div>
              )}

              <div className="space-y-4">
                {(currentQ?.options ?? []).map((opt, i) => (
                  <div 
                    key={opt.id}
                    onClick={() => setLocalSelectedOption(opt.id)}
                    className={`
                      p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4
                      ${localSelectedOption === opt.id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'}
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors
                      ${localSelectedOption === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div className="text-lg">{opt.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Action Footer */}
          <div className="h-16 bg-card border-t flex items-center justify-between px-4 lg:px-8 flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClearResponse}
                disabled={!localSelectedOption || !!session.questionTimerSeconds}
                className="hidden sm:flex"
              >
                Clear Response
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleMarkForReview}
                disabled={!!session.questionTimerSeconds}
                className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"
              >
                Mark for Review & Next
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveAndNext}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[140px] shadow-sm"
              >
                Save & Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Pane - Question Palette */}
        <div className="w-full md:w-80 bg-slate-50 flex flex-col flex-shrink-0 border-l shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-100 border-b">
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <List className="h-4 w-4" /> Question Palette
            </div>
            
            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-xs text-slate-600">
              <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-md border ${statusColors.answered}`}></div> Answered ({stats.answered || 0})</div>
              <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-md border ${statusColors.visited}`}></div> Not Answered ({stats.visited || 0})</div>
              <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-md border ${statusColors.not_visited}`}></div> Not Visited ({stats.not_visited || 0})</div>
              <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-md border ${statusColors.marked}`}></div> Marked ({stats.marked || 0})</div>
              <div className="flex items-center gap-2 col-span-2"><div className={`w-5 h-5 rounded-md border relative ${statusColors.marked_answered}`}></div> Answered & Marked for Review ({stats.marked_answered || 0})</div>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-5 gap-2">
              {session.questions.map((q, i) => {
                let sClass = statusColors[q.status];
                const isActive = currentIndex === i;
                
                const targetQ = q;
                const targetSection = session.sections.find((s: any) => s.id === targetQ.sectionId);
                const isSectionLocked = activeSection && targetSection && targetSection.order < activeSection.order && activeSection.navigationRule === 'lock_previous';
                const isQuizTimerLocked = !!session.questionTimerSeconds && i !== currentIndex;
                const isLocked = isSectionLocked || isQuizTimerLocked;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => !isLocked && handleJumpToQuestion(i)}
                    disabled={isLocked}
                    className={`
                      h-10 rounded-md font-medium text-sm border shadow-sm transition-all relative flex items-center justify-center
                      ${isLocked ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-50' : sClass}
                      ${isActive ? 'ring-2 ring-primary ring-offset-2 scale-110 z-10' : !isLocked ? 'hover:opacity-80' : ''}
                    `}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="p-4 border-t bg-slate-100 flex-shrink-0">
            <Button 
              variant="default" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg shadow-md"
              onClick={() => setShowSubmitConfirm(true)}
            >
              Submit Test
            </Button>
          </div>
        </div>
      </div>

      {/* Warnings & Modals */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-md border-destructive/50 border-2">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-red-600">
              Security Violation Detected
            </DialogTitle>
            <div className="text-center text-sm font-semibold text-muted-foreground mt-1">
              Exam: <span className="text-foreground">{session?.examTitle}</span>
            </div>
            <DialogDescription asChild className="pt-4 text-center">
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-red-800 dark:text-red-300 font-medium">
                  {lastViolationType === 'tab_switch' && "Tab switching or minimizing is strictly prohibited."}
                  {lastViolationType === 'window_blur' && "Focus lost! Leaving the exam window is not allowed."}
                  {lastViolationType === 'fullscreen_exit' && "You exited fullscreen mode. You must remain in fullscreen."}
                  {lastViolationType === 'context_menu' && "Right-clicking is not allowed during the exam."}
                  {lastViolationType === 'copy_attempt' && "Copying text is not allowed during the exam."}
                  {!lastViolationType && "A security violation was detected."}
                </div>
                <div className="grid grid-cols-2 gap-4 text-center mt-2">
                  <div className="bg-muted p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">Violations Logged</p>
                    <p className="text-lg font-bold text-destructive">{violationCount} / {maxViolations}</p>
                  </div>
                  <div className="bg-muted p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">Remaining Attempts</p>
                    <p className="text-lg font-bold text-green-600">{Math.max(0, maxViolations - violationCount)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  If you reach {maxViolations} violations, your exam will be automatically submitted immediately.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => {
                setShowWarning(false);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(e => console.log(e));
                }
              }}
            >
              Return to Exam
            </Button>
            <Button 
              variant="outline"
              className="flex-1"
              onClick={() => setShowWarning(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Final Exam?</DialogTitle>
            <DialogDescription asChild className="pt-2 text-base">
              <div className="text-sm text-muted-foreground">
                You are about to submit your exam. Once submitted, you cannot change any answers.
                <div className="mt-4 bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between"><span>Answered:</span> <span className="font-bold text-green-600">{stats.answered || 0}</span></div>
                  <div className="flex justify-between"><span>Not Answered:</span> <span className="font-bold text-red-500">{stats.visited || 0}</span></div>
                  <div className="flex justify-between"><span>Marked for Review:</span> <span className="font-bold text-purple-600">{(stats.marked || 0) + (stats.marked_answered || 0)}</span></div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowSubmitConfirm(false)}>
              Continue Test
            </Button>
            <Button 
              variant="default" 
              className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold" 
              onClick={handleFinalSubmit}
              disabled={submitSession.isPending}
            >
              {submitSession.isPending ? 'Submitting...' : 'Confirm Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Calculator Toggle Button */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/95 flex items-center justify-center border-0"
          onClick={() => setShowCalculator(!showCalculator)}
        >
          <Calculator className="h-6 w-6" />
        </Button>
      </div>

      {showCalculator && (
        <CalculatorPanel onClose={() => setShowCalculator(false)} isMobile={isMobile} />
      )}
    </div>
  );
}

// ─── Calculator Panel Component ──────────────────────────────────────────────────

function CalculatorPanel({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleDigit = (digit: string) => {
    setDisplay((prev) => (prev === '0' ? digit : prev + digit));
  };

  const handleOperator = (op: string) => {
    setEquation((prev) => prev + display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleBackspace = () => {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleEqual = () => {
    try {
      const fullEq = equation + display;
      const sanitized = fullEq.replace(/[^0-9+\-*/. ]/g, '');
      const result = new Function(`return ${sanitized}`)();
      setDisplay(String(Number(result.toFixed(8))));
      setEquation('');
    } catch {
      setDisplay('Error');
    }
  };

  return (
    <div className={`
      bg-card border border-border/85 shadow-2xl rounded-xl overflow-hidden flex flex-col z-50
      ${isMobile 
        ? 'fixed bottom-0 left-0 w-full h-[360px] animate-in slide-in-from-bottom border-t border-t-border/100' 
        : 'fixed right-4 bottom-20 w-80 h-[400px] animate-in fade-in zoom-in-95'}
    `}>
      <div className="bg-[#1e293b] text-white px-4 py-2.5 flex items-center justify-between">
        <span className="font-semibold text-xs uppercase tracking-wider">Calculator</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between gap-2.5">
        {/* Screen */}
        <div className="bg-background border rounded-lg p-2.5 text-right shadow-inner">
          <div className="text-[10px] text-muted-foreground min-h-[14px] truncate font-mono">{equation}</div>
          <div className="text-xl font-bold font-mono truncate text-foreground">{display}</div>
        </div>
        {/* Buttons Grid */}
        <div className="grid grid-cols-4 gap-1.5 flex-1">
          <Button variant="outline" className="font-bold text-destructive font-mono hover:bg-destructive/10 hover:text-destructive h-full text-xs" onClick={handleClear}>C</Button>
          <Button variant="outline" className="font-mono h-full text-xs" onClick={handleBackspace}>⌫</Button>
          <Button variant="outline" className="font-mono h-full text-xs" onClick={() => handleOperator('/')}>/</Button>
          <Button variant="outline" className="font-mono h-full text-xs" onClick={() => handleOperator('*')}>*</Button>

          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('7')}>7</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('8')}>8</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('9')}>9</Button>
          <Button variant="outline" className="font-mono h-full text-xs" onClick={() => handleOperator('-')}>-</Button>

          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('4')}>4</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('5')}>5</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('6')}>6</Button>
          <Button variant="outline" className="font-mono h-full text-xs" onClick={() => handleOperator('+')}>+</Button>

          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('1')}>1</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('2')}>2</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('3')}>3</Button>
          <Button variant="default" className="row-span-2 font-mono font-bold bg-primary text-primary-foreground flex items-center justify-center text-lg h-full" onClick={handleEqual}>=</Button>

          <Button variant="secondary" className="col-span-2 font-mono h-full text-xs" onClick={() => handleDigit('0')}>0</Button>
          <Button variant="secondary" className="font-mono h-full text-xs" onClick={() => handleDigit('.')}>.</Button>
        </div>
      </div>
    </div>
  );
}
