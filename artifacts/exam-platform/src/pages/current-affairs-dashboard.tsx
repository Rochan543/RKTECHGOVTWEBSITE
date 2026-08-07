import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import {
  Newspaper, Search, Calendar, BookOpen, Bookmark, Clock, Trophy, Flame,
  CheckCircle, ArrowRight, BookMarked, BrainCircuit, Sparkles, BookOpenCheck,
  Download, FileText, ChevronRight, HelpCircle, Eye, ArrowUpRight
} from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Article {
  id: number;
  title: string;
  subtitle: string | null;
  content: string;
  category: string;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  imageUrl: string | null;
  publishedDate: string;
  author: string;
  readingTime: number;
  highlights: string | null;
  facts: string | null;
  examRelevance: string | null;
  status: string;
  views: number;
  bookmarksCount: number;
  featured: boolean;
  isBookmarked: boolean;
  tags: Array<{ id: number; name: string; slug: string }>;
}

interface ReadHistoryItem {
  historyId: number;
  progress: number;
  secondsRead: number;
  completed: boolean;
  lastReadAt: string;
  article: Article;
}

interface HistoryStatsResponse {
  history: ReadHistoryItem[];
  streak: number;
  todayProgress: {
    reads: number;
    target: number;
  };
}

interface QuizItem {
  id: number;
  title: string;
  description: string | null;
  type: 'daily' | 'weekly' | 'monthly';
  duration: number | null;
  publishedDate: string;
  questionCount: number;
  attempted: boolean;
  score: number | null;
  maxScore: number | null;
  completed: boolean;
  timeSpent: number | null;
}

