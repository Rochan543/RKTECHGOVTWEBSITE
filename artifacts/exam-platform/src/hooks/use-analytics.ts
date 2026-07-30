import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface StudentAnalytics {
  overallAccuracy: number;
  questionsAttempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  averageTimePerQuestion: number;
  practiceSessions: number;
  mockTestsAttempted: number;
  collectionsCompleted: number;
  practiceStreak: number;
  studyTime: number;
  bestSubject: string;
  weakestSubject: string;
  bestTopic: string;
  weakestTopic: string;
  difficultyPerformance: {
    easy: { attempted: number; correct: number; accuracy: number };
    medium: { attempted: number; correct: number; accuracy: number };
    hard: { attempted: number; correct: number; accuracy: number };
  };
  weeklyProgress: Array<{ week: string; attempted: number; correct: number; accuracy: number }>;
  trendData: Array<{ attempt: string; score: number; accuracy: number; date: string }>;
}

export interface AdminAnalytics {
  totalStudents: number;
  activeStudents: number;
  newStudents: number;
  questions: number;
  collections: number;
  subjects: number;
  topics: number;
  practiceSessions: number;
  mockTests: number;
  averageAccuracy: number;
  completionRate: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
}

export interface SubjectAnalytics {
  subjectId: number;
  name: string;
  accuracy: number;
  questionsAttempted: number;
  averageTime: number;
  completionPercentage: number;
  progress: number;
  collectionsCompleted: number;
}

export interface TopicAnalytics {
  topicId: number;
  name: string;
  subjectName: string;
  attemptCount: number;
  correctPercentage: number;
  wrongPercentage: number;
  skippedPercentage: number;
  averageTime: number;
  masteryPercentage: number;
}

export interface CollectionAnalytics {
  id: number;
  name: string;
  description: string | null;
  questionCount: number;
  studentsPracticed: number;
  completionRate: number;
  averageScore: number;
  averageTime: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  bookmarks: number;
  wrongAnswers: number;
}

export interface QuestionAnalyticsResponse {
  questions: Array<{
    questionId: number;
    text: string;
    attemptCount: number;
    correctPercentage: number;
    wrongPercentage: number;
    skippedPercentage: number;
    averageTime: number;
    bookmarkCount: number;
    reportCount: number;
    difficultyRating: "easy" | "medium" | "hard";
  }>;
  total: number;
}

export interface PracticeAnalytics {
  practiceSessions: number;
  averageAccuracy: number;
  dailyPractice: number;
  weeklyPractice: number;
  monthlyPractice: number;
  averageTime: number;
  bestCollection: string;
  worstCollection: string;
}

export interface ExamAnalytics {
  mockTestsAttempted: number;
  averageMarks: number;
  averageRank: number;
  averageAccuracy: number;
  averageTime: number;
  subjectBreakdown: Array<{ name: string; attempted: number; accuracy: number }>;
  topicBreakdown: Array<{ name: string; attempted: number; accuracy: number }>;
  difficultyBreakdown: Array<{ difficulty: string; attempted: number; accuracy: number }>;
}

export interface RepositoryAnalytics {
  questionsPerSubject: Array<{ subjectName: string; count: number }>;
  questionsPerTopic: Array<{ topicName: string; count: number }>;
  collectionsPerTopic: Array<{ topicName: string; count: number }>;
  importStatistics: {
    totalImports: number;
    successfulImports: number;
    parsingErrors: number;
    recentImportDate: string;
  };
  recentlyAddedQuestions: Array<{ id: number; text: string; subjectName: string; createdAt: string }>;
  recentlyUpdatedQuestions: Array<{ id: number; text: string; subjectName: string; updatedAt: string }>;
}

export interface CollectionManagementAnalytics {
  totalCollections: number;
  collectionsUsed: number;
  collectionsCompleted: number;
  averageCollectionScore: number;
  inactiveCollections: number;
  inactiveCollectionsList: string[];
  mostPopularCollections: Array<{ id: number; name: string; count: number; score: number }>;
  leastUsedCollections: Array<{ id: number; name: string; count: number; score: number }>;
}

// Helpers to build query parameters
function buildQueryString(params: Record<string, any>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      searchParams.append(key, String(val));
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : "";
}

// Hooks
export function useStudentAnalytics(filters: Record<string, any> = {}) {
  return useQuery<StudentAnalytics>({
    queryKey: ["analytics", "student", filters],
    queryFn: () => customFetch(`/api/v1/analytics/student${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useAdminAnalytics() {
  return useQuery<AdminAnalytics>({
    queryKey: ["analytics", "admin"],
    queryFn: () => customFetch("/api/v1/analytics/admin"),
    staleTime: 30000,
  });
}

export function useSubjectAnalytics(filters: Record<string, any> = {}) {
  return useQuery<SubjectAnalytics[]>({
    queryKey: ["analytics", "subjects", filters],
    queryFn: () => customFetch(`/api/v1/analytics/subjects${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useTopicAnalytics(filters: Record<string, any> = {}) {
  return useQuery<TopicAnalytics[]>({
    queryKey: ["analytics", "topics", filters],
    queryFn: () => customFetch(`/api/v1/analytics/topics${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useCollectionAnalytics(filters: Record<string, any> = {}) {
  return useQuery<CollectionAnalytics[]>({
    queryKey: ["analytics", "collections", filters],
    queryFn: () => customFetch(`/api/v1/analytics/collections${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useQuestionAnalytics(filters: Record<string, any> = {}) {
  return useQuery<QuestionAnalyticsResponse>({
    queryKey: ["analytics", "questions", filters],
    queryFn: () => customFetch(`/api/v1/analytics/questions${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function usePracticeAnalytics(filters: Record<string, any> = {}) {
  return useQuery<PracticeAnalytics>({
    queryKey: ["analytics", "practice", filters],
    queryFn: () => customFetch(`/api/v1/analytics/practice${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useExamAnalytics(filters: Record<string, any> = {}) {
  return useQuery<ExamAnalytics>({
    queryKey: ["analytics", "exams", filters],
    queryFn: () => customFetch(`/api/v1/analytics/exams${buildQueryString(filters)}`),
    staleTime: 30000,
  });
}

export function useRepositoryAnalytics() {
  return useQuery<RepositoryAnalytics>({
    queryKey: ["analytics", "repository"],
    queryFn: () => customFetch("/api/v1/analytics/repository"),
    staleTime: 30000,
  });
}

export function useCollectionManagementAnalytics() {
  return useQuery<CollectionManagementAnalytics>({
    queryKey: ["analytics", "collection-management"],
    queryFn: () => customFetch("/api/v1/analytics/collection-management"),
    staleTime: 30000,
  });
}

export function useReportQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, reason }: { questionId: number; reason: string }) =>
      customFetch(`/api/v1/questions/${questionId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, variables) => {
      // Invalidate questions query to update reportCount
      queryClient.invalidateQueries({ queryKey: ["analytics", "questions"] });
    },
  });
}
