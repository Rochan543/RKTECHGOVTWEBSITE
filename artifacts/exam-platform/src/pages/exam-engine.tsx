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
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, BookmarkIcon, List, EyeOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

type ViolationType = 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'context_menu' | 'copy_attempt';

async function recordViolation(sessionId: number, type: ViolationType): Promise<{ autoSubmitted?: boolean; violationCount?: number }> {
  try {
    const res = await customFetch(`/api/v1/sessions/${sessionId}/violations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }) as Response;
    if (res.ok) return res.json() as Promise<{ autoSubmitted?: boolean; violationCount?: number }>;
  } catch { /* silent */ }
  return {};
}

// Status colors mapping
const statusColors = {
  not_visited: 'bg-muted text-muted-foreground border-muted-foreground/30',
  visited: 'bg-background text-foreground border-destructive text-destructive', // Using red border for not answered (visited) as per typical SSC pattern
  answered: 'bg-green-600 text-white border-green-600',
  marked: 'bg-purple-600 text-white border-purple-600',
  marked_answered: 'bg-purple-600 text-white border-purple-600 after:content-[""] after:absolute after:-bottom-1 after:-right-1 after:w-3 after:h-3 after:bg-green-500 after:rounded-full after:border-2 after:border-background',
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
  useEffect(() => {
    if (session && timeLeft === null && session.status === 'in_progress') {
      const started = new Date(session.startedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - started) / 1000);
      const totalSeconds = session.durationMinutes * 60;
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(remaining);
      
      // Try to enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => {
          console.error("Fullscreen request failed:", e);
        });
      }
    }
  }, [session, timeLeft]);

  // Initialize and track sectional timer
  useEffect(() => {
    if (!session || !activeSection || session.status !== 'in_progress') {
      setSectionTimeLeft(null);
      return;
    }

    if (activeSection.durationMinutes) {
      const sectionStorageKey = `section_start_${sessionId}_${activeSection.id}`;
      let sectionStart = localStorage.getItem(sectionStorageKey);
      if (!sectionStart) {
        sectionStart = String(Date.now());
        localStorage.setItem(sectionStorageKey, sectionStart);
      }
      
      const elapsed = Math.floor((Date.now() - parseInt(sectionStart, 10)) / 1000);
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
        submitAnswer.mutate({
          id: sessionId,
          data: {
            questionId: q.questionId,
            selectedOptionId: localSelectedOption,
            status: localSelectedOption ? 'answered' : 'visited',
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

  // Prevent right click and copy
  useEffect(() => {
    const preventDefault = (e: Event) => {
      e.preventDefault();
      if (sessionId && session?.status === 'in_progress') {
        recordViolation(sessionId, e.type === 'contextmenu' ? 'context_menu' : 'copy_attempt');
      }
    };
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
    };
  }, [sessionId, session?.status]);

  const handleAutoSubmit = useCallback(() => {
    if (!session || session.status !== 'in_progress') return;
    toast({ title: "Time's up! Auto-submitting exam...", variant: "default" });
    submitSession.mutate(
      { id: sessionId },
      {
        onSuccess: () => setLocation(`/results`),
        onError: () => setLocation(`/dashboard`)
      }
    );
  }, [session, sessionId, submitSession, setLocation, toast]);

  // Keep the violation auto-submit ref in sync
  handleViolationAutoSubmitRef.current = handleAutoSubmit;

  // Anti-cheat: Fullscreen + Tab Switch + Window Blur monitoring
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;

    const onFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        setShowWarning(true);
        recordViolation(sessionId, 'fullscreen_exit').then((r) => {
          if (r.autoSubmitted) handleViolationAutoSubmitRef.current();
          else if (r.violationCount) toast({ title: `⚠️ Violation ${r.violationCount}/5`, description: 'Fullscreen exit detected.', variant: 'destructive' });
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordViolation(sessionId, 'tab_switch').then((r) => {
          if (r.autoSubmitted) handleViolationAutoSubmitRef.current();
          else if (r.violationCount) toast({ title: `⚠️ Tab switch (${r.violationCount}/5)`, description: 'Switching tabs is not allowed.', variant: 'destructive' });
        });
      }
    };

    const onWindowBlur = () => {
      recordViolation(sessionId, 'window_blur').then((r) => {
        if (r.autoSubmitted) handleViolationAutoSubmitRef.current();
        else if (r.violationCount) toast({ title: `⚠️ Window focus lost (${r.violationCount}/5)`, description: 'Leaving the window is not allowed.', variant: 'destructive' });
      });
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
    if (!session?.questions[currentIndex]) return;
    
    const q = session.questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    
    // Only submit if something changed or we are marking it
    // For a robust system, we should always submit time spent, but we'll optimize
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
        // Optimistic UI update via cache manipulation
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

  const currentQ = session.questions[currentIndex];
  
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
                {currentQ.text}
              </div>
              
              {currentQ.imageUrl && (
                <div className="mb-8 rounded-lg overflow-hidden border inline-block">
                  <img src={currentQ.imageUrl} alt="Question figure" className="max-h-80 object-contain" draggable="false" />
                </div>
              )}

              <div className="space-y-4">
                {currentQ.options.map((opt, i) => (
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
        <DialogContent className="sm:max-w-md border-destructive">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-6 w-6 mr-2" />
              Fullscreen Exit Detected
            </DialogTitle>
            <DialogDescription className="pt-2 text-base">
              You have exited fullscreen mode. This is logged as a violation. Repeated violations will result in automatic submission of the test.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button 
              className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold"
              onClick={() => {
                setShowWarning(false);
                document.documentElement.requestFullscreen().catch(e => console.log(e));
              }}
            >
              Return to Exam (Fullscreen)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Final Exam?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              You are about to submit your exam. Once submitted, you cannot change any answers.
              <div className="mt-4 bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between"><span>Answered:</span> <span className="font-bold text-green-600">{stats.answered || 0}</span></div>
                <div className="flex justify-between"><span>Not Answered:</span> <span className="font-bold text-red-500">{stats.visited || 0}</span></div>
                <div className="flex justify-between"><span>Marked for Review:</span> <span className="font-bold text-purple-600">{(stats.marked || 0) + (stats.marked_answered || 0)}</span></div>
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
    </div>
  );
}
