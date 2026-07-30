import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  useGetCollection,
  useUpdateCollectionItems,
  useListQuestions,
  useListSubjects,
  useDuplicateCollection,
  useDeleteCollection,
  useArchiveCollection,
  useUpdateCollection,
  getGetCollectionQueryKey,
  getListCollectionsQueryKey,
  customFetch,
} from '@workspace/api-client-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Copy,
  Archive,
  Edit3,
  Loader2,
  Search,
  BookOpen,
  X,
  CheckCircle2,
} from 'lucide-react';

const DIFFICULTY_COLORS = { easy: 'secondary', medium: 'outline', hard: 'destructive' } as const;

export default function AdminCollectionDetails({ params }: { params: { id: string } }) {
  const collectionId = parseInt(params.id);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Dialog & Modal States
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Rename fields
  const [renameName, setRenameName] = useState('');
  const [renameDesc, setRenameDesc] = useState('');

  // Practice fields
  const [availableForPractice, setAvailableForPractice] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [colDifficulty, setColDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [estimatedTime, setEstimatedTime] = useState(15);

  // Fetch practice settings
  const { data: practiceSettings } = useQuery<any>({
    queryKey: ['collection-practice-settings', collectionId],
    queryFn: () => customFetch(`/api/v1/admin/collections/${collectionId}/practice`),
    enabled: !!collectionId,
  });

  // Save practice settings mutation
  const savePracticeSettings = useMutation({
    mutationFn: (body: any) =>
      customFetch(`/api/v1/admin/collections/${collectionId}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-practice-settings', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['practice-stats'] });
    },
  });

  // Picker States (Filters & Pagination)
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSubject, setPickerSubject] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Fetch Collection Details
  const { data: collection, isLoading: isCollectionLoading } = useGetCollection(collectionId);

  // Fetch Global Questions for Picker
  const { data: globalQuestionsData, isLoading: isGlobalQuestionsLoading } = useListQuestions({
    page: pickerPage,
    limit: 15,
    search: pickerSearch || undefined,
    subjectId: pickerSubject ? parseInt(pickerSubject) : undefined,
  });

  // Fetch Subjects for Picker
  const { data: subjects } = useListSubjects();

  // Mutations
  const updateItems = useUpdateCollectionItems();
  const duplicateCol = useDuplicateCollection();
  const deleteCol = useDeleteCollection();
  const archiveCol = useArchiveCollection();
  const updateCol = useUpdateCollection();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
    queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
  };

  const handleRename = () => {
    if (!renameName.trim()) {
      toast({ title: 'Collection name is required', variant: 'destructive' });
      return;
    }

    updateCol.mutate(
      {
        id: collectionId,
        data: { name: renameName.trim(), description: renameDesc.trim() || null },
      },
      {
        onSuccess: () => {
          // Also save the practice settings
          savePracticeSettings.mutate({
            availableForPractice,
            isVisible,
            isFeatured,
            difficulty: colDifficulty,
            estimatedTimeMinutes: estimatedTime,
          });
          toast({ title: 'Collection updated successfully' });
          setEditDialogOpen(false);
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: 'Update failed', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  const handleDuplicate = () => {
    duplicateCol.mutate(
      { id: collectionId },
      {
        onSuccess: (newCol) => {
          toast({ title: 'Collection duplicated successfully' });
          invalidate();
          setLocation(`/admin/collections/${newCol.id}`);
        },
        onError: (err: any) => {
          toast({ title: 'Duplication failed', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  const handleToggleArchive = () => {
    archiveCol.mutate(
      { id: collectionId },
      {
        onSuccess: () => {
          toast({
            title: collection?.isArchived
              ? 'Collection restored from archives'
              : 'Collection moved to archives',
          });
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: 'Archive failed', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteCol.mutate(
      { id: collectionId },
      {
        onSuccess: () => {
          toast({ title: 'Collection deleted successfully' });
          invalidate();
          setLocation('/admin/repository');
        },
        onError: (err: any) => {
          toast({ title: 'Delete failed', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  // Reordering Logic
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!collection?.questions) return;
    const items = [...collection.questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap elements
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Persist new ordering
    const questionIds = items.map((q) => q.id);
    updateItems.mutate(
      { id: collectionId, data: { questionIds } },
      {
        onSuccess: () => {
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: 'Failed to reorder items', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  // Remove Question Link from Collection
  const handleRemoveQuestion = (questionId: number) => {
    if (!collection?.questions) return;
    const questionIds = collection.questions.filter((q) => q.id !== questionId).map((q) => q.id);

    updateItems.mutate(
      { id: collectionId, data: { questionIds } },
      {
        onSuccess: () => {
          toast({ title: 'Question removed from collection' });
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: 'Failed to remove question', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  // Picker Logic
  const openPicker = () => {
    setSelectedIds([]);
    setPickerPage(1);
    setPickerSearch('');
    setPickerSubject('');
    setPickerOpen(true);
  };

  const handleTogglePickerSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddSelectedQuestions = () => {
    if (!collection?.questions) return;
    const currentIds = collection.questions.map((q) => q.id);

    // Filter out potential duplicates, though backend should clean
    const uniqueNewIds = selectedIds.filter((id) => !currentIds.includes(id));
    const mergedIds = [...currentIds, ...uniqueNewIds];

    updateItems.mutate(
      { id: collectionId, data: { questionIds: mergedIds } },
      {
        onSuccess: () => {
          toast({ title: `Added ${uniqueNewIds.length} question(s) successfully` });
          setPickerOpen(false);
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: 'Failed to add questions', description: String(err.message || err), variant: 'destructive' });
        },
      }
    );
  };

  if (isCollectionLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Collection not found</h2>
        <Button asChild variant="outline">
          <Link href="/admin/repository">Back to Repository</Link>
        </Button>
      </div>
    );
  }

  const collectionQuestions = collection.questions ?? [];
  const globalQuestions = globalQuestionsData?.data ?? [];
  const totalGlobalQuestions = globalQuestionsData?.total ?? 0;
  const totalPickerPages = Math.ceil(totalGlobalQuestions / 15);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <Link href="/admin/repository" className="flex items-center gap-1.5 text-muted-foreground hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium text-sm">
            <ChevronLeft className="h-4 w-4" />
            Repository
          </Link>
        </Button>
        <span className="text-muted-foreground/45 text-sm">/</span>
        <span className="text-sm font-semibold truncate max-w-xs">{collection.name}</span>
      </div>

      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {collection.name}
            </h1>
            {collection.isArchived && (
              <Badge variant="destructive" className="px-2 py-0.5 rounded-full font-bold text-xs uppercase animate-pulse">
                Archived
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground italic">
            {collection.description || 'No description provided'}
          </p>
          <div className="text-xs text-muted-foreground flex gap-4">
            <span>Questions: <strong>{collectionQuestions.length}</strong></span>
            <span>Created: <strong>{new Date(collection.createdAt).toLocaleDateString()}</strong></span>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRenameName(collection.name);
              setRenameDesc(collection.description ?? '');
              setAvailableForPractice(practiceSettings?.availableForPractice ?? false);
              setIsVisible(practiceSettings?.isVisible ?? true);
              setIsFeatured(practiceSettings?.isFeatured ?? false);
              setColDifficulty(practiceSettings?.difficulty ?? 'medium');
              setEstimatedTime(practiceSettings?.estimatedTimeMinutes ?? 15);
              setEditDialogOpen(true);
            }}
            className="rounded-xl"
          >
            <Edit3 className="h-4 w-4 mr-2 text-slate-500" />
            Rename
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate} className="rounded-xl">
            <Copy className="h-4 w-4 mr-2 text-blue-500" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleArchive} className="rounded-xl">
            <Archive className={`h-4 w-4 mr-2 ${collection.isArchived ? 'text-emerald-500' : 'text-amber-500'}`} />
            {collection.isArchived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="rounded-xl text-destructive hover:bg-destructive/10 border-destructive/35">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button onClick={openPicker} size="sm" className="bg-primary hover:bg-primary/95 text-white rounded-xl shadow-xs">
            <Plus className="h-4 w-4 mr-2" />
            Add Questions
          </Button>
        </div>
      </div>

      {/* Questions List Card */}
      <Card className="shadow-xs border">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-lg font-bold">Questions in Collection</CardTitle>
          <Badge className="rounded-full">{collectionQuestions.length} items</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {collectionQuestions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
              <BookOpen className="h-12 w-12 text-muted-foreground/35 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No questions in collection</h3>
              <p className="text-muted-foreground max-w-sm text-sm">
                Add questions from your global Question Bank to build this collection.
              </p>
              <Button onClick={openPicker} className="rounded-xl">
                Add Questions Now
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Question Text</TableHead>
                  <TableHead>Subject / Topic</TableHead>
                  <TableHead className="w-28 text-center">Difficulty</TableHead>
                  <TableHead className="w-32 text-center">Reorder</TableHead>
                  <TableHead className="w-16 text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectionQuestions.map((q, idx) => (
                  <TableRow key={q.id} className="hover:bg-slate-50/35 dark:hover:bg-slate-800/35 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground text-sm">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-white max-w-md truncate">
                      {q.text}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">
                          {q.subjectName || 'No Subject'}
                        </span>
                        <span className="text-[10px] text-muted-foreground px-1 truncate">
                          {q.topicName || 'No Topic'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={DIFFICULTY_COLORS[q.difficulty] || 'outline'} className="capitalize px-2 rounded-full font-medium text-xs">
                        {q.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          disabled={idx === 0 || updateItems.isPending}
                          onClick={() => handleMove(idx, 'up')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          disabled={idx === collectionQuestions.length - 1 || updateItems.isPending}
                          onClick={() => handleMove(idx, 'down')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-destructive/10 rounded-lg h-8 w-8 text-destructive"
                        onClick={() => handleRemoveQuestion(q.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Questions Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl rounded-2xl h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Add Questions to Collection
            </DialogTitle>
            <DialogDescription>
              Select questions from the global Question Bank to append to this collection.
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search question text..."
                value={pickerSearch}
                onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }}
                className="pl-10 rounded-xl"
              />
            </div>
            <div>
              <select
                value={pickerSubject}
                onChange={(e) => { setPickerSubject(e.target.value); setPickerPage(1); }}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">All Subjects</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end font-semibold text-sm text-primary">
              {selectedIds.length} question(s) selected
            </div>
          </div>

          {/* Picker List View */}
          <div className="flex-1 overflow-y-auto min-h-0 py-4">
            {isGlobalQuestionsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : globalQuestions.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground p-6">
                <X className="h-10 w-10 text-muted-foreground/35 mb-2" />
                <p>No questions found matching the filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Select</TableHead>
                    <TableHead>Question Text</TableHead>
                    <TableHead className="w-32">Subject</TableHead>
                    <TableHead className="w-24 text-center">Difficulty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalQuestions.map((q) => {
                    const isSelected = selectedIds.includes(q.id);
                    const isAlreadyInCollection = collectionQuestions.some((cq) => cq.id === q.id);

                    return (
                      <TableRow
                        key={q.id}
                        onClick={() => !isAlreadyInCollection && handleTogglePickerSelect(q.id)}
                        className={`cursor-pointer transition-colors duration-100 ${
                          isAlreadyInCollection
                            ? 'opacity-45 bg-slate-50/50 dark:bg-slate-800/20 cursor-not-allowed'
                            : isSelected
                            ? 'bg-primary/5 dark:bg-primary/10'
                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected || isAlreadyInCollection}
                            disabled={isAlreadyInCollection}
                            onChange={() => handleTogglePickerSelect(q.id)}
                            className="h-4 w-4 rounded-sm border-slate-350 text-primary focus:ring-primary/45 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200 max-w-md truncate">
                          {q.text}
                        </TableCell>
                        <TableCell className="truncate font-semibold text-xs text-muted-foreground">
                          {q.subjectName || 'No Subject'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={DIFFICULTY_COLORS[q.difficulty] || 'outline'} className="capitalize text-[10px]">
                            {q.difficulty}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Picker Pagination & Footer */}
          <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 px-3"
                disabled={pickerPage === 1 || isGlobalQuestionsLoading}
                onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span className="text-xs text-muted-foreground font-semibold px-2">
                Page {pickerPage} of {totalPickerPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 px-3"
                disabled={pickerPage >= totalPickerPages || isGlobalQuestionsLoading}
                onClick={() => setPickerPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPickerOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleAddSelectedQuestions}
                disabled={selectedIds.length === 0 || updateItems.isPending}
                className="bg-primary hover:bg-primary/95 text-white rounded-xl shadow-xs"
              >
                {updateItems.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Selected ({selectedIds.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Rename Collection</DialogTitle>
            <DialogDescription>Modify properties for this Question Collection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rename-name" className="text-sm font-semibold">Name <span className="text-destructive">*</span></Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="rounded-xl"
              />
            </div>
             <div className="space-y-1.5">
              <Label htmlFor="rename-desc" className="text-sm font-semibold">Description</Label>
              <Textarea
                id="rename-desc"
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
            
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice Hub Settings</h4>
              
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Available for Practice</Label>
                  <p className="text-[10px] text-muted-foreground">Enable this collection to be practiced by students.</p>
                </div>
                <Switch checked={availableForPractice} onCheckedChange={setAvailableForPractice} />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Visibility Toggle</Label>
                  <p className="text-[10px] text-muted-foreground">Make this set visible in the student's topic list.</p>
                </div>
                <Switch checked={isVisible} onCheckedChange={setIsVisible} />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Featured Collection</Label>
                  <p className="text-[10px] text-muted-foreground">Display in the Recommended Sets list on dashboard.</p>
                </div>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Estimated Time (mins)</Label>
                  <Input
                    type="number"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 0)}
                    min={1}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Difficulty Level</Label>
                  <Select value={colDifficulty} onValueChange={(val: any) => setColDifficulty(val)}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleRename} className="bg-primary hover:bg-primary/95 text-white rounded-xl">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Alert */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-destructive">Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{collection.name}</strong>? This action is permanent and cannot be undone. This only deletes this collection linkage and order, and will NOT delete any questions from the Question Bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
