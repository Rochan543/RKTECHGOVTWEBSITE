import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  useListSubjects,
  useListTopics,
  useListCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useArchiveCollection,
  useGetRepositorySummary,
  useGetTopicSummary,
  useSearchRepository,
  useListQuestions,
  customFetch,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QuestionImporter } from '@/components/question-importer';
import {
  Plus,
  Search,
  Loader2,
  FolderTree,
  Archive,
  FileQuestion,
  Trash2,
  Edit3,
  ArrowRight,
  ChevronLeft,
  BookMarked,
  Layers,
  Library,
  Copy,
  Eye,
  BarChart2,
  Calendar,
  Clock,
  BookOpen,
  Filter,
  CheckCircle,
  HelpCircle,
  Hash,
  AlertTriangle,
  X,
  Upload,
} from 'lucide-react';

// Highlight helper function for search matches
function highlightText(text: string, query: string) {
  if (!query) return text;
  const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-0.5 rounded font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function AdminRepository() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // URL Path Analysis
  const subjectMatch = location.match(/^\/admin\/repository\/subject\/(\d+)\/?$/);
  const topicMatch = location.match(/^\/admin\/repository\/subject\/(\d+)\/topic\/(\d+)\/?$/);

  let view: 'home' | 'subject' | 'topic' = 'home';
  let currentSubjectId: number | null = null;
  let currentTopicId: number | null = null;

  if (topicMatch) {
    view = 'topic';
    currentSubjectId = parseInt(topicMatch[1], 10);
    currentTopicId = parseInt(topicMatch[2], 10);
  } else if (subjectMatch) {
    view = 'subject';
    currentSubjectId = parseInt(subjectMatch[1], 10);
  }

  // Common Queries
  const { data: subjects, isLoading: isLoadingSubjects } = useListSubjects();
  const { data: topics } = useListTopics(
    currentSubjectId ? { subjectId: currentSubjectId } : {}
  );

  // Derive Subject and Topic Names
  const subjectName = useMemo(() => {
    if (!currentSubjectId || !subjects) return '';
    return subjects.find(s => s.id === currentSubjectId)?.name || `Subject #${currentSubjectId}`;
  }, [currentSubjectId, subjects]);

  const topicName = useMemo(() => {
    if (!currentTopicId || !topics) return '';
    return topics.find(t => t.id === currentTopicId)?.name || `Topic #${currentTopicId}`;
  }, [currentTopicId, topics]);

  // Global Quick Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: searchResults, isFetching: isSearching } = useSearchRepository(
    { query: debouncedSearch },
    { query: { enabled: debouncedSearch.trim().length > 0 } as any }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Dynamic explorer views */}
      {view === 'home' && (
        <RepositoryHomeView
          subjects={subjects || []}
          isLoading={isLoadingSubjects}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          debouncedSearch={debouncedSearch}
          searchResults={searchResults}
          isSearching={isSearching}
        />
      )}

      {view === 'subject' && currentSubjectId && (
        <RepositorySubjectView
          subjectId={currentSubjectId}
          subjectName={subjectName}
          topics={topics || []}
        />
      )}

      {view === 'topic' && currentSubjectId && currentTopicId && (
        <RepositoryTopicView
          subjectId={currentSubjectId}
          subjectName={subjectName}
          topicId={currentTopicId}
          topicName={topicName}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HOME VIEW component
// ─────────────────────────────────────────────────────────────────────────────
interface HomeViewProps {
  subjects: any[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearch: string;
  searchResults: any;
  isSearching: boolean;
}

function RepositoryHomeView({
  subjects,
  isLoading,
  searchQuery,
  setSearchQuery,
  debouncedSearch,
  searchResults,
  isSearching,
}: HomeViewProps) {
  const { data: summary, isLoading: isLoadingSummary } = useGetRepositorySummary();

  const activeSubjects = subjects || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            <FolderTree className="h-8 w-8 text-primary" />
            Question Repository
          </h1>
          <p className="text-muted-foreground mt-1">Hierarchical explorer & navigation hub for exam content</p>
        </div>
      </div>

      {/* Global Explorer Quick Search */}
      <div className="relative max-w-2xl mx-auto my-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Quick search questions, topics, collections, or subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-10 py-6 text-base rounded-full shadow-md border-primary/10 focus-visible:ring-primary focus-visible:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Global Instant Search Overlay */}
        {debouncedSearch.trim().length > 0 && (
          <Card className="absolute left-0 right-0 mt-2 z-50 shadow-2xl border max-h-[500px] overflow-y-auto bg-card/95 backdrop-blur-md">
            <CardHeader className="py-3 px-4 border-b bg-muted/40">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                <span>Instant Search Results</span>
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              {!isSearching &&
                !searchResults?.subjects?.length &&
                !searchResults?.topics?.length &&
                !searchResults?.collections?.length &&
                !searchResults?.questions?.length && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No results found matching "{debouncedSearch}"
                  </div>
                )}

              {/* A. Subjects Matches */}
              {searchResults?.subjects?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-primary px-3 py-1 uppercase tracking-wider">Subjects</h4>
                  <div className="space-y-0.5 mt-1">
                    {searchResults.subjects.map((sub: any) => (
                      <Link
                        key={sub.id}
                        href={`/admin/repository/subject/${sub.id}`}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted/80 cursor-pointer transition-colors"
                      >
                        <BookMarked className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {highlightText(sub.name, debouncedSearch)}
                        </span>
                        <span className="text-xs text-muted-foreground">({sub.questionCount} questions)</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* B. Topics Matches */}
              {searchResults?.topics?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-600 px-3 py-1 uppercase tracking-wider">Topics</h4>
                  <div className="space-y-0.5 mt-1">
                    {searchResults.topics.map((t: any) => (
                      <Link
                        key={t.id}
                        href={`/admin/repository/subject/${t.subjectId}/topic/${t.id}`}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted/80 cursor-pointer transition-colors"
                      >
                        <Layers className="h-4 w-4 text-emerald-500" />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {highlightText(t.name, debouncedSearch)}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            Subject: {t.subjectName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">({t.questionCount} questions)</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* C. Collections Matches */}
              {searchResults?.collections?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-600 px-3 py-1 uppercase tracking-wider">Collections</h4>
                  <div className="space-y-0.5 mt-1">
                    {searchResults.collections.map((col: any) => (
                      <Link
                        key={col.id}
                        href={`/admin/collections/${col.id}`}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted/80 cursor-pointer transition-colors"
                      >
                        <Library className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {highlightText(col.name, debouncedSearch)}
                        </span>
                        <span className="text-xs text-muted-foreground">({col.questionsCount} questions)</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* D. Questions Matches */}
              {searchResults?.questions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-blue-600 px-3 py-1 uppercase tracking-wider">Questions</h4>
                  <div className="space-y-0.5 mt-1">
                    {searchResults.questions.map((q: any) => (
                      <Link
                        key={q.id}
                        href={`/admin/repository/subject/${q.subjectId}/topic/${q.topicId}`}
                        className="block px-3 py-2 text-sm rounded-lg hover:bg-muted/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileQuestion className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">
                            {q.subjectName} &gt; {q.topicName}
                          </span>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize scale-90">
                            {q.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 pl-6">
                          {highlightText(q.text, debouncedSearch)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metrics Summary Row */}
      {isLoadingSummary ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse h-24 border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-xs border bg-card/65 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Subjects</CardTitle>
              <BookMarked className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary?.totalSubjects || 0}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Core content streams</p>
            </CardContent>
          </Card>
          <Card className="shadow-xs border bg-card/65 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Topics</CardTitle>
              <Layers className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary?.totalTopics || 0}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Sub-topic groupings</p>
            </CardContent>
          </Card>
          <Card className="shadow-xs border bg-card/65 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Questions</CardTitle>
              <FileQuestion className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary?.totalQuestions || 0}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Active repository items</p>
            </CardContent>
          </Card>
          <Card className="shadow-xs border bg-card/65 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Collections</CardTitle>
              <Library className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary?.totalCollections || 0}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Aggregates & quizzes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Folders Explorer: Subjects */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <BookMarked className="h-5 w-5 text-primary" />
          Subjects (Folders)
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse h-28 border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeSubjects.map((sub) => (
              <Link key={sub.id} href={`/admin/repository/subject/${sub.id}`}>
                <Card className="hover:shadow-md border bg-card hover:bg-muted/15 cursor-pointer transition-all duration-200 active:scale-97 group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                      <BookMarked className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors duration-200">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub.questionCount} Questions</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recents Dashboard widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Collections */}
        <Card className="border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Library className="h-4.5 w-4.5 text-amber-500" />
              Recent Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingSummary ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !summary?.recentCollections?.length ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No recent collections found</div>
            ) : (
              <div className="divide-y text-sm">
                {summary.recentCollections.map((col: any) => (
                  <Link
                    key={col.id}
                    href={`/admin/collections/${col.id}`}
                    className="flex justify-between items-center px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{col.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Updated {new Date(col.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {col.questionsCount} Questions
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Updated Topics */}
        <Card className="border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Layers className="h-4.5 w-4.5 text-emerald-500" />
              Recently Updated Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingSummary ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !summary?.recentlyUpdatedTopics?.length ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No recently updated topics</div>
            ) : (
              <div className="divide-y text-sm">
                {summary.recentlyUpdatedTopics.map((top: any) => (
                  <Link
                    key={top.id}
                    href={`/admin/repository/subject/${top.subjectId}/topic/${top.id}`}
                    className="flex justify-between items-center px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{top.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {top.subjectName} · Updated {new Date(top.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {top.questionCount} Questions
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Imports */}
        <Card className="border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Calendar className="h-4.5 w-4.5 text-primary" />
              Recent Imports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingSummary ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !summary?.recentImports?.length ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No recent imports detected</div>
            ) : (
              <div className="divide-y text-sm">
                {summary.recentImports.map((imp: any, idx: number) => (
                  <Link
                    key={idx}
                    href={`/admin/repository/subject/${imp.subjectId}/topic/${imp.topicId}`}
                    className="flex justify-between items-center px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Imported {imp.count} questions
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {imp.subjectName} &gt; {imp.topicName}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {imp.date}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Questions */}
        <Card className="border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
              <FileQuestion className="h-4.5 w-4.5 text-blue-500" />
              Recent Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingSummary ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !summary?.recentQuestions?.length ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No recent questions</div>
            ) : (
              <div className="divide-y text-sm">
                {summary.recentQuestions.map((q: any) => (
                  <Link
                    key={q.id}
                    href={`/admin/repository/subject/${q.subjectId}/topic/${q.topicId}`}
                    className="block px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {q.subjectName} &gt; {q.topicName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{q.text}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SUBJECT VIEW component
// ─────────────────────────────────────────────────────────────────────────────
interface SubjectViewProps {
  subjectId: number;
  subjectName: string;
  topics: any[];
}

function RepositorySubjectView({
  subjectId,
  subjectName,
  topics,
}: SubjectViewProps) {
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="rounded-lg">
          <Link href="/admin/repository" className="flex items-center gap-1.5 text-muted-foreground hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium text-sm">
            <ChevronLeft className="h-4 w-4" />
            Repository
          </Link>
        </Button>
        <span className="text-muted-foreground/45 text-sm">/</span>
        <span className="text-sm font-semibold truncate max-w-xs">{subjectName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {subjectName}
          </h1>
          <p className="text-muted-foreground mt-1">{topics.length} topics total in this subject</p>
        </div>
      </div>

      {/* Folders Explorer: Topics */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Layers className="h-5 w-5 text-emerald-500" />
          Topics (Sub-folders)
        </h2>

        {!topics.length ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
            No topics defined under this subject yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topics.map((t) => (
              <Link key={t.id} href={`/admin/repository/subject/${subjectId}/topic/${t.id}`}>
                <Card className="hover:shadow-md border bg-card hover:bg-muted/15 cursor-pointer transition-all duration-200 active:scale-97 group">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-200">
                        <Layers className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-500 transition-colors duration-200">
                        {t.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2.5">
                      <span>{t.questionCount} Questions</span>
                      <span>View Folder &rarr;</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOPIC VIEW component
// ─────────────────────────────────────────────────────────────────────────────
interface TopicViewProps {
  subjectId: number;
  subjectName: string;
  topicId: number;
  topicName: string;
}

function RepositoryTopicView({
  subjectId,
  subjectName,
  topicId,
  topicName,
}: TopicViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: summary, isLoading: isLoadingSummary } = useGetTopicSummary(
    topicId
  );

  // Tab routing or local state
  const [activeTab, setActiveTab] = useState('questions');
  const [importOpen, setImportOpen] = useState(false);

  // Questions Tab State
  const [qPage, setQPage] = useState(1);
  const [qSearch, setQSearch] = useState('');
  const [qDifficulty, setQDifficulty] = useState<string>('all');
  const [qType, setQType] = useState<string>('all');

  const { data: questionsData, isLoading: isLoadingQuestions } = useListQuestions({
    page: qPage,
    limit: 25,
    topicId,
    subjectId,
    difficulty: qDifficulty !== 'all' ? (qDifficulty as any) : undefined,
    type: qType !== 'all' ? (qType as any) : undefined,
    search: qSearch.trim() || undefined,
  });

  const questions = questionsData?.data || [];
  const qTotal = questionsData?.total || 0;
  const qTotalPages = Math.ceil(qTotal / 25);

  // Collections Tab State
  const [colSearch, setColSearch] = useState('');
  const { data: collectionsData, isLoading: isLoadingCollections } = useListCollections({
    limit: 100,
    search: colSearch.trim() || undefined,
  });

  const collections = useMemo(() => {
    // Ideally we filter collections containing questions from this topic.
    // Drizzle handles this in SQL, but for frontend UI, since listCollections gets all, we can show active ones
    return collectionsData?.data || [];
  }, [collectionsData]);

  // Create Collection Dialog
  const [createColOpen, setCreateColOpen] = useState(false);
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');

  const createColMutation = useCreateCollection();
  const deleteColMutation = useDeleteCollection();
  const archiveColMutation = useArchiveCollection();

  const handleCreateCollection = () => {
    if (!colName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    createColMutation.mutate(
      { data: { name: colName.trim(), description: colDesc.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Collection created successfully" });
          setCreateColOpen(false);
          setColName('');
          setColDesc('');
          queryClient.invalidateQueries({ queryKey: ['/api/v1/collections'] });
        },
      }
    );
  };

  const handleArchiveCollection = (id: number) => {
    archiveColMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Collection updated successfully" });
          queryClient.invalidateQueries({ queryKey: ['/api/v1/collections'] });
        },
      }
    );
  };

  const handleDeleteCollection = (id: number) => {
    deleteColMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Collection deleted successfully" });
          queryClient.invalidateQueries({ queryKey: ['/api/v1/collections'] });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="rounded-lg">
          <Link href="/admin/repository" className="flex items-center gap-1.5 text-muted-foreground hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium text-sm">
            Repository
          </Link>
        </Button>
        <span className="text-muted-foreground/45 text-sm">/</span>
        <Button variant="ghost" size="sm" asChild className="rounded-lg">
          <Link href={`/admin/repository/subject/${subjectId}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium text-sm">
            {subjectName}
          </Link>
        </Button>
        <span className="text-muted-foreground/45 text-sm">/</span>
        <span className="text-sm font-semibold truncate max-w-xs">{topicName}</span>
      </div>

      {/* Header Topic details summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {topicName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Topic Explorer · {subjectName}
          </p>
        </div>

        {/* Aggregate metric chips */}
        {isLoadingSummary ? (
          <div className="flex gap-3 animate-pulse">
            <div className="w-24 h-12 bg-muted rounded-xl" />
            <div className="w-24 h-12 bg-muted rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            <div className="bg-card px-4 py-2 border rounded-xl shadow-xs text-center min-w-24">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Questions</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary?.totalQuestions}</span>
            </div>
            <div className="bg-card px-4 py-2 border rounded-xl shadow-xs text-center min-w-24">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Collections</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary?.totalCollections}</span>
            </div>
            <div className="bg-card px-4 py-2 border rounded-xl shadow-xs text-center min-w-24 border-green-200 bg-green-50/15 dark:bg-green-950/10">
              <span className="text-[10px] uppercase font-bold text-green-600 block">Published</span>
              <span className="text-xl font-black text-green-700 dark:text-green-400">{summary?.publishedQuestions}</span>
            </div>
            <div className="bg-card px-4 py-2 border rounded-xl shadow-xs text-center min-w-24 border-amber-200 bg-amber-50/15 dark:bg-amber-950/10">
              <span className="text-[10px] uppercase font-bold text-amber-600 block">Draft</span>
              <span className="text-xl font-black text-amber-700 dark:text-amber-400">{summary?.draftQuestions}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button variant={activeTab === 'questions' ? 'default' : 'outline'} onClick={() => setActiveTab('questions')} className="rounded-xl">
          <FileQuestion className="h-4 w-4 mr-2" />
          View Questions
        </Button>
        <Button variant={activeTab === 'collections' ? 'default' : 'outline'} onClick={() => setActiveTab('collections')} className="rounded-xl">
          <Library className="h-4 w-4 mr-2" />
          Collections
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl">
          <Upload className="h-4 w-4 mr-2" />
          Import Questions
        </Button>
        <Button variant={activeTab === 'analytics' ? 'default' : 'outline'} onClick={() => setActiveTab('analytics')} className="rounded-xl">
          <BarChart2 className="h-4 w-4 mr-2" />
          Analytics
        </Button>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-600/90 text-white rounded-xl ml-auto">
          <Link href="/admin/questions">
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Link>
        </Button>
      </div>

      {/* Main Tabs Area */}
      <div className="mt-6">
        {/* A. Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <Card className="border">
              <CardHeader className="py-4 flex flex-row items-center justify-between gap-4 border-b">
                <CardTitle className="text-base font-bold">Topic Questions ({qTotal})</CardTitle>
                
                {/* Advanced Inline Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search question text..."
                      value={qSearch}
                      onChange={e => { setQSearch(e.target.value); setQPage(1); }}
                      className="pl-8 h-8 text-xs rounded-lg"
                    />
                  </div>

                  <Select value={qDifficulty} onValueChange={(v: string) => { setQDifficulty(v); setQPage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-28 rounded-lg"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={qType} onValueChange={(v: string) => { setQType(v); setQPage(1); }}>
                    <SelectTrigger className="h-8 text-xs w-32 rounded-lg"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single_choice">Single Choice</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="integer">Integer Choice</SelectItem>
                      <SelectItem value="numerical">Numerical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingQuestions ? (
                  <div className="p-8 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : !questions.length ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No questions found matching the selected filters.
                  </div>
                ) : (
                  <div className="divide-y">
                    {questions.map((q: any) => (
                      <div key={q.id} className="p-4 hover:bg-muted/10 transition-colors flex items-start gap-4">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5 font-bold">
                              {q.type.replace('_', ' ')}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-bold uppercase ${
                                q.difficulty === 'easy'
                                  ? 'text-green-600 border-green-200 bg-green-50/20'
                                  : q.difficulty === 'medium'
                                  ? 'text-blue-600 border-blue-200 bg-blue-50/20'
                                  : 'text-red-600 border-red-200 bg-red-50/20'
                              }`}
                            >
                              {q.difficulty}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground font-semibold">
                              Marks: +{q.positiveMarks}/-{q.negativeMarks}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-relaxed">
                            {q.text}
                          </p>
                          
                          {/* Options render */}
                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4 mt-2">
                              {q.options.map((opt: any) => (
                                <div key={opt.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 border rounded-lg ${opt.isCorrect ? 'bg-green-50/40 border-green-200 text-green-700 dark:text-green-400 font-semibold' : 'bg-background'}`}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  <span>{opt.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.explanation && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted/30 p-2.5 rounded-lg border">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Explanation:</span>
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Question Pagination */}
                {qTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                    <span className="text-xs text-muted-foreground">
                      Showing {(qPage - 1) * 25 + 1} - {Math.min(qPage * 25, qTotal)} of {qTotal} questions
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm"
                        disabled={qPage === 1}
                        onClick={() => setQPage(prev => Math.max(1, prev - 1))}
                        className="h-8"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={qPage === qTotalPages}
                        onClick={() => setQPage(prev => Math.min(qTotalPages, prev + 1))}
                        className="h-8"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* B. Collections Tab */}
        {activeTab === 'collections' && (
          <div className="space-y-4">
            <Card className="border">
              <CardHeader className="py-4 flex flex-row items-center justify-between border-b bg-card">
                <CardTitle className="text-base font-bold">Topic Collections ({collections.length})</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter collections..."
                      value={colSearch}
                      onChange={e => setColSearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-lg"
                    />
                  </div>
                  <Button size="sm" onClick={() => setCreateColOpen(true)} className="h-8 text-xs rounded-lg">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create Collection
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingCollections ? (
                  <div className="p-8 space-y-4 animate-pulse">
                    <div className="h-10 bg-muted rounded-lg" />
                    <div className="h-10 bg-muted rounded-lg" />
                  </div>
                ) : !collections.length ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No collections found matching.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collection Name</TableHead>
                        <TableHead>Questions Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.map((col) => (
                        <TableRow key={col.id}>
                          <TableCell className="font-semibold text-slate-800 dark:text-slate-100">
                            {col.name}
                            {col.description && (
                              <span className="block text-xs font-normal text-muted-foreground truncate max-w-sm mt-0.5">
                                {col.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-bold">
                              {col.questionsCount} questions
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {col.isArchived ? (
                              <Badge variant="destructive">Archived</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(col.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                                <Link href={`/admin/collections/${col.id}`}>
                                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleArchiveCollection(col.id)}
                                className="h-8 w-8 p-0"
                                title={col.isArchived ? "Restore" : "Archive"}
                              >
                                <Archive className="h-4 w-4 text-muted-foreground hover:text-amber-600" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleDeleteCollection(col.id)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Create Collection Dialog */}
            <Dialog open={createColOpen} onOpenChange={setCreateColOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Question Collection</DialogTitle>
                  <DialogDescription>
                    Create a new reusable collection of questions for practice modules or exams.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="col-name">Name *</Label>
                    <Input
                      id="col-name"
                      placeholder="e.g. Reasoning Calendars Advanced Quiz"
                      value={colName}
                      onChange={e => setColName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="col-desc">Description (optional)</Label>
                    <Textarea
                      id="col-desc"
                      placeholder="Provide context for this collection..."
                      value={colDesc}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setColDesc(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateColOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateCollection} disabled={createColMutation.isPending}>
                    {createColMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Collection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* C. Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {isLoadingSummary ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading analytics...</p>
              </div>
            ) : !summary ? (
              <div className="text-center py-16 text-muted-foreground">
                No summary data available.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Question Breakdown by Difficulty */}
                <Card className="border">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <BarChart2 className="h-4.5 w-4.5 text-primary" />
                      Difficulty Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-6 space-y-4">
                    {/* Easy */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-green-600 font-semibold flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Easy
                        </span>
                        <span>
                          {summary?.easyCount} / {summary?.totalQuestions} questions (
                          {summary?.totalQuestions > 0 ? Math.round((summary.easyCount / summary.totalQuestions) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${summary?.totalQuestions > 0 ? (summary.easyCount / summary.totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Medium */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Medium
                        </span>
                        <span>
                          {summary?.mediumCount} / {summary?.totalQuestions} questions (
                          {summary?.totalQuestions > 0 ? Math.round((summary.mediumCount / summary.totalQuestions) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${summary?.totalQuestions > 0 ? (summary.mediumCount / summary.totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Hard */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-red-600 font-semibold flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Hard
                        </span>
                        <span>
                          {summary?.hardCount} / {summary?.totalQuestions} questions (
                          {summary?.totalQuestions > 0 ? Math.round((summary.hardCount / summary.totalQuestions) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{ width: `${summary?.totalQuestions > 0 ? (summary.hardCount / summary.totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status distribution */}
                <Card className="border">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                      Publish Status Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-6 space-y-4">
                    {/* Published */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Published (Assigned to published exams)
                        </span>
                        <span>
                          {summary?.publishedQuestions} questions (
                          {summary?.totalQuestions > 0 ? Math.round((summary.publishedQuestions / summary.totalQuestions) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${summary?.totalQuestions > 0 ? (summary.publishedQuestions / summary.totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Draft */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Draft (Unassigned / Unused)
                        </span>
                        <span>
                          {summary?.draftQuestions} questions (
                          {summary?.totalQuestions > 0 ? Math.round((summary.draftQuestions / summary.totalQuestions) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${summary?.totalQuestions > 0 ? (summary.draftQuestions / summary.totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recently Added Questions */}
                <Card className="border col-span-1 md:col-span-2">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <Clock className="h-4.5 w-4.5 text-primary" />
                      Recently Added Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!summary?.recentQuestions?.length ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">No recent additions</div>
                    ) : (
                      <div className="divide-y text-sm">
                        {summary.recentQuestions.map((q: any) => (
                          <div key={q.id} className="p-4 hover:bg-muted/10 flex justify-between items-center gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{q.text}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Type: {q.type.replace('_', ' ')} · Difficulty: {q.difficulty}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold flex-shrink-0">
                              {new Date(q.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline Importer Dialog wrapper */}
      <QuestionImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultSubjectId={String(subjectId)}
        defaultTopicId={String(topicId)}
      />
    </div>
  );
}
