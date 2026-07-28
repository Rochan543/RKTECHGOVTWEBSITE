import { useListNotes, useListSubjects } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Download, BookOpen, Clock, ExternalLink, Newspaper } from 'lucide-react';
import { useState } from 'react';

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
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const { data: notes, isLoading } = useListNotes({ page: 1, limit: 100 });
  const { data: subjects } = useListSubjects();

  const allNotes = notes?.data ?? [];

  const filtered = allNotes.filter((note) => {
    const matchSearch = note.title.toLowerCase().includes(search.toLowerCase()) ||
      (note.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === 'all' || String(note.subjectId) === subjectFilter;
    return matchSearch && matchSubject;
  });

  // Group by date
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="h-8 w-8 opacity-80" />
          <div>
            <h1 className="text-2xl font-bold">Daily GK & Current Affairs</h1>
            <p className="text-indigo-200 text-sm">{today}</p>
          </div>
        </div>
        <p className="text-indigo-100 text-sm mt-2">Stay ahead with daily updates on current affairs, static GK, and study materials.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search study materials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-48">
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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">No materials found</h3>
            <p className="text-sm text-muted-foreground mt-1">New content is added regularly. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{filtered.length} resource{filtered.length !== 1 ? 's' : ''} available</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((note) => (
              <Card key={note.id} className="group hover:shadow-md transition-all">
                <CardContent className="p-5">
                  {note.thumbnailUrl ? (
                    <img src={note.thumbnailUrl} alt={note.title} className="w-full h-28 object-cover rounded-lg mb-3" />
                  ) : (
                    <div className="w-full h-28 bg-gradient-to-br from-muted to-muted/50 rounded-lg mb-3 flex items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">{note.title}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 ${typeColor[note.type] ?? ''}`}>
                      {note.type}
                    </span>
                  </div>
                  {note.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{note.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {note.size > 0 && <span>{formatBytes(note.size)}</span>}
                      {note.downloadCount !== null && note.downloadCount !== undefined && (
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" />{note.downloadCount}</span>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
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
    </div>
  );
}
