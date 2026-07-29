import { useListNotes, useListSubjects, customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Download, BookOpen, Clock, ExternalLink, Newspaper, Calendar, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { optimizeCloudinaryUrl } from '@/lib/utils';

type Category = 'gk' | 'current_affairs' | 'gs_news';

interface Article {
  id: number;
  title: string;
  content: string;
  category: Category;
  imageUrl: string | null;
  publishedDate: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  gk: 'General Knowledge',
  current_affairs: 'Current Affairs',
  gs_news: 'GS News',
};

const CATEGORY_COLORS: Record<Category, string> = {
  gk: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  current_affairs: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  gs_news: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
};

const typeColor: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ppt: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  image: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  video: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DailyGK() {
  // Study Materials State
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // Current Affairs State
  const [caCategory, setCaCategory] = useState<string>('all');
  const [caSearch, setCaSearch] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Queries
  const { data: notes, isLoading: isLoadingNotes } = useListNotes({ page: 1, limit: 100 });
  const { data: subjects } = useListSubjects();

  const { data: currentAffairsData, isLoading: isLoadingCA } = useQuery({
    queryKey: ['current-affairs-student', caCategory, caSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (caCategory !== 'all') params.set('category', caCategory);
      if (caSearch) params.set('search', caSearch);
      return customFetch<{ data: Article[]; total: number }>(`/api/v1/current-affairs?${params}`);
    },
  });

  // Filter Notes
  const allNotes = notes?.data ?? [];
  const filteredNotes = allNotes.filter((note) => {
    const matchSearch = note.title.toLowerCase().includes(search.toLowerCase()) ||
      (note.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === 'all' || String(note.subjectId) === subjectFilter;
    return matchSearch && matchSubject;
  });

  const articles = currentAffairsData?.data ?? [];
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Header */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-6 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="h-8 w-8 text-violet-200" />
          <div>
            <h1 className="text-2xl font-bold">Daily GK & Current Affairs</h1>
            <p className="text-violet-200 text-sm">{today}</p>
          </div>
        </div>
        <p className="text-violet-100 text-sm mt-2 max-w-xl">
          Stay ahead in your exam prep with curated daily news, static GK updates, and downloadable study materials.
        </p>
      </div>

      <Tabs defaultValue="feed" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] p-1 bg-muted/60 backdrop-blur-sm rounded-xl">
          <TabsTrigger value="feed" className="flex items-center gap-2 rounded-lg py-2">
            <Newspaper className="h-4 w-4" /> Updates Feed
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2 rounded-lg py-2">
            <BookOpen className="h-4 w-4" /> Study Materials
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CURRENT AFFAIRS FEED */}
        <TabsContent value="feed" className="space-y-6 outline-none">
          {/* Feed Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles & news…"
                value={caSearch}
                onChange={(e) => setCaSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={caCategory} onValueChange={setCaCategory}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="current_affairs">Current Affairs</SelectItem>
                <SelectItem value="gk">General Knowledge</SelectItem>
                <SelectItem value="gs_news">GS News</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingCA ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border border-muted rounded-xl p-5 space-y-3 animate-pulse">
                  <div className="h-28 bg-muted rounded-lg w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              ))}
            </div>
          ) : !articles.length ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">No articles found</h3>
                <p className="text-sm text-muted-foreground mt-1">Check back later for fresh updates.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => {
                const formattedDate = new Date(article.publishedDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <Card key={article.id} className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col overflow-hidden rounded-2xl cursor-pointer" onClick={() => setSelectedArticle(article)}>
                    {article.imageUrl ? (
                      <div className="relative overflow-hidden h-44 w-full">
                        <img
                          src={optimizeCloudinaryUrl(article.imageUrl, { width: 500, height: 300 })}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="h-44 w-full bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 flex items-center justify-center border-b">
                        <Newspaper className="h-12 w-12 text-indigo-300/60 dark:text-indigo-800/40" />
                      </div>
                    )}
                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={`${CATEGORY_COLORS[article.category] ?? ''} border-0 shadow-none px-2.5 py-0.5 rounded-full font-semibold text-xs`}>
                            {CATEGORY_LABELS[article.category]}
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Clock className="h-3 w-3" /> {formattedDate}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {article.content}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between text-xs font-semibold text-primary group-hover:underline">
                        Read full article &rarr;
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: STUDY MATERIALS */}
        <TabsContent value="materials" className="space-y-6 outline-none">
          {/* Notes Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search study materials…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {(subjects ?? []).map((s: { id: number; name: string }) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingNotes ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !filteredNotes.length ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">No materials found</h3>
                <p className="text-sm text-muted-foreground mt-1">Check back soon for uploaded PDFs and papers!</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-medium">
                {filteredNotes.length} material{filteredNotes.length !== 1 ? 's' : ''} available
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <Card key={note.id} className="group hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        {note.thumbnailUrl ? (
                          <div className="relative overflow-hidden h-28 w-full rounded-lg mb-3">
                            <img
                              src={optimizeCloudinaryUrl(note.thumbnailUrl, { width: 350, height: 200 })}
                              alt={note.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-28 bg-muted/40 rounded-lg mb-3 flex items-center justify-center border">
                            <FileText className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                            {note.title}
                          </h3>
                          <Badge className={`${typeColor[note.type] ?? ''} border-0 shadow-none rounded uppercase font-bold text-[9px] px-1.5 py-0.5 shrink-0`}>
                            {note.type}
                          </Badge>
                        </div>
                        {note.description && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                            {note.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t mt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          {note.size > 0 && <span>{formatBytes(note.size)}</span>}
                          {note.downloadCount !== null && note.downloadCount !== undefined && (
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" /> {note.downloadCount}
                            </span>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg px-2.5" asChild>
                          <a href={note.fileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> Open
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ARTICLE FULL MODAL */}
      <Dialog open={selectedArticle !== null} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh] rounded-2xl p-6">
          <div className="space-y-4">
            {selectedArticle && (
              <div className="flex items-center justify-between border-b pb-3">
                <Badge className={`${CATEGORY_COLORS[selectedArticle.category] ?? ''} border-0 shadow-none px-2.5 py-0.5 rounded-full font-semibold text-xs`}>
                  {CATEGORY_LABELS[selectedArticle.category]}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(selectedArticle.publishedDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            <h2 className="text-xl font-bold leading-snug">
              {selectedArticle?.title}
            </h2>

            {selectedArticle && (
              <div className="space-y-4 pt-3">
                {selectedArticle.imageUrl && (
                  <div className="rounded-xl overflow-hidden max-h-80 w-full border">
                    <img
                      src={optimizeCloudinaryUrl(selectedArticle.imageUrl, { width: 800 })}
                      alt={selectedArticle.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {selectedArticle.content}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
