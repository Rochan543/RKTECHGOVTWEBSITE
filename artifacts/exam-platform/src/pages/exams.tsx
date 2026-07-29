import { useState } from 'react';
import { useListExams, getListExamsQueryKey, useListExamCategories, getListExamCategoriesQueryKey, useListResults } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'wouter';
import { Search, Clock, Target, Users, BookOpen, AlertCircle, Award, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Exams() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: categories } = useListExamCategories({
    query: { queryKey: getListExamCategoriesQueryKey() }
  });

  const { data: examsResponse, isLoading } = useListExams({
    categoryId: activeTab !== 'all' ? parseInt(activeTab) : undefined,
    type: typeFilter !== 'all' ? typeFilter as any : undefined,
    status: 'published',
    limit: 50
  }, {
    query: { 
      queryKey: getListExamsQueryKey({ 
        categoryId: activeTab !== 'all' ? parseInt(activeTab) : undefined,
        type: typeFilter !== 'all' ? typeFilter as any : undefined,
        status: 'published',
        limit: 50
      }) 
    }
  });

  const { data: resultsResponse } = useListResults({ limit: 100 });

  const exams = examsResponse?.data || [];
  const results = resultsResponse?.data || [];
  
  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Test Series</h1>
          <p className="text-muted-foreground mt-1 text-sm">Simulate real exams and evaluate your preparation.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tests..."
              className="pl-8 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_mock">Full Mock</SelectItem>
              <SelectItem value="mini_mock">Mini Mock</SelectItem>
              <SelectItem value="sectional">Sectional</SelectItem>
              <SelectItem value="topic_test">Topic Test</SelectItem>
              <SelectItem value="pyq">Previous Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0 h-auto gap-2">
          <TabsTrigger 
            value="all"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-semibold text-sm"
          >
            All Categories
          </TabsTrigger>
          {categories?.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id.toString()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-semibold text-sm"
            >
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="pt-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : filteredExams.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredExams.map((exam) => {
                const lastAttempt = results.find(r => r.examId === exam.id);
                return (
                  <Card key={exam.id} className="flex flex-col hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md bg-card">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start gap-4 mb-2.5">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize font-bold tracking-wider text-[10px]">
                          {exam.type.replace('_', ' ')}
                        </Badge>
                        {lastAttempt ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 font-bold flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Completed
                          </Badge>
                        ) : exam.attemptCount && exam.attemptCount > 0 ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] py-0 font-bold">
                            Attempted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/25 text-[10px] py-0 font-bold">
                            New Test
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="line-clamp-2 leading-snug font-bold text-base text-foreground">{exam.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1.5 text-xs text-muted-foreground">{exam.description || 'No description provided.'}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-1">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4 text-muted-foreground/70" />
                          {exam.durationMinutes} mins
                        </div>
                        <div className="flex items-center">
                          <Target className="mr-2 h-4 w-4 text-muted-foreground/70" />
                          {exam.totalMarks} Marks
                        </div>
                        <div className="flex items-center">
                          <BookOpen className="mr-2 h-4 w-4 text-muted-foreground/70" />
                          {exam.totalQuestions} Qs
                        </div>
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4 text-muted-foreground/70" />
                          {exam.attemptCount || 0} Attempts
                        </div>
                      </div>

                      {/* Display Score Details if Attempted */}
                      {lastAttempt && (
                        <div className="mt-4 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span>Your Score:</span>
                          </div>
                          <span className="font-bold text-foreground">{lastAttempt.score} / {lastAttempt.totalMarks} ({Math.round(lastAttempt.accuracy * 100)}% Acc.)</span>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-4 border-t border-border/50">
                      <Button className="w-full font-bold h-9 bg-primary hover:bg-primary/95 text-primary-foreground" asChild>
                        <Link href={`/exams/${exam.id}`}>
                          {lastAttempt ? 'Retake Exam' : 'View Details'}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No exams found</h3>
              <p className="text-muted-foreground max-w-sm mt-1 text-sm">
                We couldn't find any tests matching your filters. Try clearing your search or selecting a different category.
              </p>
              {(searchTerm !== '' || typeFilter !== 'all') && (
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
