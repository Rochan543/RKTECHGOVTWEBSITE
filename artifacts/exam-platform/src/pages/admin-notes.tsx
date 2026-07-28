import { useState, useRef } from 'react';
import { useListNotes, useCreateNote, useDeleteNote, useListSubjects, customFetch } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Search, ExternalLink, FileText, Loader2, ChevronLeft, ChevronRight, Download, Upload, X } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  ppt: 'bg-orange-100 text-orange-700',
  image: 'bg-green-100 text-green-700',
  video: 'bg-purple-100 text-purple-700',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NoteForm {
  title: string;
  description: string;
  type: string;
  fileUrl: string;
  thumbnailUrl: string;
  size: string;
  subjectId: string;
}

const defaultForm = (): NoteForm => ({
  title: '', description: '', type: 'pdf', fileUrl: '', thumbnailUrl: '', size: '0', subjectId: '',
});

export default function AdminNotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NoteForm>(defaultForm());
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
            fileUrl: uploadRes.fileUrl,
            size: String(uploadRes.fileSize || file.size),
            type: file.name.endsWith('.pdf') ? 'pdf' : 
                  file.name.endsWith('.docx') ? 'docx' : 
                  file.name.endsWith('.ppt') || file.name.endsWith('.pptx') ? 'ppt' : 
                  file.type.startsWith('video/') ? 'video' : 
                  file.type.startsWith('image/') ? 'image' : f.type,
          }));
          toast({ title: 'File uploaded successfully' });
        } catch (err: any) {
          const msg = err.message || String(err);
          // Standardized warning if not configured
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

  const { data, isLoading } = useListNotes({ page, limit: 20 });
  const { data: subjects } = useListSubjects();
  const create = useCreateNote();
  const remove = useDeleteNote();

  const allNotes = data?.data ?? [];
  const notes = search
    ? allNotes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()))
    : allNotes;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleCreate = () => {
    if (!form.title.trim() || !form.fileUrl.trim()) {
      toast({ title: 'Title and File URL are required', variant: 'destructive' });
      return;
    }
    create.mutate(
      {
        data: {
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: form.type as 'pdf' | 'docx' | 'ppt' | 'image' | 'video',
          fileUrl: form.fileUrl.trim(),
          thumbnailUrl: form.thumbnailUrl.trim() || null,
          size: parseInt(form.size) || 0,
          subjectId: form.subjectId ? parseInt(form.subjectId) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Note created' });
          setDialogOpen(false);
          setForm(defaultForm());
          queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
        onError: () => toast({ title: 'Failed to create note', variant: 'destructive' }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    remove.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Note deleted' });
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes & PDFs</h1>
          <p className="text-muted-foreground mt-1">{total} study materials</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Material
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search materials…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-28">Subject</TableHead>
                <TableHead className="w-20">Size</TableHead>
                <TableHead className="w-24">Downloads</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((__, j) => <TableCell key={j}><div className="h-5 bg-muted rounded animate-pulse" /></TableCell>)}
                  </TableRow>
                ))
              ) : notes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    No materials yet
                  </TableCell>
                </TableRow>
              ) : notes.map((n: { id: number; title: string; type: string; subjectId: number | null; size: number; downloadCount?: number | null; fileUrl: string; description?: string | null }) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                        {n.description && <p className="text-xs text-muted-foreground line-clamp-1">{n.description}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${TYPE_COLORS[n.type] ?? 'bg-muted text-muted-foreground'}`}>
                      {n.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(subjects ?? []).find((s: { id: number; name: string }) => s.id === n.subjectId)?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatBytes(n.size)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Download className="h-3 w-3" />{n.downloadCount ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={n.fileUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Study Material</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. SSC CGL Quantitative Aptitude Notes" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pdf', 'docx', 'ppt', 'image', 'video'].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={form.subjectId || 'none'} onValueChange={v => setForm(f => ({ ...f, subjectId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(subjects ?? []).map((s: { id: number; name: string }) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Drag and Drop File Upload Area */}
            <div className="space-y-1.5">
              <Label>File Upload</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.ppt,.pptx,image/*,video/*"
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
                ) : form.fileUrl ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium line-clamp-1 max-w-[200px]">{form.fileUrl}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={e => {
                        e.stopPropagation();
                        setForm(f => ({ ...f, fileUrl: '', size: '0' }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">Drag & drop or click to upload</p>
                    <p className="text-[10px] text-muted-foreground">PDF, DOCX, PPT, Image, Video</p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>File URL *</Label>
              <Input value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Thumbnail URL</Label>
              <Input value={form.thumbnailUrl} onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="https://… (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
