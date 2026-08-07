import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Clock, Target, Play, ShieldAlert, Award } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

interface Topic {
  id: number;
  name: string;
  subjectId: number;
}

export default function PracticeSetup() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Parse query params
  const searchParams = new URLSearchParams(window.location.search);
  const typeParam = searchParams.get('type') || 'random';
  const subjectIdParam = searchParams.get('subjectId') ? parseInt(searchParams.get('subjectId')!) : undefined;
  const topicIdParam = searchParams.get('topicId') ? parseInt(searchParams.get('topicId')!) : undefined;
  const collectionIdParam = searchParams.get('collectionId') ? parseInt(searchParams.get('collectionId')!) : undefined;

  // Local state
  const [mode, setMode] = useState<'timed' | 'untimed'>('untimed');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjectIdParam?.toString() || 'all');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicIdParam?.toString() || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedLimit, setSelectedLimit] = useState<string>('20');

  useEffect(() => {
    if (typeParam === 'topic' && (!topicIdParam || isNaN(topicIdParam))) {
      toast({
        title: 'Invalid Topic ID',
        description: 'A valid topic must be selected to start a topic practice session.',
        variant: 'destructive',
      });
      setLocation('/practice');
    }
  }, [typeParam, topicIdParam, setLocation, toast]);

  // Fetch subjects and topics for filters
  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ['practice-setup-subjects'],
    queryFn: () => customFetch('/api/v1/subjects'),
  });

  const { data: topics } = useQuery<Topic[]>({
    queryKey: ['practice-setup-topics', selectedSubjectId],
    queryFn: () => {
      if (selectedSubjectId === 'all') return customFetch('/api/v1/topics');
      return customFetch(`/api/v1/subjects/${selectedSubjectId}/topics`);
    },
  });

  // Fetch specific details based on types
  const { data: collectionDetails } = useQuery<any>({
    queryKey: ['practice-setup-collection', collectionIdParam],
    queryFn: () => customFetch(`/api/v1/collections/${collectionIdParam}`),
    enabled: typeParam === 'collection' && !!collectionIdParam,
  });

  // Mutation to start the practice session
  const createSession = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      toast({ title: 'Session started successfully' });
      setLocation(`/practice/session/${data.session.id}`);
    },
    onError: (err: any) => {
      toast({
        title: 'Unable to start session',
        description: err.message || 'No questions matching this configuration could be found.',
        variant: 'destructive',
      });
    },
  });

  const handleStartPractice = () => {
    const body: any = {
      mode,
      type: typeParam,
    };

    if (typeParam === 'collection') {
      if (!collectionIdParam || isNaN(collectionIdParam)) {
        toast({
          title: 'Invalid Collection ID',
          description: 'Cannot start session: collection ID is missing or invalid.',
          variant: 'destructive',
        });
        return;
      }
      body.collectionId = collectionIdParam;
    } else if (typeParam === 'topic') {
      if (!topicIdParam || isNaN(topicIdParam)) {
        toast({
          title: 'Invalid Topic ID',
          description: 'Cannot start session: topic ID is missing or invalid.',
          variant: 'destructive',
        });
        return;
      }
      body.topicId = topicIdParam;
    } else if (typeParam === 'subject') {
      if (!subjectIdParam || isNaN(subjectIdParam)) {
        toast({
          title: 'Invalid Subject ID',
          description: 'Cannot start session: subject ID is missing or invalid.',
          variant: 'destructive',
        });
        return;
      }
      body.subjectId = subjectIdParam;
    } else if (typeParam === 'bookmarks') {
      // no extra params needed
    } else if (typeParam === 'wrong_answers') {
      // no extra params needed
    } else if (typeParam === 'difficulty') {
      body.difficulty = selectedDifficulty === 'all' ? 'medium' : selectedDifficulty;
    } else if (typeParam === 'random') {
      if (selectedSubjectId !== 'all') body.subjectId = parseInt(selectedSubjectId);
      if (selectedTopicId !== 'all') body.topicId = parseInt(selectedTopicId);
      if (selectedDifficulty !== 'all') body.difficulty = selectedDifficulty;
      body.limit = parseInt(selectedLimit);
    }

    createSession.mutate(body);
  };

  // Helper title & descriptions
  const getHeaderInfo = () => {
    switch (typeParam) {
      case 'collection':
        return {
          title: `Practice Set: ${collectionDetails?.name || 'Loading...'}`,
          description: collectionDetails?.description || 'Practice curated collection questions.',
        };
      case 'subject':
        const subName = subjects?.find((s) => s.id === subjectIdParam)?.name || 'Subject';
        return {
          title: `${subName} Practice`,
          description: `Focus on questions specifically from the ${subName} section.`,
        };
      case 'topic':
        return {
          title: 'Topic Practice',
          description: 'Drill down and practice specific topic questions.',
        };
      case 'bookmarks':
        return {
          title: 'Bookmark Practice',
          description: 'Practice questions you previously bookmarked.',
        };
      case 'wrong_answers':
        return {
          title: 'Mistake Revision',
          description: 'Practice and correct questions you previously answered incorrectly.',
        };
      case 'difficulty':
        return {
          title: 'Difficulty-based Practice',
          description: 'Challenge yourself by choosing a target difficulty level.',
        };
      case 'random':
      default:
        return {
          title: 'Custom Practice Session',
          description: 'Configure a customized practice set by subject, topic, and difficulty.',
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <Button variant="ghost" asChild className="pl-0 text-muted-foreground hover:text-foreground">
          <Link href="/practice">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Main card */}
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-card">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/30 p-6">
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-500" /> {header.title}
          </CardTitle>
          <CardDescription className="text-xs">{header.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Choose Mode</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Untimed Mode */}
              <div
                onClick={() => setMode('untimed')}
                className={`cursor-pointer border-2 rounded-xl p-4 transition-all flex flex-col gap-1.5 ${
                  mode === 'untimed'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Untimed Mode</span>
                  <span className={`h-2 w-2 rounded-full ${mode === 'untimed' ? 'bg-indigo-600' : 'bg-transparent'}`}></span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  No time pressure. Get correct answer feedback and detailed explanations immediately after submitting each question.
                </p>
              </div>

              {/* Timed Mode */}
              <div
                onClick={() => setMode('timed')}
                className={`cursor-pointer border-2 rounded-xl p-4 transition-all flex flex-col gap-1.5 ${
                  mode === 'timed'
                    ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Timed Mode</span>
                  <span className={`h-2 w-2 rounded-full ${mode === 'timed' ? 'bg-indigo-600' : 'bg-transparent'}`}></span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Mock environment. A timer tracks your performance. Explanations and results are unlocked after completion.
                </p>
              </div>
            </div>
          </div>

          {/* Random Configuration Options */}
          {typeParam === 'random' && (
            <div className="space-y-4 border-t pt-5">
              <h3 className="text-sm font-semibold text-foreground">Filters & Setup</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Subject</label>
                  <Select value={selectedSubjectId} onValueChange={(val) => { setSelectedSubjectId(val); setSelectedTopicId('all'); }}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {subjects?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Topic</label>
                  <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="All Topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {topics?.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Difficulty</label>
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="All Difficulties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Limit Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Question Count</label>
                  <Select value={selectedLimit} onValueChange={setSelectedLimit}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="20 Questions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 Questions</SelectItem>
                      <SelectItem value="30">30 Questions</SelectItem>
                      <SelectItem value="50">50 Questions</SelectItem>
                      <SelectItem value="100">100 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Difficulty Mode Configuration */}
          {typeParam === 'difficulty' && (
            <div className="space-y-3 border-t pt-5">
              <h3 className="text-sm font-semibold text-foreground">Select Target Difficulty</h3>
              <div className="grid grid-cols-3 gap-3">
                {['easy', 'medium', 'hard'].map((diff) => (
                  <div
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`cursor-pointer text-center capitalize border-2 rounded-xl p-3 text-xs font-bold transition-all ${
                      selectedDifficulty === diff
                        ? 'border-indigo-600 bg-indigo-50/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {diff}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Warning / Confirmation */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex gap-3 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-0.5">
              <p className="font-semibold">Important Notice</p>
              <p className="leading-relaxed">Practice sessions do not affect your overall course grade or Test Series percentile. Take this time to focus on learning concepts.</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <Button variant="ghost" asChild className="rounded-xl">
              <Link href="/practice">Cancel</Link>
            </Button>
            <Button
              onClick={handleStartPractice}
              disabled={createSession.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow px-6"
            >
              {createSession.isPending ? 'Preparing Session...' : (
                <>
                  Start Practice <Play className="h-3 w-3 ml-1.5 fill-current" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
