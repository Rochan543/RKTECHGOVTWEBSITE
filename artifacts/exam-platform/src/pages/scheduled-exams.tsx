import { useState } from 'react';
import { useListExams, getListExamsQueryKey, useListResults } from '@workspace/api-client-react';
import { useServerTime, useSyncedNow, formatCountdown, formatRemainingTime, formatExamDateTime } from '@/hooks/use-server-time';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Clock, Calendar, AlertCircle, Play, CheckCircle2, Lock } from 'lucide-react';

export default function ScheduledExams() {
  const { data: serverTime } = useServerTime();
  const now = useSyncedNow(serverTime);

  const { data: examsResponse, isLoading: examsLoading } = useListExams(
    { status: 'published', limit: 100 },
    { query: { queryKey: getListExamsQueryKey({ status: 'published', limit: 100 }) } }
  );

  const { data: resultsResponse, isLoading: resultsLoading } = useListResults({ limit: 100 });

  const exams = examsResponse?.data || [];
  const results = resultsResponse?.data || [];

  // Filter to include only exams that have scheduledAt set
  const scheduledExams = exams.filter(e => e.scheduledAt !== null && e.scheduledAt !== undefined);

  // Group exams by their current live schedule state
  const upcomingExams = [];
  const liveExams = [];
  const completedExams = [];

  for (const exam of scheduledExams) {
    const startMs = new Date(exam.scheduledAt!).getTime();
    if (Number.isNaN(startMs)) {
      continue;
    }
    const endMs = exam.endsAt ? new Date(exam.endsAt).getTime() : Infinity;

    if (now < startMs) {
      upcomingExams.push(exam);
    } else if (now >= startMs && now <= endMs) {
      liveExams.push(exam);
    } else {
      completedExams.push(exam);
    }
  }

  const isLoading = examsLoading || resultsLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Scheduled Exams</h1>
        <p className="text-muted-foreground mt-1 text-sm">Attend live board mock tests and scheduled examination sessions.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-muted/40 animate-pulse border border-slate-200/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Section 1: Live Exams */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-lg font-bold text-foreground">Live Exams</h2>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold ml-1 text-[10px]">
                {liveExams.length} Active
              </Badge>
            </div>

            {liveExams.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {liveExams.map(exam => {
                  const endsMs = exam.endsAt ? new Date(exam.endsAt).getTime() : 0;
                  const remainingSeconds = Math.max(0, Math.floor((endsMs - now) / 1000));

                  return (
                    <Card key={exam.id} className="flex flex-col border-emerald-500/30 hover:border-emerald-500/60 transition-all duration-300 shadow-md hover:shadow-lg bg-card relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 capitalize font-bold text-[9px] tracking-wider">
                            {exam.type.replace('_', ' ')}
                          </Badge>
                          <Badge className="bg-emerald-500 text-white font-extrabold text-[9px] uppercase animate-pulse">
                            Exam Live
                          </Badge>
                        </div>
                        <CardTitle className="line-clamp-2 leading-snug font-bold text-base text-foreground">{exam.title}</CardTitle>
                      </CardHeader>

                      <CardContent className="flex-1 space-y-4">
                        <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Remaining Time</span>
                          <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {formatRemainingTime(remainingSeconds)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center"><Clock className="mr-2 h-4 w-4" /> {exam.durationMinutes} mins</span>
                          <span className="flex items-center"><AlertCircle className="mr-2 h-4 w-4" /> {exam.totalQuestions} Questions</span>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-border/50">
                        <Button className="w-full font-bold h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md" asChild>
                          <Link href={`/exams/${exam.id}`}>
                            <Play className="mr-2 h-4 w-4 fill-white" /> Start Exam
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center border rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-muted-foreground">
                <AlertCircle className="mx-auto h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm font-medium">No live exams at the moment.</p>
              </div>
            )}
          </section>

          {/* Section 2: Upcoming Exams */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-foreground">Upcoming Exams</h2>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold ml-1 text-[10px]">
                {upcomingExams.length} Scheduled
              </Badge>
            </div>

            {upcomingExams.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingExams.map(exam => {
                  const startMs = new Date(exam.scheduledAt!).getTime();
                  const diff = Math.max(0, startMs - now);
                  const countdown = formatCountdown(diff);
                  const { dateStr, timeStr } = formatExamDateTime(exam.scheduledAt);

                  return (
                    <Card key={exam.id} className="flex flex-col border border-indigo-100 dark:border-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-900 transition-all duration-300 shadow-sm hover:shadow-md bg-card relative">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 capitalize font-bold text-[9px] tracking-wider">
                            {exam.type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="secondary" className="font-bold text-[9px] uppercase bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            Scheduled
                          </Badge>
                        </div>
                        <CardTitle className="line-clamp-2 leading-snug font-bold text-base text-foreground">{exam.title}</CardTitle>
                        <CardDescription className="line-clamp-1 mt-1 text-xs text-muted-foreground">{exam.description || 'No description provided.'}</CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 space-y-4">
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-50/50 dark:border-indigo-950/20 rounded-xl p-3.5 flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Starts In</span>
                          <div className="flex gap-2.5 text-center">
                            <div>
                              <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 block leading-none">{countdown.days}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase mt-1 block">Days</span>
                            </div>
                            <span className="text-indigo-400 font-bold">:</span>
                            <div>
                              <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 block leading-none">{countdown.hours}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase mt-1 block">Hours</span>
                            </div>
                            <span className="text-indigo-400 font-bold">:</span>
                            <div>
                              <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 block leading-none">{countdown.minutes}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase mt-1 block">Mins</span>
                            </div>
                            <span className="text-indigo-400 font-bold">:</span>
                            <div>
                              <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 block leading-none">{countdown.seconds}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase mt-1 block">Secs</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs text-muted-foreground font-medium border-t pt-3">
                          <div className="flex justify-between">
                            <span>Scheduled Date:</span>
                            <span className="font-bold text-foreground">{dateStr}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Start Time:</span>
                            <span className="font-bold text-foreground">{timeStr}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Duration:</span>
                            <span className="font-bold text-foreground">{exam.durationMinutes} minutes</span>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-border/50 bg-slate-50/40 dark:bg-slate-900/10">
                        <Button className="w-full font-bold h-10 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-0 hover:bg-slate-100" disabled>
                          <Lock className="mr-2 h-4 w-4" /> Not Yet Available
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center border rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-muted-foreground">
                <Calendar className="mx-auto h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm font-medium">No upcoming scheduled exams.</p>
              </div>
            )}
          </section>

          {/* Section 3: Completed Exams */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <CheckCircle2 className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-foreground">Completed Exams</h2>
              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-bold ml-1 text-[10px]">
                {completedExams.length} Closed
              </Badge>
            </div>

            {completedExams.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {completedExams.map(exam => {
                  const attempt = results.find(r => r.examId === exam.id);
                  const { dateStr, timeStr } = formatExamDateTime(exam.scheduledAt);

                  return (
                    <Card key={exam.id} className="flex flex-col border border-slate-100 dark:border-slate-800 bg-card/65 opacity-90">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 capitalize font-bold text-[9px] tracking-wider">
                            {exam.type.replace('_', ' ')}
                          </Badge>
                          {attempt ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[9px] uppercase">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 dark:bg-slate-800 font-bold text-[9px] uppercase">
                              Closed
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="line-clamp-2 leading-snug font-bold text-base text-foreground/80">{exam.title}</CardTitle>
                      </CardHeader>

                      <CardContent className="flex-1 space-y-3 text-xs text-muted-foreground font-medium">
                        <div className="flex justify-between">
                          <span>Held On:</span>
                          <span className="font-semibold text-foreground">{dateStr} at {timeStr}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Questions:</span>
                          <span className="font-semibold text-foreground">{exam.totalQuestions} Qs</span>
                        </div>
                        {attempt && (
                          <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 flex items-center justify-between mt-3">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Your Score:</span>
                            <span className="font-black text-foreground">{attempt.score} / {attempt.totalMarks}</span>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-border/50 bg-slate-50/10">
                        {attempt ? (
                          <Button className="w-full font-bold h-9 bg-primary hover:bg-primary/95 text-primary-foreground" asChild>
                            <Link href={`/results/${attempt.id}`}>
                              View Result
                            </Link>
                          </Button>
                        ) : (
                          <Button className="w-full font-bold h-9 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default" variant="ghost" disabled>
                            Exam Finished
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center border rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-muted-foreground">
                <CheckCircle2 className="mx-auto h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm font-medium">No completed scheduled exams found.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
