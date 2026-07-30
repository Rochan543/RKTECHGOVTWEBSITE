import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Bookmark, Search, ArrowLeft, Trash2, Calendar, Clock, ChevronRight } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/lib/utils';

interface Article {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  categoryName: string | null;
  imageUrl: string | null;
  publishedDate: string;
  readingTime: number;
}

interface BookmarkItem {
  bookmarkId: number;
  bookmarkedAt: string;
  article: Article;
}

export default function CurrentAffairsBookmarks() {
  const [search, setSearch] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmarks, isLoading } = useQuery<BookmarkItem[]>({
    queryKey: ['current-affairs-bookmarks'],
    queryFn: () => customFetch('/api/v1/current-affairs/bookmarks'),
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: (articleId: number) =>
      customFetch(`/api/v1/current-affairs/bookmark/${articleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['current-affairs-feed'] });
      toast({
        title: 'Bookmark Removed',
        description: 'The article has been removed from your saved list.',
      });
    },
  });

  const handleRemoveBookmark = (articleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteBookmarkMutation.mutate(articleId);
  };

  const filtered = (bookmarks ?? []).filter((item) => {
    const titleMatch = item.article.title.toLowerCase().includes(search.toLowerCase());
    const contentMatch = item.article.content.toLowerCase().includes(search.toLowerCase());
    return titleMatch || contentMatch;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setLocation('/current-affairs')}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold border-none px-2.5 py-0.5 rounded-md">
          <Bookmark className="h-3.5 w-3.5 mr-1" /> {bookmarks?.length ?? 0} Saved
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Your Saved Bookmarks</h1>
        <p className="text-muted-foreground text-sm">
          Access your bookmarked GK updates, highlights, and factual compilations in one place.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bookmarked articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">No bookmarks found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'No bookmarks match your search terms.' : 'Bookmarked articles will show up here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => {
            const article = item.article;
            const formattedDate = new Date(article.publishedDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <Card
                key={item.bookmarkId}
                className="group hover:border-primary/20 transition-all rounded-xl cursor-pointer overflow-hidden"
                onClick={() => setLocation(`/current-affairs/articles/${article.id}`)}
              >
                <CardContent className="p-4 flex gap-4">
                  {article.imageUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border">
                      <img
                        src={optimizeCloudinaryUrl(article.imageUrl, { width: 150, height: 150 })}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                      <Bookmark className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <Badge variant="outline" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-none px-1.5 py-0">
                        {article.categoryName || 'GK'}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">
                        Saved: {new Date(item.bookmarkedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm leading-snug group-hover:text-primary truncate transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {article.readingTime} min</span>
                        <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" /> {formattedDate}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                          onClick={(e) => handleRemoveBookmark(article.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground self-center" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
