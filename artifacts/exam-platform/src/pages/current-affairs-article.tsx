import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Bookmark, Share2, Clock, Calendar, CheckCircle2,
  Trophy, BookOpen, AlertCircle, FileText, ChevronRight, Eye, ShieldAlert
} from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { motion, useScroll, useSpring } from 'framer-motion';

interface Article {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  category: string;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
  publishedDate: string;
  author: string;
  readingTime: number;
  highlights: string | null;
  facts: string | null;
  examRelevance: string | null;
  views: number;
  bookmarksCount: number;
  isBookmarked: boolean;
  tags: Array<{ id: number; name: string; slug: string }>;
  related: Array<{ id: number; title: string; imageUrl: string | null; publishedDate: string }>;
}

export default function CurrentAffairsArticle() {
  const { id: idParam } = useParams();
  const articleId = parseInt(idParam || '0', 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCompleted, setIsCompleted] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const lastProgressRef = useRef<number>(0);

  // Fetch article detail
  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ['current-affairs-article', articleId],
    queryFn: () => customFetch(`/api/v1/current-affairs/${articleId}`),
    enabled: !!articleId,
  });

  // Bookmark Mutation
  const bookmarkMutation = useMutation({
    mutationFn: (isBookmarked: boolean) => {
      if (isBookmarked) {
        return customFetch(`/api/v1/current-affairs/bookmark/${articleId}`, { method: 'DELETE' });
      }
      return customFetch('/api/v1/current-affairs/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
    },
    onSuccess: (_, isBookmarked) => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-article', articleId] });
      queryClient.invalidateQueries({ queryKey: ['current-affairs-feed'] });
      toast({
        title: isBookmarked ? 'Bookmark Removed' : 'Bookmark Saved',
        description: isBookmarked ? 'Article removed from bookmarks.' : 'Article added to bookmarks.',
      });
    },
  });

  // Progress Mutation
  const saveProgressMutation = useMutation({
    mutationFn: (body: { progress: number; secondsRead: number }) =>
      customFetch('/api/v1/current-affairs/history/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, ...body }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-stats'] });
      if (data?.completed) {
        setIsCompleted(true);
      }
    },
  });

  // Track scroll position for reading progress
  useEffect(() => {
    if (!article) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPos = window.scrollY;
      const progress = Math.min(Math.round((scrollPos / scrollHeight) * 100), 100);

      // Report progress increments of 10%
      if (progress > lastProgressRef.current + 10 || progress === 100) {
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        saveProgressMutation.mutate({
          progress,
          secondsRead: timeSpent,
        });
        lastProgressRef.current = progress;
        startTimeRef.current = Date.now(); // reset timer chunk
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Final flush on unmount
      const finalTimeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (finalTimeSpent > 2 && lastProgressRef.current > 0) {
        saveProgressMutation.mutate({
          progress: lastProgressRef.current,
          secondsRead: finalTimeSpent,
        });
      }
    };
  }, [article, articleId]);

  const handleBookmarkToggle = () => {
    if (!article) return;
    bookmarkMutation.mutate(article.isBookmarked);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: 'Link Copied',
      description: 'Article link copied to clipboard. You can share it now!',
    });
  };

  const handleMarkAsRead = () => {
    const finalTimeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    saveProgressMutation.mutate({
      progress: 100,
      secondsRead: finalTimeSpent,
    });
    setIsCompleted(true);
    toast({
      title: 'Article Completed',
      description: 'Well done! You marked this article as read.',
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-center p-4">
        <ShieldAlert className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Failed to load article</h2>
        <p className="text-sm text-muted-foreground mt-1">This article might be draft, archived, or deleted.</p>
        <Button onClick={() => setLocation('/current-affairs')} className="mt-4 rounded-xl">
          Back to Current Affairs
        </Button>
      </div>
    );
  }

  const formattedDate = new Date(article.publishedDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const parsedFacts = article.facts ? article.facts.split('\n').filter(Boolean) : [];
  const parsedHighlights = article.highlights ? article.highlights.split('\n').filter(Boolean) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Scroll indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-900 z-50">
        <div 
          className="h-full bg-primary transition-all duration-75"
          style={{ width: `${lastProgressRef.current}%` }}
        />
      </div>

      {/* Back button and action buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setLocation('/current-affairs')}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg text-xs"
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button
            variant={article.isBookmarked ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 rounded-lg text-xs"
            onClick={handleBookmarkToggle}
          >
            <Bookmark className={`h-3.5 w-3.5 ${article.isBookmarked ? 'fill-white' : ''}`} />
            {article.isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </Button>
          {!isCompleted && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs border-0"
              onClick={handleMarkAsRead}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Read
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Article Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-none font-bold text-xs rounded-md px-2.5 py-0.5">
                {article.categoryName || 'General GK'}
              </Badge>
              <div className="flex items-center gap-4 text-xs text-muted-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formattedDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {article.readingTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {article.views} views
                </span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              {article.title}
            </h1>
            {article.subtitle && (
              <p className="text-lg text-muted-foreground font-medium border-l-4 border-primary pl-3">
                {article.subtitle}
              </p>
            )}

            <div className="text-xs text-muted-foreground font-semibold">
              Posted by: <span className="text-foreground">{article.author}</span>
            </div>
          </div>

          {article.imageUrl && (
            <div className="rounded-2xl overflow-hidden border max-h-96 w-full shadow-sm">
              <img
                src={optimizeCloudinaryUrl(article.imageUrl, { width: 900 })}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Highlights Box */}
          {parsedHighlights.length > 0 && (
            <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-950 border-indigo-100 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-extrabold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <Trophy className="h-4 w-4" /> Important Highlights
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5 font-medium leading-relaxed">
                  {parsedHighlights.map((h, i) => (
                    <li key={i}>{h.replace(/^-\s*/, '')}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Main Content Body */}
          <Card className="rounded-2xl border">
            <CardContent className="p-6 md:p-8">
              <article className="prose prose-slate dark:prose-invert max-w-none prose-sm leading-relaxed whitespace-pre-wrap font-normal text-foreground/90">
                {article.content}
              </article>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Key Facts, Exam Relevance, Related Articles (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Key Facts Box */}
          {parsedFacts.length > 0 && (
            <Card className="rounded-2xl border bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/10 dark:to-slate-950 border-amber-100">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-extrabold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <BookOpen className="h-4 w-4" /> Quick Fact File
                </h3>
                <ul className="text-xs text-muted-foreground space-y-2.5 list-none font-medium leading-relaxed">
                  {parsedFacts.map((fact, i) => {
                    const separator = fact.includes(':') ? ':' : '-';
                    const parts = fact.split(separator);
                    if (parts.length > 1) {
                      return (
                        <li key={i} className="flex flex-col gap-0.5 border-b border-dashed pb-2 last:border-0 last:pb-0">
                          <span className="font-bold text-foreground text-[11px]">{parts[0].trim()}</span>
                          <span>{parts.slice(1).join(separator).trim()}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={i} className="border-b border-dashed pb-2 last:border-0 last:pb-0 flex items-start gap-1">
                        <span className="text-primary font-bold">&bull;</span> {fact.trim()}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Exam Relevance Box */}
          {article.examRelevance && (
            <Card className="rounded-2xl border bg-gradient-to-br from-violet-50/30 to-white dark:from-violet-950/5 dark:to-slate-950 border-violet-100">
              <CardContent className="p-5 space-y-2">
                <h3 className="font-extrabold text-sm text-violet-700 dark:text-violet-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertCircle className="h-4 w-4" /> Exam Relevance
                </h3>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  {article.examRelevance}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {article.tags.length > 0 && (
            <Card className="rounded-2xl border">
              <CardContent className="p-5 space-y-2">
                <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                  Tags & Topics
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {article.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs bg-muted text-muted-foreground border-none font-semibold px-2.5 py-0.5 rounded cursor-pointer hover:bg-muted/70">
                      #{tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Articles list */}
          {article.related && article.related.length > 0 && (
            <Card className="rounded-2xl border">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold">Related Articles</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                {article.related.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => setLocation(`/current-affairs/articles/${rel.id}`)}
                  >
                    {rel.imageUrl ? (
                      <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border">
                        <img
                          src={optimizeCloudinaryUrl(rel.imageUrl, { width: 100, height: 100 })}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                        <FileText className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      <h4 className="text-xs font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                        {rel.title}
                      </h4>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(rel.publishedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
