import { useState } from 'react';
import { useListExams, getListExamsQueryKey, useListExamCategories, getListExamCategoriesQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'wouter';
import { Search, Clock, Target, Users, BookOpen, AlertCircle } from 'lucide-react';
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

  const exams = examsResponse?.data || [];
  
  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground mt-1">Simulate real exams and evaluate your preparation.</p>
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
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="all"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            All Categories
          </TabsTrigger>
          {categories?.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id.toString()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
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
              {filteredExams.map((exam) => (
                <Card key={exam.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize font-semibold tracking-wider text-[10px]">
                        {exam.type.replace('_', ' ')}
                      </Badge>
                      {exam.categoryName && (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">{exam.categoryName}</span>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2 leading-tight">{exam.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-2">{exam.description || 'No description provided.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-primary/70" />
                        {exam.durationMinutes} mins
                      </div>
                      <div className="flex items-center">
                        <Target className="mr-2 h-4 w-4 text-primary/70" />
                        {exam.totalMarks} Marks
                      </div>
                      <div className="flex items-center">
                        <BookOpen className="mr-2 h-4 w-4 text-primary/70" />
                        {exam.totalQuestions} Qs
                      </div>
                      <div className="flex items-center">
                        <Users className="mr-2 h-4 w-4 text-primary/70" />
                        {exam.attemptCount || 0} Att.
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50">
                    <Button className="w-full font-semibold" asChild>
                      <Link href={`/exams/${exam.id}`}>View Details</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No exams found</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
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
