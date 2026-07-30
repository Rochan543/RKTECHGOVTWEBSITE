import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Plus, CheckCircle2, Circle, Trash2, Target, Clock, BookOpen, Trophy } from 'lucide-react';
import { 
  useGetStudyTasks, 
  getGetStudyTasksQueryKey,
  useCreateStudyTask, 
  useUpdateStudyTask, 
  useDeleteStudyTask,
  customFetch
} from '@workspace/api-client-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';

type Priority = 'high' | 'medium' | 'low';
type Category = 'Quantitative' | 'Reasoning' | 'English' | 'General Awareness' | 'Computer' | 'Custom';

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/20',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/20',
  low: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/20',
};

const CATEGORY_COLORS: Record<Category, string> = {
  Quantitative: 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400',
  Reasoning: 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
  English: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400',
  'General Awareness': 'bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
  Computer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400',
  Custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

function getWeekDates(): { date: string; label: string; dayName: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // Monday

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en', { weekday: 'short' });
    const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return { date: iso, label, dayName };
  });
}

export default function StudyPlanner() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Quantitative' as Category,
    priority: 'medium' as Priority,
    durationMinutes: 60,
  });

  const weekDates = getWeekDates();
  const todayISO = new Date().toISOString().split('T')[0];

  // Fetch planner tasks from DB
  const { data: dbTasks = [], isLoading: tasksLoading } = useGetStudyTasks({
    query: { queryKey: getGetStudyTasksQueryKey() }
  });

  // Fetch today's study plan (adaptive tasks)
  const { data: studyPlan } = useQuery<any>({
    queryKey: ['adaptive', 'study-plan', selectedDate],
    queryFn: () => customFetch(`/api/v1/adaptive/study-plan?date=${selectedDate}`),
  });

  // Task Mutations
  const createTaskMutation = useCreateStudyTask({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Task added successfully!' });
        queryClient.invalidateQueries({ queryKey: getGetStudyTasksQueryKey() });
        setShowAdd(false);
        setForm({ title: '', description: '', category: 'Quantitative', priority: 'medium', durationMinutes: 60 });
      }
    }
  });

  const updateTaskMutation = useUpdateStudyTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStudyTasksQueryKey() });
      }
    }
  });

  const deleteTaskMutation = useDeleteStudyTask({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Task deleted' });
        queryClient.invalidateQueries({ queryKey: getGetStudyTasksQueryKey() });
      }
    }
  });

  const dayTasks = dbTasks.filter((t: any) => t.date === selectedDate).sort((a: any, b: any) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority as Priority] - pri[b.priority as Priority];
  });

  const completedToday = dayTasks.filter((t: any) => t.completed).length;
  const totalMinutesToday = dayTasks.reduce((s: number, t: any) => s + t.durationMinutes, 0);
  const completedMinutesToday = dayTasks.filter((t: any) => t.completed).reduce((s: number, t: any) => s + t.durationMinutes, 0);

  const handleAddTask = () => {
    if (!form.title.trim()) {
      toast({ title: 'Please enter a task title', variant: 'destructive' });
      return;
    }
    createTaskMutation.mutate({
      data: {
        ...form,
        date: selectedDate,
      }
    });
  };

  const handleToggleTask = (task: any) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        completed: !task.completed,
      }
    });
  };

  const handleDeleteTask = (id: number) => {
    deleteTaskMutation.mutate({ id });
  };

  // Weekly overview
  const weeklyStats = weekDates.map(({ date, label, dayName }) => {
    const dayT = dbTasks.filter((t: any) => t.date === date);
    return {
      date, label, dayName,
      total: dayT.length,
      completed: dayT.filter((t: any) => t.completed).length,
      isToday: date === todayISO,
      isSelected: date === selectedDate,
    };
  });

  const overallCompleted = dbTasks.filter((t: any) => t.completed).length;
  const overallTotal = dbTasks.length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-indigo-500" />
            Study Planner
          </h1>
          <p className="text-muted-foreground mt-1">Plan and track your daily study sessions. Everything saved in database.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-indigo-500" /><span className="text-xs text-muted-foreground font-semibold">This Week</span></div>
            <p className="text-2xl font-bold">{weeklyStats.reduce((s,d)=>s+d.total,0)}</p>
            <p className="text-xs text-muted-foreground">tasks planned</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground font-semibold">Completed</span></div>
            <p className="text-2xl font-bold">{overallCompleted}</p>
            <p className="text-xs text-muted-foreground">of {overallTotal} tasks</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground font-semibold">Today</span></div>
            <p className="text-2xl font-bold">{completedMinutesToday}m</p>
            <p className="text-xs text-muted-foreground">of {totalMinutesToday}m planned</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-yellow-500" /><span className="text-xs text-muted-foreground font-semibold">Completion</span></div>
            <p className="text-2xl font-bold">{overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">overall rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Week Calendar */}
      <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-2">
            {weeklyStats.map(({ date, label, dayName, total, completed, isToday, isSelected }) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`p-3 rounded-2xl flex flex-col items-center justify-between border transition-all ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                    : isToday
                      ? 'border-indigo-200 bg-indigo-50/30 text-indigo-950 dark:border-indigo-900/30 dark:bg-indigo-950/20'
                      : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{dayName}</span>
                <span className="text-sm font-extrabold my-1">{label.split(' ')[1]}</span>
                
                {total > 0 ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {completed}/{total}
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Active Study Plan (From Adaptive Learning Engine) */}
        <Card className="border-indigo-100/50 dark:border-indigo-950/30 shadow-sm bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/5">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              Adaptive Study Plan
            </CardTitle>
            <CardDescription className="text-xs">Auto-generated recommendations by the AI engine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {studyPlan && studyPlan.tasks && (studyPlan.tasks as any[]).length > 0 ? (
              (studyPlan.tasks as any[]).map((task: any, idx: number) => (
                <div key={idx} className="p-3 bg-card border border-indigo-100/50 dark:border-indigo-950/40 rounded-xl">
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] uppercase tracking-wider font-semibold rounded-lg">
                      {task.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center font-bold"><Clock className="h-3.5 w-3.5 mr-1" /> {task.estimatedTimeMinutes}m</span>
                  </div>
                  <h4 className="text-xs font-bold leading-tight">{task.entityName || "Adaptive Session"}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">Target accuracy: {task.targetAccuracy}%</p>
                </div>
              ))
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No adaptive tasks found for today. Complete diagnostic mock tests to trigger recommendations.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks List */}
        <Card className="md:col-span-2 border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Planned Tasks for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</CardTitle>
            <CardDescription className="text-xs">Check off tasks once completed to claim XP rewards</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pt-2 space-y-3">
            {tasksLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : dayTasks.length > 0 ? (
              <div className="grid gap-3">
                {dayTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between p-4 rounded-xl border transition-all duration-300 ${
                      task.completed
                        ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200/40 text-slate-400 line-through dark:text-slate-500'
                        : 'bg-card border-slate-200/60 dark:border-slate-800 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleTask(task)}
                        className="mt-0.5 text-muted-foreground hover:text-indigo-600 transition-colors"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-50" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-bold text-xs leading-none text-foreground">{task.title}</h4>
                        {task.description && (
                          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-lg ${CATEGORY_COLORS[task.category as Category]}`}>
                            {task.category}
                          </span>
                          <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded-lg uppercase tracking-wider ${PRIORITY_COLORS[task.priority as Priority]}`}>
                            {task.priority}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex items-center font-bold">
                            <Clock className="h-3 w-3 mr-1" />
                            {task.durationMinutes} mins
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTask(task.id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-16 text-center">
                <BookOpen className="h-12 w-12 mb-4 opacity-25" />
                <p className="text-sm font-semibold">No study tasks planned</p>
                <p className="text-[10px] text-muted-foreground mt-1">Add Quantitative practice, English reading, or Mock test reminders.</p>
                <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4 h-8 text-xs font-bold rounded-lg">
                  Add First Task
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Study Task</DialogTitle>
            <CardDescription className="text-xs">Create a manual reminder or study task for this day.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Task Title</span>
              <Input
                placeholder="e.g. Practice Algebra PYQs"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Description</span>
              <Textarea
                placeholder="Details or specific notes..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Subject/Category</span>
                <Select
                  value={form.category}
                  onValueChange={v => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Quantitative">Quantitative</SelectItem>
                    <SelectItem value="Reasoning">Reasoning</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="General Awareness">General Awareness</SelectItem>
                    <SelectItem value="Computer">Computer</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Priority</span>
                <Select
                  value={form.priority}
                  onValueChange={v => setForm({ ...form, priority: v as Priority })}
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Duration (Minutes)</span>
              <Input
                type="number"
                value={form.durationMinutes}
                onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl h-10 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={handleAddTask} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 text-xs font-bold shadow-md">
              Save Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
