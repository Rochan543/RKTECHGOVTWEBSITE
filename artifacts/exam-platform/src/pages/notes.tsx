import { useListNotes, getListNotesQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, FileImage, FileCode2, Video, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function Notes() {
  const [search, setSearch] = useState('');
  
  const { data: notesResp, isLoading } = useListNotes({ limit: 50 }, {
    query: { queryKey: getListNotesQueryKey({ limit: 50 }) }
  });

  const notes = notesResp?.data || [];
  const filtered = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.subjectName?.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    switch(type) {
      case 'pdf': return <FileText className="h-8 w-8 text-red-500" />;
      case 'image': return <FileImage className="h-8 w-8 text-blue-500" />;
      case 'video': return <Video className="h-8 w-8 text-purple-500" />;
      default: return <FileCode2 className="h-8 w-8 text-slate-500" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Material</h1>
          <p className="text-muted-foreground mt-1">Download PDFs, notes, and previous year papers.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search resources..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(note => (
            <Card key={note.id} className="hover:shadow-md transition-shadow group flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-start gap-4">
                <div className="p-2 bg-muted/50 rounded-lg shrink-0">
                  {getIcon(note.type)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <CardTitle className="text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {note.title}
                  </CardTitle>
                  {note.subjectName && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{note.subjectName}</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 mt-auto">
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                    {formatSize(note.size)}
                  </span>
                  <Button size="sm" variant="secondary" className="gap-2" asChild>
                    <a href={note.fileUrl} target="_blank" rel="noreferrer" download>
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <FileText className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No resources found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your search query.</p>
        </div>
      )}
    </div>
  );
}
