import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Lock,
  Plus,
  Trash2,
  LogOut,
  RefreshCw,
  MessageSquare,
  Compass,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { auth, signInWithGoogle, logOut, getVerifiedToken } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  getConversations,
  createConversation,
  getMessages,
  saveMessage,
  getMemories,
  saveMemory,
  updateMemory,
  deleteMemory,
  deleteAllMemories,
  getGoals,
  saveGoal,
  updateGoal,
  updateGoalStatus,
  deleteGoal,
  getTasks,
  saveTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
  getLatestDailyBrief,
  saveDailyBrief,
  getPrivacySettings,
  updatePrivacySettings
} from './lib/firestoreService';
import type {
  Conversation,
  ChatMessage,
  MemoryItem,
  GoalItem,
  TaskItem,
  DailyBrief,
  PrivacySettings
} from './types';
import { SecurityBadge } from './components/SecurityBadge';
import { ExplainableMemory } from './components/ExplainableMemory';
import { DailyBriefCard } from './components/DailyBriefCard';
import { MemoryGraph } from './components/MemoryGraph';
import { PrivacyCenter } from './components/PrivacyCenter';
import { GoalsAndTasksPanel } from './components/GoalsAndTasksPanel';
import { MemoryManager } from './components/MemoryManager';
import { retrieveRelevantMemories, sanitizeMemoryForContext } from './lib/memoryRetriever';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Conversations & Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Memory, Goals & Tasks
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settings, setSettings] = useState<PrivacySettings>({
    userId: '',
    memoryEnabled: true,
    personalizationEnabled: true,
    insightsEnabled: true,
    driveSyncEnabled: false,
    updatedAt: new Date().toISOString()
  });

  // Daily Brief
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Active View Tab
  const [activeView, setActiveView] = useState<'chat' | 'memories' | 'brief' | 'graph' | 'goals' | 'privacy'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        await loadUserData(currentUser.uid);
      } else {
        // Reset state on signout
        setConversations([]);
        setCurrentConvId(null);
        setMessages([]);
        setMemories([]);
        setGoals([]);
        setTasks([]);
        setDailyBrief(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeView]);

  // Load all user isolated data from Firestore
  const loadUserData = async (uid: string) => {
    try {
      const [convs, mems, gList, tList, userSettings, latestBrief] = await Promise.all([
        getConversations(uid),
        getMemories(uid),
        getGoals(uid),
        getTasks(uid),
        getPrivacySettings(uid),
        getLatestDailyBrief(uid)
      ]);
      setConversations(convs);
      setMemories(mems);
      setGoals(gList);
      setTasks(tList);
      setSettings(userSettings);
      if (latestBrief) {
        setDailyBrief(latestBrief);
      }

      if (convs.length > 0) {
        setCurrentConvId(convs[0].id);
        const msgs = await getMessages(uid, convs[0].id);
        setMessages(msgs);
      } else {
        // Initialize first conversation
        const newConv = await createConversation(uid, 'Initial Reflection');
        setConversations([newConv]);
        setCurrentConvId(newConv.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load user records:', err);
    }
  };

  // Switch conversation
  const handleSelectConversation = async (convId: string) => {
    if (!user) return;
    setCurrentConvId(convId);
    setChatError(null);
    const msgs = await getMessages(user.uid, convId);
    setMessages(msgs);
  };

  // New conversation
  const handleNewConversation = async () => {
    if (!user) return;
    try {
      const newConv = await createConversation(user.uid, `Reflection ${conversations.length + 1}`);
      setConversations([newConv, ...conversations]);
      setCurrentConvId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Send message to Gemini via protected Cloud Run backend
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputMessage.trim() || isSending || !currentConvId) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);
    setChatError(null);

    // 1. Optimistic UI and Firestore persist user turn
    let savedUserMsg: ChatMessage;
    try {
      savedUserMsg = await saveMessage(user.uid, currentConvId, 'user', userText);
      setMessages((prev) => [...prev, savedUserMsg]);
    } catch (err: any) {
      console.error('Failed to save user message:', err);
      setChatError('Failed to save message to secure database. Input preserved.');
      setInputMessage(userText);
      setIsSending(false);
      return;
    }

    // 2. Call backend /api/chat with verified Firebase ID token
    try {
      const token = await getVerifiedToken();
      if (!token) throw new Error('Firebase ID Token missing or expired. Please sign in again.');

      // Select ranked and sanitized memories for context retrieval (OWASP LLM01 hardened)
      let candidateMemories: any[] = [];
      if (settings.personalizationEnabled && settings.memoryEnabled) {
        // Filter out expired memories if retention policy is set
        let eligibleMemories = memories;
        if (settings.retentionPeriodDays && settings.retentionPeriodDays > 0) {
          const cutoffTime = Date.now() - settings.retentionPeriodDays * 24 * 60 * 60 * 1000;
          eligibleMemories = eligibleMemories.filter((m) => new Date(m.createdAt).getTime() >= cutoffTime);
        }

        const retrieved = retrieveRelevantMemories(userText, eligibleMemories, {
          maxK: 5,
          threshold: 0.1,
          fallbackToTopSalient: true
        });
        candidateMemories = retrieved.map(r => ({
          id: r.memory.id,
          title: r.memory.title,
          content: sanitizeMemoryForContext(r.memory.content),
          category: r.memory.category,
          importance: r.memory.importance,
          score: r.score,
          matchedTerms: r.matchedTerms,
          reason: r.reason
        }));
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userText,
          history: messages.slice(-8),
          memoryContext: candidateMemories,
          personalizationEnabled: settings.personalizationEnabled
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const replyData = await response.json();

      // 3. Persist model turn into Firestore with citation audit
      const savedModelMsg = await saveMessage(
        user.uid,
        currentConvId,
        'model',
        replyData.content,
        replyData.contextUsed
      );
      setMessages((prev) => [...prev, savedModelMsg]);

      // 4. Asynchronous memory & goal extraction (if memory enabled)
      if (settings.memoryEnabled) {
        triggerMemoryExtraction(token, userText, replyData.content, currentConvId);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatError(err.message || 'Gemini service is temporarily unreachable.');
    } finally {
      setIsSending(false);
    }
  };

  // Asynchronous Memory Extraction
  const triggerMemoryExtraction = async (
    token: string,
    userText: string,
    modelReply: string,
    convId: string
  ) => {
    if (!user) return;
    try {
      const res = await fetch('/api/memories/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userMessage: userText,
          modelReply,
          conversationId: convId,
          mutedCategories: settings.mutedCategories || []
        })
      });
      if (!res.ok) return;

      const data = await res.json();

      // Persist newly discovered memories
      if (Array.isArray(data.memories) && data.memories.length > 0) {
        for (const m of data.memories) {
          const savedMem = await saveMemory(user.uid, {
            title: m.title || 'New Insight',
            content: m.content || '',
            category: m.category || 'important_fact',
            importance: m.importance || 0.8,
            sourceConversationId: convId
          });
          setMemories((prev) => [savedMem, ...prev]);
        }
      }

      // Persist newly discovered goals
      if (Array.isArray(data.extractedGoals) && data.extractedGoals.length > 0) {
        for (const g of data.extractedGoals) {
          const savedG = await saveGoal(user.uid, {
            title: g.title,
            description: g.description || '',
            status: 'active',
            priority: g.priority || 'medium'
          });
          setGoals((prev) => [savedG, ...prev]);
        }
      }

      // Persist newly discovered tasks
      if (Array.isArray(data.extractedTasks) && data.extractedTasks.length > 0) {
        for (const t of data.extractedTasks) {
          const savedT = await saveTask(user.uid, {
            title: t.title,
            status: 'pending',
            dueDate: t.dueDate || undefined
          });
          setTasks((prev) => [savedT, ...prev]);
        }
      }
    } catch (e) {
      console.warn('Memory extraction skipped:', e);
    }
  };

  // Forget a specific memory
  const handleForgetMemory = async (memoryId: string) => {
    if (!user) return;
    await deleteMemory(user.uid, memoryId);
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  // Refresh Daily Brief
  const handleSynthesizeBrief = async () => {
    if (!user) return;
    setBriefLoading(true);
    try {
      const token = await getVerifiedToken();
      if (!token) return;

      const res = await fetch('/api/daily-brief/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recentMemories: memories,
          activeGoals: goals.filter((g) => g.status === 'active'),
          pendingTasks: tasks.filter((t) => t.status === 'pending')
        })
      });

      if (res.ok) {
        const briefData = await res.json();
        const savedBrief = await saveDailyBrief(user.uid, briefData);
        setDailyBrief(savedBrief);
      }
    } catch (err) {
      console.error('Failed to synthesize daily brief:', err);
    } finally {
      setBriefLoading(false);
    }
  };

  // Switch to chat and prefill strategic prompt
  const handleStrategizeInChat = (promptText: string) => {
    setActiveView('chat');
    setInputMessage(promptText);
  };

  // -------------------------------------------------------------
  // RENDER: Loading Screen
  // -------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-neutral-400">Verifying secure credentials...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Unauthenticated Landing Page
  // -------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
        {/* Header */}
        <header className="px-6 py-5 border-b border-neutral-800/80 flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              A
            </div>
            <span className="text-base font-semibold tracking-tight">AURA</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
              Private AI OS
            </span>
          </div>

          <SecurityBadge />
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full text-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Private Memory Layer for Google Gemini</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-100 leading-tight">
              Talk naturally. <br className="hidden sm:inline" />
              AURA remembers what matters.
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              A zero-trust authenticated cognitive workspace that transforms conversational reflections into private memories, actionable goals, and structured intelligence.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="landing-google-signin-btn"
                onClick={signInWithGoogle}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <span>Sign in with Google</span>
              </button>
            </div>

            {/* Security Pillars */}
            <div className="pt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-semibold text-neutral-200">Owner-Bound Firestore</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Data is partitioned strictly by user ID. Cross-tenant reads and writes are mathematically forbidden by rule.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-semibold text-neutral-200">Server-Side Cloud Run</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Gemini API keys are protected inside Secret Manager and never exposed to the client browser.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                <div className="w-6 h-6 rounded-md bg-violet-500/10 text-violet-400 flex items-center justify-center mb-2">
                  <Compass className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-semibold text-neutral-200">Explainable Context</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Always see exactly which memories influenced an AI response with instant one-click forget control.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-neutral-900 text-center text-xs text-neutral-400">
          AURA Private AI OS &bull; GenAI Academy / Cloud Run AI Challenge
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Authenticated Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Application Bar */}
      <header className="px-5 py-3 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs">
            A
          </div>
          <span className="text-sm font-semibold tracking-tight">AURA</span>

          {/* Primary View Switcher */}
          <nav className="hidden sm:flex items-center gap-1 ml-4 pl-4 border-l border-neutral-800">
            <button
              id="view-chat-btn"
              onClick={() => setActiveView('chat')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'chat' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Conversation
            </button>
            <button
              id="view-memories-btn"
              onClick={() => setActiveView('memories')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeView === 'memories' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Memories</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeView === 'memories' ? 'bg-indigo-800 text-indigo-100' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {memories.length}
              </span>
            </button>
            <button
              id="view-brief-btn"
              onClick={() => {
                setActiveView('brief');
                if (!dailyBrief) handleSynthesizeBrief();
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'brief' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Daily Brief
            </button>
            <button
              id="view-goals-btn"
              onClick={() => setActiveView('goals')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'goals' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Goals & Tasks
            </button>
            <button
              id="view-graph-btn"
              onClick={() => setActiveView('graph')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'graph' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Memory Graph
            </button>
            <button
              id="view-privacy-btn"
              onClick={() => setActiveView('privacy')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'privacy' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Privacy Center
            </button>
          </nav>
        </div>

        {/* User Profile & Security Badge */}
        <div className="flex items-center gap-3">
          <SecurityBadge userEmail={user.email} />

          <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full border border-neutral-700" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-mono">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              id="dashboard-logout-btn"
              onClick={logOut}
              className="p-1 text-neutral-400 hover:text-white transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sub-Navigation */}
      <div className="sm:hidden flex items-center gap-1 px-4 py-2 bg-neutral-900 border-b border-neutral-800 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveView('chat')}
          className={`px-2.5 py-1 rounded ${activeView === 'chat' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveView('memories')}
          className={`px-2.5 py-1 rounded ${activeView === 'memories' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Memories ({memories.length})
        </button>
        <button
          onClick={() => {
            setActiveView('brief');
            if (!dailyBrief) handleSynthesizeBrief();
          }}
          className={`px-2.5 py-1 rounded ${activeView === 'brief' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Brief
        </button>
        <button
          onClick={() => setActiveView('goals')}
          className={`px-2.5 py-1 rounded ${activeView === 'goals' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Goals
        </button>
        <button
          onClick={() => setActiveView('graph')}
          className={`px-2.5 py-1 rounded ${activeView === 'graph' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Graph
        </button>
        <button
          onClick={() => setActiveView('privacy')}
          className={`px-2.5 py-1 rounded ${activeView === 'privacy' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}
        >
          Privacy
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* VIEW 1: CONVERSATION & CHAT */}
        {activeView === 'chat' && (
          <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-53px)]">
            {/* Left Sidebar: Conversations list */}
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-800/80 bg-neutral-950/40 p-3 flex flex-col justify-between shrink-0">
              <div className="space-y-2 overflow-y-auto">
                <button
                  id="new-reflection-btn"
                  onClick={handleNewConversation}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>New Reflection</span>
                </button>

                <div className="pt-2 text-[11px] uppercase tracking-wider text-neutral-400 font-mono px-2">
                  Threads
                </div>

                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 truncate ${
                        currentConvId === conv.id
                          ? 'bg-indigo-950/50 text-indigo-200 border border-indigo-800/60'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Memory summary badge */}
              <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between px-1">
                <span>Total Memories:</span>
                <span className="font-mono text-indigo-300 font-semibold">{memories.length}</span>
              </div>
            </aside>

            {/* Center Chat Area */}
            <main className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
              {/* Message scroll area */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400 space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-200">Start Your Reflection</h3>
                    <p className="text-xs max-w-sm leading-relaxed">
                      Share what you're working on, learning, or thinking about. AURA will listen, advise, and selectively remember your goals and preferences.
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                          : 'bg-neutral-900/90 text-neutral-200 border border-neutral-800 rounded-bl-none shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Explainable Memory Context Inspection */}
                      {msg.role === 'model' && (
                        <ExplainableMemory
                          contextUsed={msg.contextUsed}
                          onForgetMemory={handleForgetMemory}
                          onInspectMemory={() => setActiveView('memories')}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}

                {isSending && (
                  <div className="flex items-start gap-2">
                    <div className="p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span>AURA is reasoning with private memory context...</span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center">
                  <input
                    id="chat-input-field"
                    type="text"
                    placeholder="Reflect on your day, goals, projects, or ask AURA..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={isSending}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-4 pr-12 py-3 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                  />
                  <button
                    id="chat-send-btn"
                    type="submit"
                    disabled={isSending || !inputMessage.trim()}
                    className="absolute right-2.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </main>
          </div>
        )}

        {/* VIEW 2: MEMORIES MANAGER */}
        {activeView === 'memories' && (
          <div className="flex-1 p-6 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <MemoryManager
              memories={memories}
              onAddMemory={async (mem) => {
                const saved = await saveMemory(user.uid, mem);
                setMemories((prev) => [saved, ...prev]);
              }}
              onUpdateMemory={async (id, updates) => {
                await updateMemory(user.uid, id, updates);
                setMemories((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, ...updates, lastAccessedAt: new Date().toISOString() } : m))
                );
              }}
              onDeleteMemory={async (id) => {
                await deleteMemory(user.uid, id);
                setMemories((prev) => prev.filter((m) => m.id !== id));
              }}
            />
          </div>
        )}

        {/* VIEW 3: DAILY BRIEF */}
        {activeView === 'brief' && (
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto space-y-6">
            <DailyBriefCard
              brief={dailyBrief}
              activeGoals={goals.filter((g) => g.status === 'active')}
              pendingTasks={tasks.filter((t) => t.status === 'pending')}
              recentMemories={memories}
              onRefresh={handleSynthesizeBrief}
              onToggleTaskStatus={async (tId, current) => {
                await toggleTaskStatus(user.uid, tId, current);
                setTasks((prev) =>
                  prev.map((item) =>
                    item.id === tId
                      ? { ...item, status: current === 'pending' ? 'completed' : 'pending' }
                      : item
                  )
                );
              }}
              onSelectActionPrompt={handleStrategizeInChat}
              onNavigateTab={(tab) => setActiveView(tab)}
              isLoading={briefLoading}
            />
          </div>
        )}

        {/* VIEW 4: GOALS & TASKS */}
        {activeView === 'goals' && (
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto space-y-6">
            <GoalsAndTasksPanel
              goals={goals}
              tasks={tasks}
              onAddGoal={async (g) => {
                const saved = await saveGoal(user.uid, { ...g, status: 'active' });
                setGoals((prev) => [saved, ...prev]);
              }}
              onUpdateGoal={async (gId, updates) => {
                await updateGoal(user.uid, gId, updates);
                setGoals((prev) =>
                  prev.map((item) => (item.id === gId ? { ...item, ...updates } : item))
                );
              }}
              onToggleGoalStatus={async (gId, current) => {
                const newStatus = current === 'active' ? 'completed' : 'active';
                await updateGoalStatus(user.uid, gId, newStatus);
                setGoals((prev) =>
                  prev.map((item) => (item.id === gId ? { ...item, status: newStatus } : item))
                );
              }}
              onDeleteGoal={async (gId) => {
                await deleteGoal(user.uid, gId);
                setGoals((prev) => prev.filter((item) => item.id !== gId));
              }}
              onAddTask={async (t) => {
                const saved = await saveTask(user.uid, { ...t, status: 'pending' });
                setTasks((prev) => [saved, ...prev]);
              }}
              onUpdateTask={async (tId, updates) => {
                await updateTask(user.uid, tId, updates);
                setTasks((prev) =>
                  prev.map((item) => (item.id === tId ? { ...item, ...updates } : item))
                );
              }}
              onToggleTaskStatus={async (tId, current) => {
                await toggleTaskStatus(user.uid, tId, current);
                setTasks((prev) =>
                  prev.map((item) =>
                    item.id === tId
                      ? { ...item, status: current === 'pending' ? 'completed' : 'pending' }
                      : item
                  )
                );
              }}
              onDeleteTask={async (tId) => {
                await deleteTask(user.uid, tId);
                setTasks((prev) => prev.filter((item) => item.id !== tId));
              }}
              onStrategizeInChat={handleStrategizeInChat}
            />
          </div>
        )}

        {/* VIEW 5: MEMORY GRAPH */}
        {activeView === 'graph' && (
          <div className="flex-1 p-6 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <MemoryGraph
              memories={memories}
              goals={goals}
              tasks={tasks}
              onExploreInChat={handleStrategizeInChat}
            />
          </div>
        )}

        {/* VIEW 5: PRIVACY CENTER */}
        {activeView === 'privacy' && (
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto space-y-6">
            <PrivacyCenter
              settings={settings}
              onUpdateSettings={async (newSet) => {
                await updatePrivacySettings(user.uid, newSet);
                setSettings((prev) => ({ ...prev, ...newSet }));
              }}
              onDeleteAllMemories={async () => {
                await deleteAllMemories(user.uid);
                setMemories([]);
              }}
              memories={memories}
              goals={goals}
              tasks={tasks}
              userEmail={user.email || 'user'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