interface MonthlyPdfItem {
  id: number;
  month: number;
  year: number;
  pdfUrl: string;
  pdfName: string;
  pdfSize: number;
  downloadCount: number;
  revisionNotes: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CurrentAffairsDashboard() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('latest');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['feed', 'quizzes', 'revision', 'monthly'].includes(tab)) {
        return tab;
      }
    }
    return 'feed';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['feed', 'quizzes', 'revision', 'monthly'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [window.location.search]);

  // Queries
  const { data: statsData, isLoading: isLoadingStats } = useQuery<HistoryStatsResponse>({
    queryKey: ['current-affairs-stats'],
    queryFn: () => customFetch('/api/v1/current-affairs/history'),
  });

  const { data: categories } = useQuery<Array<{ id: number; name: string; slug: string; articleCount: number }>>({
    queryKey: ['current-affairs-categories'],
    queryFn: () => customFetch('/api/v1/current-affairs/categories'),
  });

  const { data: articlesData, isLoading: isLoadingArticles } = useQuery<{ data: Article[]; total: number }>({
    queryKey: ['current-affairs-feed', categoryFilter, sortFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' });
      if (categoryFilter !== 'all') {
        if (isNaN(Number(categoryFilter))) {
          params.set('category', categoryFilter);
        } else {
          params.set('categoryId', categoryFilter);
        }
      }
      if (search) params.set('search', search);
      params.set('sort', sortFilter);
      return customFetch(`/api/v1/current-affairs?${params}`);
    },
  });

  const { data: featuredData } = useQuery<{ data: Article[] }>({
    queryKey: ['current-affairs-featured'],
    queryFn: () => customFetch('/api/v1/current-affairs?featured=true&limit=5'),
  });

  const { data: trendingData } = useQuery<{ data: Article[] }>({
    queryKey: ['current-affairs-trending'],
    queryFn: () => customFetch('/api/v1/current-affairs?sort=most_viewed&limit=5'),
  });

  const { data: quizzes } = useQuery<QuizItem[]>({
    queryKey: ['current-affairs-quizzes'],
    queryFn: () => customFetch('/api/v1/current-affairs/quiz'),
  });

  const { data: monthlyPdfs } = useQuery<MonthlyPdfItem[]>({
    queryKey: ['current-affairs-monthly-pdfs'],
    queryFn: () => customFetch('/api/v1/current-affairs/monthly'),
  });

  // Bookmark Toggle Mutation
  const bookmarkMutation = useMutation({
    mutationFn: ({ articleId, isBookmarked }: { articleId: number; isBookmarked: boolean }) => {
      if (isBookmarked) {
        return customFetch(`/api/v1/current-affairs/bookmark/${articleId}`, { method: 'DELETE' });
      }
      return customFetch('/api/v1/current-affairs/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-feed'] });
      queryClient.invalidateQueries({ queryKey: ['current-affairs-bookmarks'] });
      toast({
        title: variables.isBookmarked ? 'Bookmark Removed' : 'Article Bookmarked',
        description: variables.isBookmarked ? 'Removed from your bookmarks list.' : 'Saved to your bookmarks list.',
      });
    },
  });

  // PDF download track
  const trackPdfDownloadMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/current-affairs/monthly/${id}/download`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-affairs-monthly-pdfs'] });
    }
  });

  const handleBookmarkToggle = (articleId: number, isBookmarked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkMutation.mutate({ articleId, isBookmarked });
  };

  const handlePdfDownload = (pdf: MonthlyPdfItem) => {
    trackPdfDownloadMutation.mutate(pdf.id);
    window.open(pdf.pdfUrl, '_blank');
  };

  const streak = statsData?.streak ?? 0;
  const todayProgress = statsData?.todayProgress ?? { reads: 0, target: 3 };
  const history = statsData?.history ?? [];
  const articles = articlesData?.data ?? [];
  const featured = featuredData?.data ?? [];
  const trending = trendingData?.data ?? [];

  // Filter Continue Reading
  const continueReading = history.filter(h => !h.completed && h.progress > 0).slice(0, 3);
  
  // Extract Revision Cards from articles (Highlights & Facts)
  const revisionCards = articles.filter(a => a.highlights || a.facts).slice(0, 6);

  // Recommendations: filter articles not read yet, that belong to categories the user reads most
  const readCategoryIds = new Set(history.map(h => h.article.categoryId).filter(Boolean));
  const recommendedArticles = articles
    .filter(a => !history.some(h => h.article.id === a.id) && readCategoryIds.has(a.categoryId))
    .slice(0, 4);

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Header Banner & Progress */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-600 to-indigo-800 text-white p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-300/20 via-transparent to-transparent pointer-events-none" />
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-500/30 text-violet-100 hover:bg-violet-500/40 border-0 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              STUDENT LEARNING HUB
            </Badge>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-amber-300 text-xs font-extrabold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <Flame className="h-3.5 w-3.5 fill-amber-300" /> {streak} Day Streak
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">SSC Current Affairs & Daily GK</h1>
          <p className="text-indigo-100 text-sm max-w-2xl font-medium">
            Read daily updates, revise core notes, challenge yourself with quizzes, and download monthly compilations to keep your exam prep on target.
          </p>
        </div>

        {/* Today's Reading Target Progress Card */}
        <Card className="bg-white/10 border-white/10 text-white w-full md:w-80 backdrop-blur-md">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-100 flex items-center gap-1">
                <BookOpenCheck className="h-4 w-4 text-emerald-300" /> Today's Read Target
              </span>
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                {todayProgress.reads} / {todayProgress.target} Articles
              </span>
            </div>
            <Progress 
              value={(todayProgress.reads / todayProgress.target) * 100} 
              className="h-2 bg-indigo-950/40" 
            />
            <p className="text-[10px] text-indigo-200">
              {todayProgress.reads >= todayProgress.target 
                ? '🎉 Daily goal met! You are maintaining an amazing pace.' 
                : `Read ${todayProgress.target - todayProgress.reads} more articles to complete your goal.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Feed, Quizzes, Compilations (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="flex overflow-x-auto bg-muted p-1 rounded-xl h-auto flex-wrap">
              <TabsTrigger value="feed" className="rounded-lg py-2 flex items-center gap-1.5 flex-1 md:flex-none">
                <Newspaper className="h-4 w-4" /> Daily Feed
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="rounded-lg py-2 flex items-center gap-1.5 flex-1 md:flex-none">
                <BrainCircuit className="h-4 w-4" /> Daily/Weekly Quizzes
              </TabsTrigger>
              <TabsTrigger value="revision" className="rounded-lg py-2 flex items-center gap-1.5 flex-1 md:flex-none">
                <Sparkles className="h-4 w-4" /> Revision Cards
              </TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-lg py-2 flex items-center gap-1.5 flex-1 md:flex-none">
                <Download className="h-4 w-4" /> Monthly PDFs
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DAILY FEED */}
            <TabsContent value="feed" className="space-y-6 outline-none">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search GK & Current Affairs articles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40 rounded-xl">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories ?? []).map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortFilter} onValueChange={setSortFilter}>
                    <SelectTrigger className="w-36 rounded-xl">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="most_viewed">Most Viewed</SelectItem>
                      <SelectItem value="most_bookmarked">Most Bookmarked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoadingArticles ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="rounded-xl border animate-pulse">
                      <CardContent className="p-6 flex gap-4">
                        <div className="w-24 h-24 bg-muted rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3" />
                          <div className="h-5 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <Card className="rounded-2xl border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No articles found</h3>
                    <p className="text-sm text-muted-foreground mt-1">Try resetting your filters or search keywords.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {articles.map((article) => {
                    const formattedDate = new Date(article.publishedDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    return (
                      <Card
                        key={article.id}
                        className="group hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden rounded-xl cursor-pointer"
                        onClick={() => setLocation(`/current-affairs/articles/${article.id}`)}
                      >
                        <CardContent className="p-5 flex flex-col sm:flex-row gap-5">
                          {article.imageUrl ? (
                            <div className="w-full sm:w-28 sm:h-28 rounded-lg overflow-hidden shrink-0 border relative">
                              <img
                                src={optimizeCloudinaryUrl(article.imageUrl, { width: 300, height: 300 })}
                                alt={article.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-full sm:w-28 sm:h-28 rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border flex items-center justify-center shrink-0">
                              <Newspaper className="h-8 w-8 text-primary/30" />
                            </div>
                          )}
                          <div className="flex-1 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-none font-semibold px-2 py-0.5 rounded-md">
                                  {article.categoryName || 'General GK'}
                                </Badge>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" /> {article.readingTime} min read
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                                    <Calendar className="h-3 w-3" /> {formattedDate}
                                  </span>
                                </div>
                              </div>
                              <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-1">
                                {article.title}
                              </h3>
                              {article.subtitle && (
                                <p className="text-xs text-muted-foreground line-clamp-1 font-medium">
                                  {article.subtitle}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed font-normal">
                                {article.content.replace(/[#*`_]/g, '')}
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-dashed">
                              <div className="flex gap-1.5 flex-wrap">
                                {(article.tags || []).slice(0, 3).map(tag => (
                                  <Badge key={tag.id} className="bg-muted text-muted-foreground border-none font-semibold text-[9px] px-1.5 py-0">
                                    #{tag.name}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                  onClick={(e) => handleBookmarkToggle(article.id, article.isBookmarked, e)}
                                >
                                  <Bookmark className={`h-4 w-4 ${article.isBookmarked ? 'fill-primary text-primary' : ''}`} />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: QUIZZES */}
            <TabsContent value="quizzes" className="space-y-6 outline-none">
              {!quizzes || quizzes.length === 0 ? (
                <Card className="rounded-2xl border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BrainCircuit className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No Quizzes Available</h3>
                    <p className="text-sm text-muted-foreground mt-1">Check back later for daily current affairs quizzes.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {quizzes.map((quiz) => (
                    <Card key={quiz.id} className="rounded-xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Badge className={`capitalize text-xs font-semibold px-2 py-0.5 rounded-md border-0 ${
                            quiz.type === 'daily' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                            quiz.type === 'weekly' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                            'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                          }`}>
                            {quiz.type} Quiz
                          </Badge>
                          {quiz.attempted && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-none flex items-center gap-0.5">
                              <CheckCircle className="h-3 w-3" /> Attempted
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold line-clamp-1">{quiz.title}</CardTitle>
                        {quiz.description && <CardDescription className="text-xs line-clamp-2 mt-1">{quiz.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="p-5 pt-0 flex flex-col gap-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-dashed">
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3.5 w-3.5" /> {quiz.questionCount} Questions
                          </span>
                          {quiz.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> {quiz.duration} Mins
                            </span>
                          )}
                        </div>
                        
                        {quiz.attempted ? (
                          <div className="bg-muted/50 p-2.5 rounded-lg flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground">Your Score:</span>
                            <span className="font-bold text-primary">{quiz.score} / {quiz.maxScore}</span>
                          </div>
                        ) : null}

                        <Button 
                          className="w-full mt-2 gap-1 rounded-lg"
                          variant={quiz.attempted ? "outline" : "default"}
                          onClick={() => setLocation(`/current-affairs/quiz/${quiz.id}`)}
                        >
                          {quiz.attempted ? 'Review Quiz Answers' : 'Start Daily Quiz'} <ArrowRight className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: REVISION CARDS */}
            <TabsContent value="revision" className="space-y-6 outline-none">
              {revisionCards.length === 0 ? (
                <Card className="rounded-2xl border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No revision facts yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Key highlights and facts from today's articles will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {revisionCards.map((card) => {
                    const parsedFacts = card.facts ? card.facts.split('\n').filter(Boolean) : [];
                    const parsedHighlights = card.highlights ? card.highlights.split('\n').filter(Boolean) : [];
                    return (
                      <Card key={card.id} className="rounded-xl border overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950/20 dark:to-slate-900/10 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <CardHeader className="p-5 pb-3 bg-slate-100/50 dark:bg-slate-900/50 border-b">
                          <Badge className="w-fit mb-1 border-none text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded">
                            {card.categoryName || 'General GK'}
                          </Badge>
                          <CardTitle className="text-sm font-bold line-clamp-1">{card.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                          {parsedHighlights.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-bold text-primary flex items-center gap-1 uppercase tracking-wider text-[10px]">
                                <Trophy className="h-3 w-3" /> Key Highlights
                              </h4>
                              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4 leading-relaxed font-medium">
                                {parsedHighlights.slice(0, 3).map((h, i) => (
                                  <li key={i}>{h.replace(/^-\s*/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {parsedFacts.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider text-[10px]">
                                <Flame className="h-3 w-3" /> Quick Facts
                              </h4>
                              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4 leading-relaxed font-medium">
                                {parsedFacts.slice(0, 3).map((f, i) => (
                                  <li key={i}>{f.replace(/^-\s*/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                        <div className="p-3 border-t bg-muted/30 flex justify-end">
                          <Link href={`/current-affairs/articles/${card.id}`}>
                            <span className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer">
                              Read Full Context <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: MONTHLY PDF COMPILATIONS */}
            <TabsContent value="monthly" className="space-y-6 outline-none">
              {!monthlyPdfs || monthlyPdfs.length === 0 ? (
                <Card className="rounded-2xl border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Download className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No compilations uploaded</h3>
                    <p className="text-sm text-muted-foreground mt-1">Monthly GK PDFs will show up once released by admins.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {monthlyPdfs.map((pdf) => {
                    const sizeMB = pdf.pdfSize ? (pdf.pdfSize / (1024 * 1024)).toFixed(1) : '0.0';
                    return (
                      <Card key={pdf.id} className="rounded-xl border hover:shadow-md transition-shadow">
                        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-xl flex items-center justify-center shrink-0">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-base">{MONTH_NAMES[pdf.month - 1]} {pdf.year} Compilation</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                File: {pdf.pdfName} &bull; Size: {sizeMB} MB &bull; Downloads: {pdf.downloadCount}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            {pdf.revisionNotes && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs rounded-lg flex-1 sm:flex-none"
                                onClick={() => {
                                  toast({
                                    title: `${MONTH_NAMES[pdf.month - 1]} Revision Notes`,
                                    description: pdf.revisionNotes?.substring(0, 150) + '...',
                                  });
                                }}
                              >
                                View Revision Notes
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              className="text-xs rounded-lg flex-1 sm:flex-none gap-1"
                              onClick={() => handlePdfDownload(pdf)}
                            >
                              <Download className="h-3.5 w-3.5" /> Download PDF
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Side: Featured, Bookmarks, Continue Reading, Recommended (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Continue Reading Section */}
          {continueReading.length > 0 && (
            <Card className="rounded-xl border">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-violet-500" /> Continue Reading
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                {continueReading.map((item) => (
                  <div 
                    key={item.historyId}
                    className="p-3 rounded-lg bg-muted/30 border border-muted hover:border-primary/20 transition-all cursor-pointer space-y-2"
                    onClick={() => setLocation(`/current-affairs/articles/${item.article.id}`)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-xs font-bold line-clamp-1">{item.article.title}</h4>
                      <Badge className="bg-primary/10 text-primary border-none text-[9px] px-1 py-0 font-bold shrink-0">
                        {item.progress}%
                      </Badge>
                    </div>
                    <Progress value={item.progress} className="h-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Featured Carousel/List */}
          {featured.length > 0 && (
            <Card className="rounded-xl border overflow-hidden">
              <CardHeader className="p-5 pb-3 bg-gradient-to-br from-indigo-500/10 to-transparent">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Sparkles className="h-4 w-4" /> Featured Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-4">
                {featured.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => setLocation(`/current-affairs/articles/${item.id}`)}
                  >
                    {item.imageUrl ? (
                      <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border">
                        <img 
                          src={optimizeCloudinaryUrl(item.imageUrl, { width: 100, height: 100 })} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border">
                        <Newspaper className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 space-y-0.5">
                      <h4 className="text-xs font-bold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(item.publishedDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* Bookmarked Quick list */}
          <Card className="rounded-xl border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Bookmark className="h-4 w-4 text-amber-500" /> Bookmarks & History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-2">
              <Link href="/current-affairs/bookmarks">
                <Button variant="outline" className="w-full text-xs font-bold gap-1 rounded-lg">
                  <BookMarked className="h-3.5 w-3.5" /> View Saved Bookmarks
                </Button>
              </Link>
              <Link href="/current-affairs/history">
                <Button variant="outline" className="w-full text-xs font-bold gap-1 rounded-lg">
                  <Clock className="h-3.5 w-3.5" /> View Reading History
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recommendations list */}
          {recommendedArticles.length > 0 && (
            <Card className="rounded-xl border">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-emerald-500" /> Recommended For You
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                {recommendedArticles.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 text-xs border-b pb-2.5 last:border-0 last:pb-0 cursor-pointer group"
                    onClick={() => setLocation(`/current-affairs/articles/${rec.id}`)}
                  >
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
                        {rec.title}
                      </h4>
                      <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">
                        {rec.categoryName}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Trending list */}
          {trending.length > 0 && (
            <Card className="rounded-xl border">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-primary" /> Trending GK Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                {trending.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => setLocation(`/current-affairs/articles/${item.id}`)}
                  >
                    <div className="h-6 w-6 rounded-md bg-muted text-[11px] font-bold text-muted-foreground flex items-center justify-center shrink-0 border">
                      #{index + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-xs font-semibold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-2">
                        <span>Views: {item.views}</span> &bull; <span>Reads: {item.bookmarksCount}</span>
                      </p>
                    </div>
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
