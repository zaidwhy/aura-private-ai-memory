import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Conversation,
  ChatMessage,
  MemoryItem,
  GoalItem,
  TaskItem,
  InsightItem,
  DailyBrief,
  PrivacySettings
} from '../types';

// ==========================================
// 0. PAYLOAD HYGIENE (ZERO-UNDEFINED INTEGRITY)
// ==========================================
export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = (typeof value === 'object' && value !== null && !(value instanceof Date))
        ? stripUndefined(value)
        : value;
    }
  }
  return clean;
}

// ==========================================
// 1. CONVERSATIONS & MESSAGES
// ==========================================
export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    const colRef = collection(db, 'users', userId, 'conversations');
    const q = query(colRef, orderBy('updatedAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
  } catch (err) {
    console.error('Failed to get conversations:', err);
    return [];
  }
}

export async function createConversation(userId: string, initialTitle: string = 'New Reflection'): Promise<Conversation> {
  const colRef = collection(db, 'users', userId, 'conversations');
  const now = new Date().toISOString();
  const rawData = {
    userId,
    title: initialTitle,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  const docRef = await addDoc(colRef, stripUndefined(rawData));
  return {
    id: docRef.id,
    ...rawData,
  };
}

export async function getMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  try {
    const colRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
    const q = query(colRef, orderBy('createdAt', 'asc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
  } catch (err) {
    console.error('Failed to get messages:', err);
    return [];
  }
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: 'user' | 'model' | 'system',
  content: string,
  contextUsed?: any[]
): Promise<ChatMessage> {
  const colRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const now = new Date().toISOString();
  const docData: any = {
    conversationId,
    userId,
    role,
    content,
    createdAt: now,
  };
  if (contextUsed && contextUsed.length > 0) {
    docData.contextUsed = contextUsed;
  }
  const docRef = await addDoc(colRef, stripUndefined(docData));

  // Update conversation record
  try {
    const convRef = doc(db, 'users', userId, 'conversations', conversationId);
    await updateDoc(convRef, stripUndefined({
      updatedAt: now,
    }));
  } catch (e) {
    // Non-critical
  }

  return { id: docRef.id, ...docData };
}

// ==========================================
// 2. MEMORIES REPOSITORY
// ==========================================
export async function getMemories(userId: string): Promise<MemoryItem[]> {
  try {
    const colRef = collection(db, 'users', userId, 'memories');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MemoryItem));
  } catch (err) {
    console.error('Failed to get memories:', err);
    return [];
  }
}

export async function saveMemory(userId: string, memory: Omit<MemoryItem, 'id' | 'userId' | 'createdAt'>): Promise<MemoryItem> {
  const colRef = collection(db, 'users', userId, 'memories');
  const now = new Date().toISOString();
  const rawData = {
    ...memory,
    userId,
    createdAt: now,
    lastAccessedAt: now,
  };
  const docRef = await addDoc(colRef, stripUndefined(rawData));
  return {
    id: docRef.id,
    ...rawData,
  };
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  updates: Partial<Omit<MemoryItem, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await updateDoc(docRef, stripUndefined({
    ...updates,
    lastAccessedAt: new Date().toISOString()
  }));
}

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await deleteDoc(docRef);
}

export async function deleteAllMemories(userId: string): Promise<void> {
  const colRef = collection(db, 'users', userId, 'memories');
  const snapshot = await getDocs(colRef);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ==========================================
// 3. GOALS & TASKS
// ==========================================
export async function getGoals(userId: string): Promise<GoalItem[]> {
  try {
    const colRef = collection(db, 'users', userId, 'goals');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GoalItem));
  } catch (err) {
    console.error('Failed to get goals:', err);
    return [];
  }
}

export async function saveGoal(userId: string, goal: Omit<GoalItem, 'id' | 'userId' | 'createdAt'>): Promise<GoalItem> {
  const colRef = collection(db, 'users', userId, 'goals');
  const now = new Date().toISOString();
  const rawData = {
    ...goal,
    userId,
    createdAt: now,
  };
  const docRef = await addDoc(colRef, stripUndefined(rawData));
  return {
    id: docRef.id,
    ...rawData,
  };
}

export async function updateGoal(userId: string, goalId: string, updates: Partial<GoalItem>): Promise<void> {
  const docRef = doc(db, 'users', userId, 'goals', goalId);
  await updateDoc(docRef, stripUndefined(updates));
}

export async function updateGoalStatus(userId: string, goalId: string, status: 'active' | 'completed' | 'archived'): Promise<void> {
  const docRef = doc(db, 'users', userId, 'goals', goalId);
  await updateDoc(docRef, stripUndefined({ status }));
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'goals', goalId);
  await deleteDoc(docRef);
}

export async function getTasks(userId: string): Promise<TaskItem[]> {
  try {
    const colRef = collection(db, 'users', userId, 'tasks');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TaskItem));
  } catch (err) {
    console.error('Failed to get tasks:', err);
    return [];
  }
}

export async function saveTask(userId: string, task: Omit<TaskItem, 'id' | 'userId' | 'createdAt'>): Promise<TaskItem> {
  const colRef = collection(db, 'users', userId, 'tasks');
  const now = new Date().toISOString();
  const rawData = {
    ...task,
    userId,
    createdAt: now,
  };
  const docRef = await addDoc(colRef, stripUndefined(rawData));
  return {
    id: docRef.id,
    ...rawData,
  };
}

export async function updateTask(userId: string, taskId: string, updates: Partial<TaskItem>): Promise<void> {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  await updateDoc(docRef, stripUndefined(updates));
}

export async function toggleTaskStatus(userId: string, taskId: string, currentStatus: 'pending' | 'completed'): Promise<void> {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  await updateDoc(docRef, stripUndefined({
    status: currentStatus === 'pending' ? 'completed' : 'pending'
  }));
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(docRef);
}

// ==========================================
// 4. DAILY BRIEFS PERSISTENCE
// ==========================================
export async function getLatestDailyBrief(userId: string): Promise<DailyBrief | null> {
  try {
    const colRef = collection(db, 'users', userId, 'dailyBriefs');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as DailyBrief;
    }
  } catch (err) {
    console.error('Failed to get latest daily brief:', err);
  }
  return null;
}

export async function saveDailyBrief(
  userId: string,
  brief: Omit<DailyBrief, 'id' | 'userId'>
): Promise<DailyBrief> {
  const colRef = collection(db, 'users', userId, 'dailyBriefs');
  const rawData = {
    ...brief,
    userId,
    createdAt: brief.createdAt || new Date().toISOString(),
  };
  const docRef = await addDoc(colRef, stripUndefined(rawData));
  return {
    id: docRef.id,
    ...rawData,
  };
}

// ==========================================
// 5. PRIVACY SETTINGS
// ==========================================
export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as PrivacySettings;
    }
  } catch (err) {
    console.error('Failed to get settings:', err);
  }
  // Default privacy settings
  return {
    userId,
    memoryEnabled: true,
    personalizationEnabled: true,
    insightsEnabled: true,
    driveSyncEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<void> {
  const docRef = doc(db, 'users', userId, 'settings', 'config');
  await setDoc(docRef, stripUndefined({
    userId,
    ...settings,
    updatedAt: new Date().toISOString()
  }), { merge: true });
}
