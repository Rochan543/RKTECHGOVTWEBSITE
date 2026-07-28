import { useState } from 'react';
import { useListSubjects, useCreateSubject, useListTopics, useCreateTopic } from '@workspace/api-client-react';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, BookOpen, Layers, Loader2, Hash, Pencil, Trash2 } from 'lucide-react';

async function apiCall<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await customFetch(path, opts) as Response;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function AdminSubjects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Subject dialogs
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [editSubject, setEditSubject] = useState<{ id: number; name: string; description: string | null } | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '' });
  const [deleteSubjectId, setDeleteSubjectId] = useState<number | null>(null);

  // Topic dialogs
  const [topicDialog, setTopicDialog] = useState(false);
  const [editTopic, setEditTopic] = useState<{ id: number; name: string; subjectId: number } | null>(null);
  const [topicForm, setTopicForm] = useState({ name: '', description: '', subjectId: '' });
  const [deleteTopicId, setDeleteTopicId] = useState<number | null>(null);

  const { data: subjects, isLoading: subjectsLoading } = useListSubjects();
  const { data: topics, isLoading: topicsLoading } = useListTopics(
    selectedSubject ? { subjectId: parseInt(selectedSubject) } : {},
  );
  const createSubject = useCreateSubject();
  const createTopic = useCreateTopic();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: ['topics'] });
  };

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description: string | null }) =>
      apiCall(`/api/v1/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => { toast({ title: 'Subject updated' }); invalidate(); setSubjectDialog(false); setEditSubject(null); },
    onError: () => toast({ title: 'Failed to update subject', variant: 'destructive' }),
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: number) => apiCall(`/api/v1/subjects/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ title: 'Subject deleted' }); invalidate(); setDeleteSubjectId(null); if (selectedSubject === String(deleteSubjectId)) setSelectedSubject(''); },
    onError: () => toast({ title: 'Failed to delete subject', variant: 'destructive' }),
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiCall(`/api/v1/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => { toast({ title: 'Topic updated' }); invalidate(); setTopicDialog(false); setEditTopic(null); },
    onError: () => toast({ title: 'Failed to update topic', variant: 'destructive' }),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => apiCall(`/api/v1/topics/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ title: 'Topic deleted' }); invalidate(); setDeleteTopicId(null); },
    onError: () => toast({ title: 'Failed to delete topic', variant: 'destructive' }),
  });

  const openCreateSubject = () => {
    setEditSubject(null);
    setSubjectForm({ name: '', description: '' });
    setSubjectDialog(true);
  };

  const openEditSubject = (s: { id: number; name: string; description: string | null }) => {
    setEditSubject(s);
    setSubjectForm({ name: s.name, description: s.description ?? '' });
    setSubjectDialog(true);
  };

  const openCreateTopic = () => {
    setEditTopic(null);
    setTopicForm({ name: '', description: '', subjectId: selectedSubject });
    setTopicDialog(true);
  };

  const openEditTopic = (t: { id: number; name: string; subjectId: number }) => {
    setEditTopic(t);
    setTopicForm({ name: t.name, description: '', subjectId: String(t.subjectId) });
    setTopicDialog(true);
  };

  const handleSubjectSave = () => {
    if (!subjectForm.name.trim()) {
      toast({ title: 'Subject name is required', variant: 'destructive' });
      return;
    }
    if (editSubject) {
      updateSubjectMutation.mutate({ id: editSubject.id, name: subjectForm.name.trim(), description: subjectForm.description.trim() || null });
    } else {
      createSubject.mutate(
        { data: { name: subjectForm.name.trim(), description: subjectForm.description.trim() || null } },
        {
          onSuccess: () => { toast({ title: 'Subject created' }); setSubjectDialog(false); setSubjectForm({ name: '', description: '' }); invalidate(); },
          onError: () => toast({ title: 'Failed to create subject', variant: 'destructive' }),
        },
      );
    }
  };

  const handleTopicSave = () => {
    if (!topicForm.name.trim() || (!topicForm.subjectId && !editTopic)) {
      toast({ title: 'Topic name and subject are required', variant: 'destructive' });
      return;
    }
    if (editTopic) {
      updateTopicMutation.mutate({ id: editTopic.id, name: topicForm.name.trim() });
    } else {
      createTopic.mutate(
        { data: { name: topicForm.name.trim(), subjectId: parseInt(topicForm.subjectId) } },
        {
          onSuccess: () => { toast({ title: 'Topic created' }); setTopicDialog(false); setTopicForm({ name: '', description: '', subjectId: '' }); invalidate(); },
          onError: () => toast({ title: 'Failed to create topic', variant: 'destructive' }),
        },
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects & Topics</h1>
          <p className="text-muted-foreground mt-1">Manage curriculum structure</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateTopic}>
            <Plus className="h-4 w-4 mr-2" /> Add Topic
          </Button>
          <Button onClick={openCreateSubject}>
            <Plus className="h-4 w-4 mr-2" /> Add Subject
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Subjects list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Subjects ({(subjects ?? []).length})</h2>
          {subjectsLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)
          ) : (subjects ?? []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-xl">No subjects yet</div>
          ) : (subjects ?? []).map((s: { id: number; name: string; description: string | null; questionCount: number }) => (
            <Card
              key={s.id}
              className={`cursor-pointer transition-all hover:shadow-sm ${String(s.id) === selectedSubject ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => setSelectedSubject(String(s.id) === selectedSubject ? '' : String(s.id))}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${String(s.id) === selectedSubject ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    <Hash className="h-2.5 w-2.5 mr-0.5" />{s.questionCount}
                  </Badge>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSubject(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteSubjectId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Topics list */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Topics {selectedSubject ? `(${(topics ?? []).length})` : '— select a subject'}
          </h2>
          {!selectedSubject ? (
            <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              Click a subject to view its topics
            </div>
          ) : topicsLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)
          ) : (topics ?? []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-xl">No topics for this subject yet</div>
          ) : (topics ?? []).map((t: { id: number; name: string; subjectId: number; subjectName: string; questionCount: number }) => (
            <Card key={t.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.questionCount} questions</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTopic(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTopicId(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Subject Create/Edit Dialog */}
      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSubject ? 'Edit Subject' : 'Create Subject'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={subjectForm.name}
                onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. General Intelligence"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={subjectForm.description}
                onChange={e => setSubjectForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubjectSave}
              disabled={createSubject.isPending || updateSubjectMutation.isPending}
            >
              {(createSubject.isPending || updateSubjectMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editSubject ? 'Save Changes' : 'Create Subject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic Create/Edit Dialog */}
      <Dialog open={topicDialog} onOpenChange={setTopicDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTopic ? 'Edit Topic' : 'Create Topic'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editTopic && (
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Select value={topicForm.subjectId} onValueChange={v => setTopicForm(f => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s: { id: number; name: string }) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Topic Name *</Label>
              <Input
                value={topicForm.name}
                onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Analogy & Series"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicDialog(false)}>Cancel</Button>
            <Button
              onClick={handleTopicSave}
              disabled={createTopic.isPending || updateTopicMutation.isPending || deleteTopicMutation.isPending}
            >
              {(createTopic.isPending || updateTopicMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editTopic ? 'Save Changes' : 'Create Topic'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirmation */}
      <AlertDialog open={deleteSubjectId !== null} onOpenChange={open => { if (!open) setDeleteSubjectId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the subject and all its topics. Questions linked to this subject may become orphaned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSubjectId !== null && deleteSubjectMutation.mutate(deleteSubjectId)}
            >
              {deleteSubjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Topic Confirmation */}
      <AlertDialog open={deleteTopicId !== null} onOpenChange={open => { if (!open) setDeleteTopicId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this topic. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTopicId !== null && deleteTopicMutation.mutate(deleteTopicId)}
            >
              {deleteTopicMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
