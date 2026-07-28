import { useState } from 'react';
import { useListSubjects, useCreateSubject, useListTopics, useCreateTopic } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, Layers, Loader2, Hash } from 'lucide-react';

export default function AdminSubjects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [topicDialog, setTopicDialog] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '' });
  const [topicForm, setTopicForm] = useState({ name: '', description: '', subjectId: '' });

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

  const handleCreateSubject = () => {
    if (!subjectForm.name.trim()) {
      toast({ title: 'Subject name is required', variant: 'destructive' });
      return;
    }
    createSubject.mutate(
      { data: { name: subjectForm.name.trim(), description: subjectForm.description.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: 'Subject created' });
          setSubjectDialog(false);
          setSubjectForm({ name: '', description: '' });
          invalidate();
        },
        onError: () => toast({ title: 'Failed to create subject', variant: 'destructive' }),
      },
    );
  };

  const handleCreateTopic = () => {
    if (!topicForm.name.trim() || !topicForm.subjectId) {
      toast({ title: 'Topic name and subject are required', variant: 'destructive' });
      return;
    }
    createTopic.mutate(
      { data: { name: topicForm.name.trim(), subjectId: parseInt(topicForm.subjectId) } },
      {
        onSuccess: () => {
          toast({ title: 'Topic created' });
          setTopicDialog(false);
          setTopicForm({ name: '', description: '', subjectId: '' });
          invalidate();
        },
        onError: () => toast({ title: 'Failed to create topic', variant: 'destructive' }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects & Topics</h1>
          <p className="text-muted-foreground mt-1">Manage curriculum structure</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setTopicForm(f => ({ ...f, subjectId: selectedSubject })); setTopicDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Topic
          </Button>
          <Button onClick={() => setSubjectDialog(true)}>
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
                </div>
              </CardContent>
            </Card>
          ))}
          {!(subjects ?? []).length && !subjectsLoading && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No subjects yet. Create one to get started.
            </div>
          )}
        </div>

        {/* Topics */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {selectedSubject ? `Topics in ${(subjects ?? []).find((s: { id: number; name: string }) => String(s.id) === selectedSubject)?.name ?? ''}` : 'Select a subject to view topics'}
          </h2>
          {!selectedSubject ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Select a subject on the left to view its topics</p>
              </CardContent>
            </Card>
          ) : topicsLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)
          ) : (topics ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <p className="text-sm">No topics yet for this subject.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setTopicForm(f => ({ ...f, subjectId: selectedSubject })); setTopicDialog(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Topic
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {(topics ?? []).map((t: { id: number; name: string; description?: string | null; subjectId: number }) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Subject Dialog */}
      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Subject</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. General Intelligence" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={subjectForm.description} onChange={e => setSubjectForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSubject} disabled={createSubject.isPending}>
              {createSubject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Topic Dialog */}
      <Dialog open={topicDialog} onOpenChange={setTopicDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Topic</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Select value={topicForm.subjectId} onValueChange={v => setTopicForm(f => ({ ...f, subjectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((s: { id: number; name: string }) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Topic Name *</Label>
              <Input value={topicForm.name} onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Analogies" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={topicForm.description} onChange={e => setTopicForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTopic} disabled={createTopic.isPending}>
              {createTopic.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
