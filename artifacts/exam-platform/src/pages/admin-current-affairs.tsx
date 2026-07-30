import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { customFetch } from '@workspace/api-client-react';
import {
  Plus, Pencil, Trash2, Search, Newspaper, Loader2, Upload, X,
  RefreshCw, AlertCircle, BookOpen, Download, BrainCircuit, Globe, Calendar,
  Bold, Italic, List, Table2, Info, Eye, FileText, CheckCircle2
} from 'lucide-react';

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
  createdAt: string;
  author: string;
  readingTime: number;
  highlights: string | null;
  facts: string | null;
  examRelevance: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  views: number;
  bookmarksCount: number;
  featured: boolean;
  tags: Array<{ id: number; name: string }>;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  articleCount?: number;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  type: 'daily' | 'weekly' | 'monthly';
  duration: number | null;
  publishedDate: string;
  questionCount: number;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
}

interface MonthlyPdf {
  id: number;
  month: number;
  year: number;
  pdfUrl: string;
  pdfName: string;
  pdfSize: number;
  downloadCount: number;
  revisionNotes: string | null;
}

interface Question {
  id: number;
  text: string;
  difficulty: string;
  subjectName?: string;
}

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700 border-none',
  scheduled: 'bg-amber-100 text-amber-700 border-none',
  published: 'bg-emerald-100 text-emerald-700 border-none',
  archived: 'bg-red-100 text-red-700 border-none',
};

