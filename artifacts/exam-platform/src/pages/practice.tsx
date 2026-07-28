import { useListExams } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Target, BookOpen, ChevronRight, Layers, Zap, FileQuestion } from 'lucide-react';
import { Link } from 'wouter';

const typeConfig = {
  mock_test: { label: 'Mock Tests', icon: Layers, description: 'Full-length simulated exams', color: 'from-indigo-500 to-purple-600' },
  sectional: { label: 'Sectional Tests', icon: BookOpen, description: 'Practice one section at a time', color: 'from-blue-500 to-cyan-600' },
  topic_test: { label: 'Topic Tests', icon: Zap, description: 'Focused topic-level practice', color: 'from-green-500 to-teal-600' },
  pyq: { label: 'Previous Year Questions', icon: FileQuestion, description: 'Real exam questions from past years', color: 'from-orange-500 to-red-600' },
};

function ExamCard({ exam }: { exam: { id: number; title: string; type: string; durationMinutes: number; questionCount?: number; status: string } }) {
  return (
    <Card className="group hover:shadow-md transition-all border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight mb-2 group-hover:text-primary transition-colors">{exam.title}</h3>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{exam.durationMinutes} mins</span>
              {exam.questionCount && <span className="flex items-center gap-1"><Target className="h-3 w-3" />{exam.questionCount} Qs</span>}
            </div>
          </div>
          <Button size="sm" asChild className="flex-shrink-0">
            <Link href={`/exams/${exam.id}`}>
              Start <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamList({ type }: { type: string }) {
  const { data, isLoading } = useListExams({ type: type as 'mock_test' | 'sectional' | 'topic_test' | 'pyq', limit: 50, page: 1 });
  const exams = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (!exams.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No exams available yet</p>
        <p className="text-sm mt-1">Check back soon — new content is added regularly.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {exams.map((exam) => <ExamCard key={exam.id} exam={exam as { id: number; title: string; type: string; durationMinutes: number; questionCount?: number; status: string }} />)}
    </div>
  );
}

export default function Practice() {
  const tabs = ['mock_test', 'sectional', 'topic_test', 'pyq'] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Practice Hub</h1>
        <p className="text-muted-foreground mt-1">Choose your practice mode and start sharpening your skills</p>
      </div>

      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((type) => {
          const cfg = typeConfig[type];
          return (
            <div key={type} className={`rounded-2xl bg-gradient-to-br ${cfg.color} text-white p-5`}>
              <cfg.icon className="h-8 w-8 mb-3 opacity-80" />
              <h3 className="font-bold text-sm">{cfg.label}</h3>
              <p className="text-xs opacity-70 mt-1">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="mock_test">
        <TabsList className="mb-4">
          {tabs.map((type) => (
            <TabsTrigger key={type} value={type} className="text-xs sm:text-sm">
              {typeConfig[type].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((type) => (
          <TabsContent key={type} value={type}>
            <ExamList type={type} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
