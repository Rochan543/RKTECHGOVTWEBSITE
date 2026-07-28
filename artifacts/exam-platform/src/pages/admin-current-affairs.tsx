import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { customFetch } from '@workspace/api-client-react';
import { Plus, Pencil, Trash2, Search, Newspaper, Loader2, Upload, X } from 'lucide-react';

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
  gk: 'bg-blue-100 text-blue-700',
  current_affairs: 'bg-green-100 text-green-700',
  gs_news: 'bg-orange-100 text-orange-700',
};

async function fetchCA<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await customFetch(path, opts) as Response;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

const defaultForm = {
  title: '',
  content: '',
  category: 'current_affairs' as Category,
  imageUrl: '',
  publishedDate: new Date().toISOString().split('T')[0],
};

export default function AdminCurrentAffairs() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Article | null>(null);
  const [form, setForm] = useState(defaultForm);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setUploadProgress(30);
          const raw = e.target?.result as string;
          const base64Content = raw.split(',')[1] || raw;

          setUploadProgress(50);
          const uploadRes = await customFetch('/api/v1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileData: base64Content,
            }),
          }) as any;

          setUploadProgress(90);
          setForm(f => ({
            ...f,
            imageUrl: uploadRes.fileUrl,
          }));
          toast({ title: 'Image uploaded successfully' });
        } catch (err: any) {
          const msg = err.message || String(err);
          if (msg.includes("not configured") || msg.includes("503")) {
            toast({ title: 'Upload failed', description: 'Storage provider is not configured.', variant: 'destructive' });
          } else {
            toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
          }
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || String(err), variant: 'destructive' });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-current-affairs', categoryFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (search) params.set('search', search);
      return fetchCA<{ data: Article[]; total: number }>(`/api/v1/current-affairs?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof defaultForm) =>
      fetchCA('/api/v1/current-affairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, publishedDate: new Date(body.publishedDate).toISOString() }),
      }),
    onSuccess: () => {
      toast({ title: 'Article created' });
      queryClient.invalidateQueries({ queryKey: ['admin-current-affairs'] });
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: () => toast({ title: 'Failed to create article', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<typeof defaultForm> }) =>
      fetchCA(`/api/v1/current-affairs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, publishedDate: body.publishedDate ? new Date(body.publishedDate).toISOString() : undefined }),
      }),
    onSuccess: () => {
      toast({ title: 'Article updated' });
      queryClient.invalidateQueries({ queryKey: ['admin-current-affairs'] });
      setShowDialog(false);
      setEditItem(null);
    },
    onError: () => toast({ title: 'Failed to update article', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchCA(`/api/v1/current-affairs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Article deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-current-affairs'] });
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm(defaultForm);
    setShowDialog(true);
  };

  const openEdit = (item: Article) => {
    setEditItem(item);
    setForm({
      title: item.title,
      content: item.content,
      category: item.category,
      imageUrl: item.imageUrl ?? '',
      publishedDate: item.publishedDate.split('T')[0],
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const articles = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            Current Affairs
          </h1>
          <p className="text-muted-foreground mt-1">Manage GK, Current Affairs, and GS News articles</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Article
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(['gk', 'current_affairs', 'gs_news'] as Category[]).map(cat => (
          <Card key={cat}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
              <p className="text-2xl font-bold">{articles.filter(a => a.category === cat).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="gk">General Knowledge</SelectItem>
            <SelectItem value="current_affairs">Current Affairs</SelectItem>
            <SelectItem value="gs_news">GS News</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-14 bg-muted animate-pulse rounded"/>)}</div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No articles found. Add your first article!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Content Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map(article => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium max-w-xs truncate">{article.title}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${CATEGORY_COLORS[article.category]}`} variant="outline">
                      {CATEGORY_LABELS[article.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(article.publishedDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {article.content.substring(0, 80)}...
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Delete this article?')) deleteMutation.mutate(article.id); }}
                      >
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Article' : 'New Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                placeholder="Article title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as Category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gk">General Knowledge</SelectItem>
                    <SelectItem value="current_affairs">Current Affairs</SelectItem>
                    <SelectItem value="gs_news">GS News</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Published Date</label>
                <Input
                  type="date"
                  value={form.publishedDate}
                  onChange={e => setForm(f => ({ ...f, publishedDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Content *</label>
              <Textarea
                placeholder="Article content..."
                rows={6}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            {/* Drag and Drop Image Upload Area */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium mb-1 block">Image Upload</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              >
                {isUploading ? (
                  <div className="space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Uploading: {uploadProgress}%</p>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : form.imageUrl ? (
                  <div className="flex items-center justify-center gap-2">
                    <Newspaper className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium line-clamp-1 max-w-[200px]">{form.imageUrl}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={e => {
                        e.stopPropagation();
                        setForm(f => ({ ...f, imageUrl: '' }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">Drag & drop image or click to upload</p>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG, JPEG, GIF</p>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Image URL (optional)</label>
              <Input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
