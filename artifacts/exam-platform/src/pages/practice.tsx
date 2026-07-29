import { useState, useEffect } from 'react';
import { useListExams, useListResults, type Exam } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Target, BookOpen, ChevronRight, Layers, Zap, FileQuestion } from 'lucide-react';
import { Link } from 'wouter';

const typeConfig = {
  mock_test: { label: 'Mock Tests', icon: Layers, description: 'Full-length simulated exams', color: 'from-indigo-600 via-indigo-700 to-purple-800' },
  sectional: { label: 'Sectional Tests', icon: BookOpen, description: 'Practice one section at a time', color: 'from-blue-600 via-cyan-600 to-cyan-700' },
  topic_test: { label: 'Topic Tests', icon: Zap, description: 'Focused topic-level practice', color: 'from-emerald-600 via-teal-600 to-teal-700' },
  pyq: { label: 'Previous Year Questions', icon: FileQuestion, description: 'Real exam questions from past years', color: 'from-orange-500 via-amber-600 to-red-600' },
};

function getExamDifficulty(exam: Exam): 'easy' | 'medium' | 'hard' {
  if (exam.averageScore && exam.totalMarks) {
    const pct = exam.averageScore / exam.totalMarks;
    if (pct >= 0.7) return 'easy';
    if (pct >= 0.45) return 'medium';
    return 'hard';
  }
  const val = (exam.id * 17) % 3;
  if (val === 0) return 'easy';
  if (val === 1) return 'medium';
  return 'hard';
}

function ExamCard({ exam, attempt }: { exam: Exam; attempt?: any }) {
  const diff = getExamDifficulty(exam);
  const diffBadgeColor = {
    easy: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    hard: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  }[diff];

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border border-slate-200/60 dark:border-slate-800/80 bg-card hover:border-primary/30 flex flex-col justify-between">
      <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-full">
              {exam.categoryName || 'General'}
            </span>
            {attempt ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 font-bold">
                Completed ({attempt.score} pts)
              </Badge>
            ) : exam.attemptCount && exam.attemptCount > 0 ? (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] py-0 font-bold">
                Attempted
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15 text-[10px] py-0 font-bold">
                Unattempted
              </Badge>
            )}
          </div>
          
          <h3 className="font-bold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[40px] mb-3">
            {exam.title}
          </h3>
          
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground/70" /> {exam.durationMinutes} Mins</span>
            <span className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-muted-foreground/70" /> {exam.totalQuestions} Qs</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-muted-foreground/70" /> {exam.totalMarks} Marks</span>
            <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground/70" /> {exam.attemptCount || 0} Attempts</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-2 gap-3">
          <Badge className={`capitalize border text-[10px] font-bold ${diffBadgeColor}`} variant="outline">
            {diff}
          </Badge>
          <Button size="sm" asChild className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow transition-all px-4 rounded-lg">
            <Link href={`/exams/${exam.id}`}>
              Start Test <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamList({ type }: { type: string }) {
  const apiType = type === 'mock_test' ? 'full_mock' : (type as any);
  const { data, isLoading } = useListExams({ type: apiType, limit: 100, page: 1 });
  const { data: resultsData } = useListResults({ limit: 100 });

  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [duration, setDuration] = useState('all');
  const [qCount, setQCount] = useState('all');
  const [sort, setSort] = useState('newest');

  const exams = data?.data ?? [];
  const results = resultsData?.data ?? [];

  // Dynamically extract unique subjects
  const subjects = Array.from(new Set(exams.map(e => e.categoryName).filter((s): s is string => !!s)));

  const filteredExams = exams.filter((exam) => {
    if (search && !exam.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (subject !== 'all' && exam.categoryName !== subject) return false;
    
    const diff = getExamDifficulty(exam);
    if (difficulty !== 'all' && diff !== difficulty) return false;

    if (duration !== 'all') {
      if (duration === 'under_30' && exam.durationMinutes >= 30) return false;
      if (duration === '30_60' && (exam.durationMinutes < 30 || exam.durationMinutes > 60)) return false;
      if (duration === 'over_60' && exam.durationMinutes <= 60) return false;
    }

    if (qCount !== 'all') {
      if (qCount === 'under_20' && exam.totalQuestions >= 20) return false;
      if (qCount === '20_50' && (exam.totalQuestions < 20 || exam.totalQuestions > 50)) return false;
      if (qCount === 'over_50' && exam.totalQuestions <= 50) return false;
    }

    return true;
  });

  filteredExams.sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'popular') return (b.attemptCount || 0) - (a.attemptCount || 0);
    if (sort === 'duration') return a.durationMinutes - b.durationMinutes;
    if (sort === 'difficulty') {
      const diffOrder = { easy: 1, medium: 2, hard: 3 };
      return diffOrder[getExamDifficulty(a)] - diffOrder[getExamDifficulty(b)];
    }
    return 0;
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search exam series..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background h-10"
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="popular">Popularity</SelectItem>
                <SelectItem value="difficulty">Difficulty</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="bg-background text-xs h-9">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="bg-background text-xs h-9">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="bg-background text-xs h-9">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Durations</SelectItem>
              <SelectItem value="under_30">Under 30 mins</SelectItem>
              <SelectItem value="30_60">30 - 60 mins</SelectItem>
              <SelectItem value="over_60">Over 60 mins</SelectItem>
            </SelectContent>
          </Select>

          <Select value={qCount} onValueChange={setQCount}>
            <SelectTrigger className="bg-background text-xs h-9">
              <SelectValue placeholder="Questions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Questions</SelectItem>
              <SelectItem value="under_20">Under 20 Qs</SelectItem>
              <SelectItem value="20_50">20 - 50 Qs</SelectItem>
              <SelectItem value="over_50">Over 50 Qs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!filteredExams.length ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
          <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">No matching exams found</p>
          <p className="text-xs mt-1">Try adjusting your search queries or filter selectors.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExams.map((exam) => {
            const lastAttempt = results.find(r => r.examId === exam.id);
            return (
              <ExamCard 
                key={exam.id} 
                exam={exam} 
                attempt={lastAttempt} 
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Practice() {
  const tabs = ['mock_test', 'sectional', 'topic_test', 'pyq'] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Practice Hub</h1>
        <p className="text-muted-foreground mt-1 text-sm">Choose your practice mode and start sharpening your skills</p>
      </div>

      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((type) => {
          const cfg = typeConfig[type];
          return (
            <div 
              key={type} 
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.color} text-white p-5 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group`}
            >
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <cfg.icon className="h-28 w-28" />
              </div>
              <cfg.icon className="h-7 w-7 mb-3.5 opacity-90 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="font-bold text-sm tracking-wide">{cfg.label}</h3>
              <p className="text-[11px] opacity-80 mt-1 leading-relaxed">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="mock_test" className="w-full">
        <TabsList className="mb-6 bg-slate-100/80 dark:bg-slate-900/60 p-1 rounded-xl">
          {tabs.map((type) => (
            <TabsTrigger key={type} value={type} className="text-xs sm:text-sm font-bold rounded-lg py-2">
              {typeConfig[type].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((type) => (
          <TabsContent key={type} value={type} className="mt-0 outline-none">
            <ExamList type={type} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
