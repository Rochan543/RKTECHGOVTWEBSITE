import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XCircle, Search, BookOpen, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface WrongAnswer {
  sessionId: number;
  examTitle: string;
  attemptedAt: string;
  question: {
    id: number;
    text: string;
    type: string;
    difficulty: string;
    explanation: string | null;
    imageUrl: string | null;
    subjectName: string | null;
    topicName: string | null;
    options: { id: number; text: string; isCorrect: boolean }[];
    yourAnswerId: number;
    correctAnswerId: number | null;
  };
}

function WrongAnswerCard({ item }: { item: WrongAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const { question } = item;

  return (
    <Card className="border">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              {question.subjectName && <Badge variant="secondary" className="text-xs">{question.subjectName}</Badge>}
              {question.topicName && <Badge variant="outline" className="text-xs">{question.topicName}</Badge>}
              <Badge variant={question.difficulty === 'hard' ? 'destructive' : question.difficulty === 'easy' ? 'secondary' : 'outline'} className="text-xs capitalize">
                {question.difficulty}
              </Badge>
            </div>

            <p className="text-sm font-medium mb-3 leading-relaxed">{question.text}</p>

            <div className="space-y-1.5 mb-3">
              {question.options.map((opt) => {
                const isYours = opt.id === question.yourAnswerId;
                const isCorrect = opt.isCorrect;
                return (
                  <div
                    key={opt.id}
                    className={`text-sm px-3 py-2 rounded-lg border ${
                      isCorrect ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200' :
                      isYours ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200' :
                      'bg-muted/30 border-transparent text-muted-foreground'
                    }`}
                  >
                    {opt.text}
                    {isYours && !isCorrect && <span className="ml-2 text-xs font-medium">(Your answer)</span>}
                    {isCorrect && <span className="ml-2 text-xs font-medium">✓ Correct</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {item.examTitle} · {new Date(item.attemptedAt).toLocaleDateString()}
              </p>
              {question.explanation && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setExpanded(!expanded)}>
                  <Lightbulb className="h-3 w-3" />
                  Explanation
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}
            </div>

            {expanded && question.explanation && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Explanation</p>
                <p>{question.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WrongAnswers() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<WrongAnswer[]>({
    queryKey: ['wrong-answers'],
    queryFn: () => customFetch('/api/v1/wrong-answers'),
  });

  const filtered = (data ?? []).filter(
    (item) =>
      item.question.text.toLowerCase().includes(search.toLowerCase()) ||
      (item.question.subjectName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      item.examTitle.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wrong Answers</h1>
        <p className="text-muted-foreground mt-1">Review and learn from your mistakes</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by question, subject, or exam…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {data?.length === 0 ? (
              <>
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">No wrong answers yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Take a test and your mistakes will appear here for review.</p>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">No results found</h3>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{filtered.length} question{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map((item, i) => <WrongAnswerCard key={`${item.sessionId}-${item.question.id}-${i}`} item={item} />)}
        </div>
      )}
    </div>
  );
}
