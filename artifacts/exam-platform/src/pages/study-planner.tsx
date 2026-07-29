import { useState } from 'react';
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
import { getCookie, setCookie } from '@/lib/utils';

type Priority = 'high' | 'medium' | 'low';
type Category = 'Quantitative' | 'Reasoning' | 'English' | 'General Awareness' | 'Computer' | 'Custom';

interface StudyTask {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  durationMinutes: number;
  completed: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

const STORAGE_KEY = 'ssc-study-planner-tasks';

function loadTasks(): StudyTask[] {
  try {
    const saved = getCookie(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: StudyTask[]) {
  setCookie(STORAGE_KEY, JSON.stringify(tasks));
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const CATEGORY_COLORS: Record<Category, string> = {
  Quantitative: 'bg-blue-100 text-blue-700',
  Reasoning: 'bg-purple-100 text-purple-700',
  English: 'bg-green-100 text-green-700',
  'General Awareness': 'bg-orange-100 text-orange-700',
  Computer: 'bg-cyan-100 text-cyan-700',
  Custom: 'bg-gray-100 text-gray-700',
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
  const [tasks, setTasks] = useState<StudyTask[]>(loadTasks);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Quantitative' as Category,
    priority: 'medium' as Priority,
    durationMinutes: 60,
  });

  const weekDates = getWeekDates();
  const todayISO = new Date().toISOString().split('T')[0];

  const dayTasks = tasks.filter(t => t.date === selectedDate).sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority] - pri[b.priority];
  });

  const completedToday = dayTasks.filter(t => t.completed).length;
  const totalMinutesToday = dayTasks.reduce((s, t) => s + t.durationMinutes, 0);
  const completedMinutesToday = dayTasks.filter(t => t.completed).reduce((s, t) => s + t.durationMinutes, 0);

  const updateTasks = (updated: StudyTask[]) => {
    setTasks(updated);
    saveTasks(updated);
  };

  const addTask = () => {
    if (!form.title.trim()) {
      toast({ title: 'Please enter a task title', variant: 'destructive' });
      return;
    }
    const newTask: StudyTask = {
      id: Math.random().toString(36).slice(2),
      ...form,
      completed: false,
      date: selectedDate,
      createdAt: Date.now(),
    };
    updateTasks([...tasks, newTask]);
    setForm({ title: '', description: '', category: 'Quantitative', priority: 'medium', durationMinutes: 60 });
    setShowAdd(false);
    toast({ title: 'Study task added!' });
  };

  const toggleTask = (id: string) => {
    updateTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    updateTasks(tasks.filter(t => t.id !== id));
  };

  // Weekly overview
  const weeklyStats = weekDates.map(({ date, label, dayName }) => {
    const dayT = tasks.filter(t => t.date === date);
    return {
      date, label, dayName,
      total: dayT.length,
      completed: dayT.filter(t => t.completed).length,
      isToday: date === todayISO,
      isSelected: date === selectedDate,
    };
  });

  const overallCompleted = tasks.filter(t => t.completed).length;
  const overallTotal = tasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Study Planner
          </h1>
          <p className="text-muted-foreground mt-1">Plan and track your daily study sessions</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">This Week</span></div>
            <p className="text-2xl font-bold">{weeklyStats.reduce((s,d)=>s+d.total,0)}</p>
            <p className="text-xs text-muted-foreground">tasks planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Completed</span></div>
            <p className="text-2xl font-bold">{overallCompleted}</p>
            <p className="text-xs text-muted-foreground">of {overallTotal} tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Today</span></div>
            <p className="text-2xl font-bold">{completedMinutesToday}m</p>
            <p className="text-xs text-muted-foreground">of {totalMinutesToday}m planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-yellow-500" /><span className="text-xs text-muted-foreground">Completion</span></div>
            <p className="text-2xl font-bold">{overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">overall rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Week Calendar */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1">
            {weeklyStats.map(({ date, label, dayName, total, completed, isToday, isSelected }) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors text-center ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="text-xs font-medium">{dayName}</span>
                <span className="text-sm font-bold mt-0.5">{label.split(' ')[1]}</span>
                {total > 0 && (
                  <div className={`text-xs mt-1 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {completed}/{total}
                  </div>
                )}
                {total > 0 && (
                  <div className={`w-4 h-1 rounded-full mt-1 ${
                    completed === total ? 'bg-green-500' : isSelected ? 'bg-primary-foreground/30' : 'bg-muted-foreground/30'
                  }`} />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Day Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {selectedDate === todayISO ? "Today's Tasks" : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {dayTasks.length > 0 && (
            <div className="flex items-center gap-3">
              <Progress value={dayTasks.length > 0 ? (completedToday / dayTasks.length) * 100 : 0} className="w-24 h-2" />
              <span className="text-sm text-muted-foreground">{completedToday}/{dayTasks.length}</span>
            </div>
          )}
        </div>

        {dayTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No tasks planned for this day.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add a Study Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {dayTasks.map(task => (
              <Card key={task.id} className={`transition-opacity ${task.completed ? 'opacity-60' : ''}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleTask(task.id)} className="mt-0.5 flex-shrink-0">
                      {task.completed
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <Circle className="h-5 w-5 text-muted-foreground" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </p>
                        <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[task.category]}`}>
                          {task.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{task.durationMinutes}m
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                      )}
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Study Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                placeholder="e.g. Practice Quantitative Aptitude"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                placeholder="What will you study?"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as Category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Quantitative','Reasoning','English','General Awareness','Computer','Custom'] as Category[]).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addTask}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
