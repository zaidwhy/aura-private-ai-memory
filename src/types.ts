/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemoryCategory = 'goal' | 'preference' | 'project' | 'important_fact' | 'recurring_theme';

export interface MemoryItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: MemoryCategory;
  importance: number; // 0.0 to 1.0
  sourceConversationId?: string;
  createdAt: string; // ISO string
  lastAccessedAt?: string;
}

export interface ContextCitation {
  id: string;
  title: string;
  category: MemoryCategory;
  contentSnippet: string;
  reason: string;
  score?: number;
  matchedTerms?: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'model' | 'system';
  content: string;
  createdAt: string;
  contextUsed?: ContextCitation[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary?: {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    importantPoints: string[];
  };
}

export interface GoalItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  targetDate?: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  userId: string;
  goalId?: string;
  title: string;
  status: 'pending' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
}

export interface InsightItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface DailyBrief {
  id: string;
  userId: string;
  date: string;
  recentSummary: string;
  focusRecommendation: string;
  pendingTasksCount: number;
  activeGoalsCount: number;
  keyPatterns: string[];
  suggestedActions?: string[];
  modelUsed?: string;
  createdAt: string;
}

export interface PrivacySettings {
  userId: string;
  memoryEnabled: boolean;
  personalizationEnabled: boolean;
  insightsEnabled: boolean;
  driveSyncEnabled: boolean;
  retentionPeriodDays?: number; // 0 = indefinite/forever, 30, 60, 90, 180
  mutedCategories?: MemoryCategory[]; // Categories excluded from automatic memory capture
  updatedAt: string;
}

export interface DriveSyncStatus {
  lastSyncedAt?: string;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
}
