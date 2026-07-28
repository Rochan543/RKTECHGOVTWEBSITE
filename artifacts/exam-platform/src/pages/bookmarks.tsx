import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bookmark, BookmarkX, Search, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface BookmarkItem {
  bookmarkId: number;
  bookmarkedAt: string;
  question: {
    id: number;
    text: string;
    type: string;
    difficulty: string;
    explanation: string | null;
    hint: string | null;
    imageUrl: string | null;
    subjectName: string | null;
    topicName: string | null;
    options: { id: number; text: string; isCorrect: boolean }[];
    positiveMarks: number;
    negativeMarks: number;
  };
}

function BookmarkCard({ item, onRemove }: { item: BookmarkItem; onRemove: (questionId: number) => void }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const { question } = item;

  return (
    <Card className="border hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Bookmark className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              {question.subjectName && <Badge variant="secondary" className="text-xs">{question.subjectName}</Badge>}
              {question.topicName && <Badge variant="outline" className="text-xs">{question.topicName}</Badge>}
              <Badge variant={question.difficulty === 'hard' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                {question.difficulty}
              </Badge>
              <Badge variant="outline" className="text-xs">+{question.positiveMarks} / -{question.negativeMarks}</Badge>
            </div>

            <p className="text-sm font-medium mb-3 leading-relaxed">{question.text}</p>

            {question.hint && (
              <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex gap-2">
                <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span><strong>Hint:</strong> {question.hint}</span>
              </div>
            )}

            {showAnswer && (
              <div className="space-y-1.5 mb-3">
                {question.options.map((opt) => (
                  <div
                    key={opt.id}
                    className={`text-sm px-3 py-2 rounded-lg border ${
                      opt.isCorrect
                        ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200 font-medium'
                        : 'bg-muted/30 border-transparent text-muted-foreground'
                    }`}
                  >
                    {opt.text} {opt.isCorrect && '✓'}
                  </div>
                ))}
              </div>
            )}

            {showAnswer && showExplain && question.explanation && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Explanation</p>
                <p>{question.explanation}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAnswer(!showAnswer)}>
                {showAnswer ? 'Hide Answer' : 'Show Answer'}
                {showAnswer ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              {showAnswer && question.explanation && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowExplain(!showExplain)}>
                  Explanation
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                onClick={() => onRemove(question.id)}
              >
                <BookmarkX className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Bookmarks() {
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<BookmarkItem[]>({
    queryKey: ['bookmarks'],
    queryFn: () => customFetch('/api/v1/bookmarks'),
  });

  const removeBookmark = useMutation({
    mutationFn: (questionId: number) =>
      customFetch(`/api/v1/bookmarks/${questionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({ title: 'Bookmark removed' });
    },
  });

  const filtered = (data ?? []).filter(
    (item) =>
      item.question.text.toLowerCase().includes(search.toLowerCase()) ||
      (item.question.subjectName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookmarks</h1>
        <p className="text-muted-foreground mt-1">Your saved questions for quick review</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bookmarks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">{data?.length === 0 ? 'No bookmarks yet' : 'No results found'}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.length === 0 ? 'Bookmark questions during your review sessions to see them here.' : 'Try a different search term.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{filtered.length} bookmarked question{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map((item) => (
            <BookmarkCard
              key={item.bookmarkId}
              item={item}
              onRemove={(qId) => removeBookmark.mutate(qId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