export default function AdminCurrentAffairs() {
  const [activeTab, setActiveTab] = useState('articles');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters & State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog & Modal Toggles
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);

  // Edit / Form Targets
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);

  // Article Form State
  const [articleForm, setArticleForm] = useState({
    title: '',
    subtitle: '',
    content: '',
    categoryId: 'none',
    imageUrl: '',
    author: 'Admin',
    readingTime: 5,
    highlights: '',
    facts: '',
    examRelevance: '',
    status: 'published' as Article['status'],
    featured: false,
    publishedDate: new Date().toISOString().split('T')[0],
    tags: [] as number[],
  });

  // Category Form State
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '' });

  // Tag Form State
  const [tagForm, setTagForm] = useState({ name: '', slug: '' });

  // Quiz Form State
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    type: 'daily' as Quiz['type'],
    duration: 10,
    publishedDate: new Date().toISOString().split('T')[0],
    status: 'published' as Quiz['status'],
    questions: [] as number[],
  });

  // PDF Form State
  const [pdfForm, setPdfForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    pdfUrl: '',
    pdfName: '',
    pdfSize: 0,
    revisionNotes: '',
  });

  // Questions Selector for Quiz Search
  const [questionSearch, setQuestionSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // API Queries & Mutations
  // ==========================================

  // Categories query
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => customFetch('/api/v1/current-affairs/categories'),
  });

  // Tags query
  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['admin-tags'],
    queryFn: () => customFetch('/api/v1/current-affairs/tags'),
  });

  // Articles query
  const { data: articlesData, isLoading: isLoadingArticles } = useQuery<{ data: Article[]; total: number }>({
    queryKey: ['admin-articles', categoryFilter, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      return customFetch(`/api/v1/current-affairs?${params}`);
    },
  });

  // Quizzes query
  const { data: quizzes } = useQuery<Quiz[]>({
    queryKey: ['admin-quizzes'],
    queryFn: () => customFetch('/api/v1/current-affairs/quiz'),
  });

  // Monthly PDFs query
  const { data: pdfs } = useQuery<MonthlyPdf[]>({
    queryKey: ['admin-pdfs'],
    queryFn: () => customFetch('/api/v1/current-affairs/monthly'),
  });

  // Repository Questions Search query
  const { data: repQuestions } = useQuery<{ data: Question[] }>({
    queryKey: ['repository-questions', questionSearch],
    queryFn: () => {
      const q = questionSearch ? encodeURIComponent(questionSearch) : '';
      return customFetch(`/api/v1/questions?limit=15&search=${q}`);
    },
  });

  const articles = articlesData?.data ?? [];

  // Mutations
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
    queryClient.invalidateQueries({ queryKey: ['current-affairs-feed'] });
    queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
    queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pdfs'] });
  };

  const articleMutation = useMutation({
    mutationFn: ({ id, body }: { id?: number; body: any }) => {
      if (id) {
        return customFetch(`/api/v1/admin/current-affairs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      return customFetch('/api/v1/admin/current-affairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast({ title: editArticle ? 'Article Updated' : 'Article Created' });
      setShowArticleDialog(false);
      invalidateAll();
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/admin/current-affairs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Article deleted successfully' });
      invalidateAll();
    },
  });

  const categoryMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/admin/current-affairs/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: 'Category created' });
      setShowCategoryDialog(false);
      setCategoryForm({ name: '', slug: '', description: '' });
      invalidateAll();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/admin/current-affairs/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Category deleted' });
      invalidateAll();
    },
  });

  const tagMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/admin/current-affairs/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: 'Tag added' });
      setShowTagDialog(false);
      setTagForm({ name: '', slug: '' });
      invalidateAll();
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/admin/current-affairs/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Tag deleted' });
      invalidateAll();
    },
  });

  const quizMutation = useMutation({
    mutationFn: ({ id, body }: { id?: number; body: any }) => {
      if (id) {
        return customFetch(`/api/v1/admin/current-affairs/quizzes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      return customFetch('/api/v1/admin/current-affairs/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast({ title: editQuiz ? 'Quiz Updated' : 'Quiz Created' });
      setShowQuizDialog(false);
      invalidateAll();
    },
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/admin/current-affairs/quizzes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Quiz deleted' });
      invalidateAll();
    },
  });

  const pdfMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch('/api/v1/admin/current-affairs/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: 'Monthly PDF compiled successfully' });
      setShowPdfDialog(false);
      setPdfForm({ month: 1, year: 2026, pdfUrl: '', pdfName: '', pdfSize: 0, revisionNotes: '' });
      invalidateAll();
    },
  });

  const deletePdfMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/v1/admin/current-affairs/pdf/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'PDF Compilation deleted' });
      invalidateAll();
    },
  });


  // ==========================================
  // Image / PDF File Upload Handles
  // ==========================================
  const handleFileUpload = async (file: File, type: 'image' | 'pdf') => {
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const raw = e.target?.result as string;
          const base64Content = raw.split(',')[1] || raw;

          const uploadRes = await customFetch('/api/v1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileData: base64Content,
            }),
          }) as any;

          if (type === 'image') {
            setArticleForm(f => ({ ...f, imageUrl: uploadRes.fileUrl }));
          } else {
            setPdfForm(f => ({
              ...f,
              pdfUrl: uploadRes.fileUrl,
              pdfName: file.name,
              pdfSize: file.size,
            }));
          }
          toast({ title: 'File uploaded successfully' });
        } catch (err: any) {
          toast({ title: 'Upload failed', description: err.message || String(err), variant: 'destructive' });
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      setIsUploading(false);
    }
  };


  // ==========================================
  // Dialog Open Handles
  // ==========================================
  const openCreateArticle = () => {
    setEditArticle(null);
    setArticleForm({
      title: '', subtitle: '', content: '', categoryId: 'none', imageUrl: '',
      author: 'Admin', readingTime: 5, highlights: '', facts: '', examRelevance: '',
      status: 'published', featured: false, publishedDate: new Date().toISOString().split('T')[0],
      tags: [],
    });
    setShowArticleDialog(true);
  };

  const openEditArticle = (art: Article) => {
    setEditArticle(art);
    setArticleForm({
      title: art.title,
      subtitle: art.subtitle ?? '',
      content: art.content,
      categoryId: art.categoryId ? String(art.categoryId) : 'none',
      imageUrl: art.imageUrl ?? '',
      author: art.author,
      readingTime: art.readingTime,
      highlights: art.highlights ?? '',
      facts: art.facts ?? '',
      examRelevance: art.examRelevance ?? '',
      status: art.status,
      featured: art.featured,
      publishedDate: art.publishedDate.split('T')[0],
      tags: art.tags.map(t => t.id),
    });
    setShowArticleDialog(true);
  };

  const handleArticleSave = () => {
    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    const catVal = articleForm.categoryId === 'none' ? null : parseInt(articleForm.categoryId, 10);
    const body = {
      ...articleForm,
      categoryId: catVal,
      publishedDate: new Date(articleForm.publishedDate).toISOString(),
    };
    articleMutation.mutate({ id: editArticle?.id, body });
  };

  // Quiz CRUD helpers
  const openCreateQuiz = () => {
    setEditQuiz(null);
    setQuizForm({
      title: '', description: '', type: 'daily', duration: 15,
      publishedDate: new Date().toISOString().split('T')[0], status: 'published',
      questions: [],
    });
    setShowQuizDialog(true);
  };

  const openEditQuiz = async (quiz: Quiz) => {
    setEditQuiz(quiz);
    try {
      const details = await customFetch(`/api/v1/current-affairs/quiz/${quiz.id}`) as any;
      setQuizForm({
        title: details.quiz.title,
        description: details.quiz.description ?? '',
        type: details.quiz.type,
        duration: details.quiz.duration ?? 10,
        publishedDate: details.quiz.publishedDate.split('T')[0],
        status: details.quiz.status || 'published',
        questions: details.questions.map((q: any) => q.id),
      });
      setShowQuizDialog(true);
    } catch {
      toast({ title: 'Failed to load quiz questions', variant: 'destructive' });
    }
  };

  const handleQuizSave = () => {
    if (!quizForm.title.trim()) {
      toast({ title: 'Quiz title is required', variant: 'destructive' });
      return;
    }
    const body = {
      ...quizForm,
      publishedDate: new Date(quizForm.publishedDate).toISOString(),
    };
    quizMutation.mutate({ id: editQuiz?.id, body });
  };

  // Editor Toolbar helper
  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    const el = document.getElementById('article-content-textarea') as HTMLTextAreaElement;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.substring(start, end);
    const replacement = prefix + selected + suffix;

    setArticleForm(f => ({
      ...f,
      content: text.substring(0, start) + replacement + text.substring(end)
    }));

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Current Affairs & Learning CMS
          </h1>
          <p className="text-muted-foreground mt-1">Manage articles, configurable categories, custom tags, daily quizzes, and monthly compendiums.</p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'articles' && (
            <Button onClick={openCreateArticle} className="gap-1.5 rounded-lg">
              <Plus className="h-4 w-4" /> Add Article
            </Button>
          )}
          {activeTab === 'quizzes' && (
            <Button onClick={openCreateQuiz} className="gap-1.5 rounded-lg">
              <Plus className="h-4 w-4" /> Create Quiz
            </Button>
          )}
          {activeTab === 'monthly' && (
            <Button onClick={() => setShowPdfDialog(true)} className="gap-1.5 rounded-lg">
              <Plus className="h-4 w-4" /> Compile PDF
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="flex overflow-x-auto bg-muted p-1 rounded-xl h-auto">
          <TabsTrigger value="articles" className="rounded-lg flex-1 md:flex-none">Articles</TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-lg flex-1 md:flex-none">Daily/Weekly Quizzes</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg flex-1 md:flex-none">Categories</TabsTrigger>
          <TabsTrigger value="tags" className="rounded-lg flex-1 md:flex-none">Tags</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-lg flex-1 md:flex-none">Monthly Compilations</TabsTrigger>
        </TabsList>

        {/* ========================================== */}
        {/* TABS CONTENT: ARTICLES */}
        {/* ========================================== */}
        <TabsContent value="articles" className="space-y-4 outline-none">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories ?? []).map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingArticles ? (
            <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 bg-muted animate-pulse rounded-lg"/>)}</div>
          ) : articles.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><Newspaper className="h-10 w-10 mx-auto opacity-35 mb-2"/>No articles compiled yet.</CardContent></Card>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published Date</TableHead>
                    <TableHead>Views/Saved</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map(art => (
                    <TableRow key={art.id}>
                      <TableCell className="font-semibold max-w-xs truncate">{art.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{art.categoryName || 'GK'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${STATUS_COLORS[art.status]}`}>{art.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(art.publishedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        👁️ {art.views} &bull; 💾 {art.bookmarksCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEditArticle(art)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if(confirm('Delete this article?')) deleteArticleMutation.mutate(art.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ========================================== */}
        {/* TABS CONTENT: QUIZZES */}
        {/* ========================================== */}
        <TabsContent value="quizzes" className="space-y-4 outline-none">
          {!quizzes || quizzes.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><BrainCircuit className="h-10 w-10 mx-auto opacity-35 mb-2"/>No learning quizzes configured yet.</CardContent></Card>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Questions Count</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.map(quiz => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-semibold">{quiz.title}</TableCell>
                      <TableCell><Badge className="capitalize">{quiz.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{quiz.duration ? `${quiz.duration} Mins` : 'Untimed'}</TableCell>
                      <TableCell className="text-xs font-semibold">{quiz.questionCount} Questions</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(quiz.publishedDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEditQuiz(quiz)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if(confirm('Delete this quiz?')) deleteQuizMutation.mutate(quiz.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ========================================== */}
        {/* TABS CONTENT: CATEGORIES */}
        {/* ========================================== */}
        <TabsContent value="categories" className="space-y-4 outline-none">
          <div className="flex justify-end">
            <Button onClick={() => setShowCategoryDialog(true)} className="gap-1.5 rounded-lg text-xs">
              <Plus className="h-4 w-4" /> Create Category
            </Button>
          </div>

          {!categories || categories.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">No custom categories configured.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {categories.map(cat => (
                <Card key={cat.id} className="rounded-xl flex flex-col justify-between">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-base font-bold flex justify-between items-center">
                      <span>{cat.name}</span>
                      <Badge className="bg-indigo-50 text-indigo-700 border-none font-semibold text-[10px]">{cat.articleCount ?? 0} articles</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold">Slug: {cat.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    {cat.description && <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>}
                    <Button variant="outline" size="sm" className="w-full text-xs text-destructive rounded-lg gap-1 border-destructive/20 hover:bg-destructive/10" onClick={() => { if(confirm('Delete this category?')) deleteCategoryMutation.mutate(cat.id); }}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove Category
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================== */}
        {/* TABS CONTENT: TAGS */}
        {/* ========================================== */}
        <TabsContent value="tags" className="space-y-4 outline-none">
          <div className="flex justify-end">
            <Button onClick={() => setShowTagDialog(true)} className="gap-1.5 rounded-lg text-xs">
              <Plus className="h-4 w-4" /> Add Tag Label
            </Button>
          </div>

          {!tags || tags.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">No tags configured.</CardContent></Card>
          ) : (
            <Card className="rounded-xl p-5">
              <div className="flex flex-wrap gap-2.5">
                {tags.map(tag => (
                  <Badge key={tag.id} className="text-xs bg-muted text-muted-foreground border-none hover:bg-red-50 hover:text-red-700 font-semibold px-3 py-1 rounded cursor-pointer gap-1.5 group" onClick={() => { if(confirm(`Delete tag #${tag.name}?`)) deleteTagMutation.mutate(tag.id); }}>
                    #{tag.name}
                    <X className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ========================================== */}
        {/* TABS CONTENT: MONTHLY COMPILATIONS */}
        {/* ========================================== */}
        <TabsContent value="monthly" className="space-y-4 outline-none">
          {!pdfs || pdfs.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><Download className="h-10 w-10 mx-auto opacity-35 mb-2"/>No compilations uploaded.</CardContent></Card>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compilation Month/Year</TableHead>
                    <TableHead>PDF File Name</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Downloads Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pdfs.map(pdf => (
                    <TableRow key={pdf.id}>
                      <TableCell className="font-semibold">{pdf.month} / {pdf.year}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{pdf.pdfName}</TableCell>
                      <TableCell className="text-xs">{pdf.pdfSize ? `${(pdf.pdfSize / (1024 * 1024)).toFixed(1)} MB` : '0.0 MB'}</TableCell>
                      <TableCell className="text-xs font-bold text-primary">📥 {pdf.downloadCount} Downloads</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if(confirm('Delete this PDF compilation?')) deletePdfMutation.mutate(pdf.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>


      {/* ====================================================================== */}
      {/* 1. ARTICLE EDITOR DIALOG (Rich Markdown with Live Preview) */}
      {/* ====================================================================== */}
      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold">{editArticle ? 'Edit Current Affairs Article' : 'New Current Affairs Article'}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => setShowArticleDialog(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0 mt-4">
            <TabsList className="bg-muted p-0.5 rounded-lg w-fit mb-3">
              <TabsTrigger value="editor" className="text-xs py-1.5 px-3">Live Markdown Editor</TabsTrigger>
              <TabsTrigger value="metadata" className="text-xs py-1.5 px-3">Metadata & Tags</TabsTrigger>
            </TabsList>

            {/* TAB CONTENT: EDITOR SPLIT SCREEN */}
            <TabsContent value="editor" className="flex-1 min-h-0 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* Left Side: Markdown inputs + Toolbar */}
                <div className="flex flex-col gap-2.5 h-full">
                  <div className="space-y-1 shrink-0">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Article Title *</label>
                    <Input
                      placeholder="Title of the article..."
                      value={articleForm.title}
                      onChange={e => setArticleForm(f => ({ ...f, title: e.target.value }))}
                      className="h-10"
                    />
                  </div>

                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg border shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTextAtCursor('**', '**')} title="Bold">
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTextAtCursor('*', '*')} title="Italic">
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTextAtCursor('\n- ', '')} title="List">
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTextAtCursor('\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n')} title="Table">
                      <Table2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTextAtCursor('\n<div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 my-4 rounded-r-lg text-indigo-900">\nHighlight text\n</div>\n')} title="Highlight Box">
                      <Info className="h-3.5 w-3.5 text-indigo-600" />
                    </Button>
                  </div>

                  <div className="flex-1 min-h-0 relative">
                    <Textarea
                      id="article-content-textarea"
                      placeholder="Write your article content in Markdown format..."
                      value={articleForm.content}
                      onChange={e => setArticleForm(f => ({ ...f, content: e.target.value }))}
                      className="h-full resize-none font-mono text-xs leading-relaxed p-4"
                    />
                  </div>
                </div>

                {/* Right Side: Rendered HTML Live Preview */}
                <div className="border rounded-xl p-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed">
                  <div className="border-b pb-2 mb-4 font-bold text-muted-foreground uppercase text-[10px]">
                    Live Article Preview Mode
                  </div>
                  {articleForm.title ? (
                    <h1 className="text-lg font-bold leading-tight mb-2">{articleForm.title}</h1>
                  ) : (
                    <span className="text-muted-foreground font-semibold italic">Title of article will render here</span>
                  )}
                  {articleForm.subtitle && <p className="text-muted-foreground italic mb-4">{articleForm.subtitle}</p>}
                  
                  {articleForm.content ? (
                    <div className="whitespace-pre-wrap text-foreground/90 font-normal" dangerouslySetInnerHTML={{ __html: articleForm.content }} />
                  ) : (
                    <span className="text-muted-foreground/60 italic font-medium block mt-6">Content body preview will render here</span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: METADATA & ACCORDIONS */}
            <TabsContent value="metadata" className="flex-1 overflow-y-auto space-y-4 outline-none pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Subtitle (Optional)</label>
                  <Input
                    placeholder="Short subtitle summary..."
                    value={articleForm.subtitle}
                    onChange={e => setArticleForm(f => ({ ...f, subtitle: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Category</label>
                  <Select value={articleForm.categoryId} onValueChange={v => setArticleForm(f => ({ ...f, categoryId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General GK (No Category)</SelectItem>
                      {(categories ?? []).map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Author</label>
                  <Input
                    value={articleForm.author}
                    onChange={e => setArticleForm(f => ({ ...f, author: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reading Time (Mins)</label>
                  <Input
                    type="number"
                    value={articleForm.readingTime}
                    onChange={e => setArticleForm(f => ({ ...f, readingTime: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Published Date</label>
                  <Input
                    type="date"
                    value={articleForm.publishedDate}
                    onChange={e => setArticleForm(f => ({ ...f, publishedDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Highlights, Facts, Exam Relevance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Highlights (one per line)</label>
                  <Textarea
                    rows={4}
                    placeholder="- Key highlights...\n- Important point..."
                    value={articleForm.highlights}
                    onChange={e => setArticleForm(f => ({ ...f, highlights: e.target.value }))}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Quick Facts (Name: Value per line)</label>
                  <Textarea
                    rows={4}
                    placeholder="Capital: New Delhi\nCurrency: INR"
                    value={articleForm.facts}
                    onChange={e => setArticleForm(f => ({ ...f, facts: e.target.value }))}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Exam Relevance Description</label>
                  <Textarea
                    rows={4}
                    placeholder="Crucial for SSC CGL General Awareness..."
                    value={articleForm.examRelevance}
                    onChange={e => setArticleForm(f => ({ ...f, examRelevance: e.target.value }))}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Status and Image upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Image Upload</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'image');
                    }}
                  />
                  <div
                    className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-muted/30 transition-colors text-xs font-semibold"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    ) : articleForm.imageUrl ? (
                      <span className="truncate max-w-[250px] block mx-auto text-primary font-bold">{articleForm.imageUrl}</span>
                    ) : (
                      <span>Drag & drop image or click to upload</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                    <Select value={articleForm.status} onValueChange={v => setArticleForm(f => ({ ...f, status: v as Article['status'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="art-featured"
                      checked={articleForm.featured}
                      onChange={e => setArticleForm(f => ({ ...f, featured: e.target.checked }))}
                    />
                    <label htmlFor="art-featured" className="text-xs font-bold uppercase cursor-pointer">Featured on Dashboard</label>
                  </div>
                </div>
              </div>

              {/* Tag Multi Select selection checkboxes */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Assign Tags</label>
                <div className="flex flex-wrap gap-2.5 max-h-24 overflow-y-auto border p-3.5 rounded-lg bg-slate-50/50 dark:bg-slate-900/10">
                  {tags?.map(t => {
                    const isChecked = articleForm.tags.includes(t.id);
                    return (
                      <Badge
                        key={t.id}
                        variant={isChecked ? 'default' : 'outline'}
                        className="cursor-pointer text-xs font-semibold py-0.5 px-2 rounded"
                        onClick={() => {
                          setArticleForm(f => {
                            const updated = isChecked
                              ? f.tags.filter(id => id !== t.id)
                              : [...f.tags, t.id];
                            return { ...f, tags: updated };
                          });
                        }}
                      >
                        #{t.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-3 shrink-0">
            <Button variant="outline" onClick={() => setShowArticleDialog(false)}>Cancel</Button>
            <Button onClick={handleArticleSave} disabled={articleMutation.isPending}>
              {editArticle ? 'Update Article' : 'Create Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ====================================================================== */}
      {/* 2. QUIZ BUILDER DIALOG (search and select questions) */}
      {/* ====================================================================== */}
      <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3 shrink-0">
            <DialogTitle className="text-lg font-bold">{editQuiz ? 'Edit Daily Quiz' : 'Create Learning Quiz'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
            {/* Left Column: General Metadata */}
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Quiz Title *</label>
                <Input
                  placeholder="E.g. Daily Current Affairs Quiz - 30 July"
                  value={quizForm.title}
                  onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                <Textarea
                  placeholder="Detailed description of coverage..."
                  value={quizForm.description}
                  onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Quiz Type</label>
                  <Select value={quizForm.type} onValueChange={v => setQuizForm(f => ({ ...f, type: v as Quiz['type'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Quiz</SelectItem>
                      <SelectItem value="weekly">Weekly Quiz</SelectItem>
                      <SelectItem value="monthly">Monthly Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Duration (Mins)</label>
                  <Input
                    type="number"
                    value={quizForm.duration}
                    onChange={e => setQuizForm(f => ({ ...f, duration: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Publish Date</label>
                  <Input
                    type="date"
                    value={quizForm.publishedDate}
                    onChange={e => setQuizForm(f => ({ ...f, publishedDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                  <Select value={quizForm.status} onValueChange={v => setQuizForm(f => ({ ...f, status: v as Quiz['status'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assigned Questions panel */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Assigned Questions ({quizForm.questions.length})</label>
                <div className="border rounded-xl divide-y bg-slate-50/50 max-h-48 overflow-y-auto">
                  {quizForm.questions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No questions assigned yet. Select from the right search panel.</div>
                  ) : (
                    quizForm.questions.map((qId, idx) => (
                      <div key={qId} className="p-2.5 text-xs flex justify-between items-center bg-card">
                        <span className="font-semibold text-muted-foreground leading-snug line-clamp-1 flex-1">
                          {idx + 1}. Q-{qId} (Assigned)
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => setQuizForm(f => ({ ...f, questions: f.questions.filter(id => id !== qId) }))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Search Questions & Assign */}
            <div className="flex flex-col min-h-0 gap-3 border-l pl-4">
              <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Assign Questions from Bank</label>
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search repository questions..."
                  className="pl-8 h-9 text-xs"
                  value={questionSearch}
                  onChange={e => setQuestionSearch(e.target.value)}
                />
              </div>

              {/* List of repository questions */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y border rounded-xl">
                {!repQuestions || repQuestions.data.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No questions matching query.</div>
                ) : (
                  repQuestions.data.map(q => {
                    const isAssigned = quizForm.questions.includes(q.id);
                    return (
                      <div key={q.id} className="p-3 text-xs flex justify-between items-start gap-4 bg-card hover:bg-muted/30">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-bold line-clamp-2 leading-relaxed text-slate-800 dark:text-slate-200">{q.text}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-[9px] font-semibold">ID: {q.id}</Badge>
                            <Badge className="text-[9px] font-semibold">{q.difficulty}</Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAssigned ? 'destructive' : 'default'}
                          className="h-7 text-[10px] shrink-0 font-bold"
                          onClick={() => {
                            setQuizForm(f => {
                              const updated = isAssigned
                                ? f.questions.filter(id => id !== q.id)
                                : [...f.questions, q.id];
                              return { ...f, questions: updated };
                            });
                          }}
                        >
                          {isAssigned ? 'Remove' : 'Assign'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 shrink-0">
            <Button variant="outline" onClick={() => setShowQuizDialog(false)}>Cancel</Button>
            <Button onClick={handleQuizSave} disabled={quizMutation.isPending}>
              {editQuiz ? 'Update Quiz' : 'Create Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ====================================================================== */}
      {/* 3. CATEGORY CREATOR DIALOG */}
      {/* ====================================================================== */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>New Configurable Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Category Name *</label>
              <Input
                placeholder="E.g. Defence & Security"
                value={categoryForm.name}
                onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Unique Slug *</label>
              <Input
                placeholder="E.g. defence-security"
                value={categoryForm.slug}
                onChange={e => setCategoryForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
              <Textarea
                placeholder="Short description of this learning syllabus..."
                value={categoryForm.description}
                onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              if(!categoryForm.name.trim() || !categoryForm.slug.trim()) return;
              categoryMutation.mutate(categoryForm);
            }} disabled={categoryMutation.isPending}>
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ====================================================================== */}
      {/* 4. TAG CREATOR DIALOG */}
      {/* ====================================================================== */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>New Tag Label</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Tag Name *</label>
              <Input
                placeholder="E.g. G20 Summit"
                value={tagForm.name}
                onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Unique Slug *</label>
              <Input
                placeholder="e.g. g20-summit"
                value={tagForm.slug}
                onChange={e => setTagForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              if(!tagForm.name.trim() || !tagForm.slug.trim()) return;
              tagMutation.mutate(tagForm);
            }} disabled={tagMutation.isPending}>
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ====================================================================== */}
      {/* 5. PDF COMPILATION DIALOG */}
      {/* ====================================================================== */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Compile Monthly PDF Issue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Month</label>
                <Select value={String(pdfForm.month)} onValueChange={v => setPdfForm(f => ({ ...f, month: parseInt(v, 10) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({length:12}).map((_,i) => <SelectItem key={i+1} value={String(i+1)}>Month {i+1}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Year</label>
                <Input
                  type="number"
                  value={pdfForm.year}
                  onChange={e => setPdfForm(f => ({ ...f, year: parseInt(e.target.value, 10) || 2026 }))}
                />
              </div>
            </div>

            {/* Drag and Drop PDF Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase block">Upload Compilation PDF *</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'pdf');
                }}
              />
              <div
                className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-muted/30 transition-colors text-xs font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                ) : pdfForm.pdfUrl ? (
                  <div className="space-y-1">
                    <span className="block text-primary font-bold">{pdfForm.pdfName}</span>
                    <span className="text-[10px] text-muted-foreground">Size: {(pdfForm.pdfSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                ) : (
                  <span>Drag & drop PDF or click to upload</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Manual PDF URL (Optional)</label>
              <Input
                placeholder="https://..."
                value={pdfForm.pdfUrl}
                onChange={e => setPdfForm(f => ({ ...f, pdfUrl: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Revision Notes Compendium</label>
              <Textarea
                placeholder="Brief summary points for quick revision..."
                value={pdfForm.revisionNotes}
                onChange={e => setPdfForm(f => ({ ...f, revisionNotes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              if(!pdfForm.pdfUrl) { toast({ title: 'PDF upload/URL is required', variant: 'destructive' }); return; }
              pdfMutation.mutate(pdfForm);
            }} disabled={pdfMutation.isPending}>
              Publish PDF Compendium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
