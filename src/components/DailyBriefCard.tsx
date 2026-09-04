import React from 'react';
import {
  Sparkles,
  RefreshCw,
  Target,
  CheckSquare,
  Compass,
  ArrowRight,
  TrendingUp,
  Check,
  Calendar,
  Layers,
  Cpu
} from 'lucide-react';
import type { DailyBrief, GoalItem, TaskItem, MemoryItem } from '../types';

interface DailyBriefProps {
  brief: DailyBrief | null;
  activeGoals: GoalItem[];
  pendingTasks: TaskItem[];
  recentMemories: MemoryItem[];
  onRefresh: () => Promise<void>;
  onToggleTaskStatus?: (taskId: string, currentStatus: 'pending' | 'completed') => Promise<void>;
  onSelectActionPrompt?: (promptText: string) => void;
  onNavigateTab?: (tab: 'chat' | 'goals' | 'memories') => void;
  isLoading: boolean;
}

export const DailyBriefCard: React.FC<DailyBriefProps> = ({
  brief,
  activeGoals,
  pendingTasks,
  recentMemories,
  onRefresh,
  onToggleTaskStatus,
  onSelectActionPrompt,
  onNavigateTab,
  isLoading,
}) => {
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      id="daily-brief-container"
      className="p-6 rounded-2xl bg-gradient-to-b from-neutral-900/95 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-100 tracking-tight">Executive Intelligence Brief</h3>
              {brief?.modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>{brief.modelUsed}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Personalized intelligence synthesized from private memory • <span className="text-neutral-300">{currentDateFormatted}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-daily-brief-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-indigo-950"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Synthesize Brief'}</span>
          </button>
        </div>
      </div>

      {/* Main 3 Columns Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: State of Affairs */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 mb-2">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>State of Affairs</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {brief?.recentSummary ||
                'AURA is continuously learning your workflow and strategic goals through your reflections.'}
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-850 text-[11px] text-neutral-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Grounded Memories:</span>
            </span>
            <span className="font-mono text-neutral-200">{recentMemories.length} active</span>
          </div>
        </div>

        {/* Column 2: Recommended High-Leverage Focus */}
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-2">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recommended Focus Today</span>
            </div>
            <p className="text-xs text-indigo-100 font-medium leading-relaxed">
              {brief?.focusRecommendation ||
                'Establish your primary objective in conversation to unlock prioritized recommendations.'}
            </p>
          </div>

          {onSelectActionPrompt && brief?.focusRecommendation && (
            <button
              onClick={() =>
                onSelectActionPrompt(
                  `Help me plan concrete execution steps for today's recommended focus: "${brief.focusRecommendation}".`
                )
              }
              className="mt-2 text-[11px] font-medium text-indigo-300 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Strategize with AURA</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <div className="pt-2 border-t border-indigo-800/30 text-[11px] text-indigo-300/80 flex items-center justify-between">
            <span>Active Goals:</span>
            <span className="font-mono text-indigo-200">{activeGoals.length} tracked</span>
          </div>
        </div>

        {/* Column 3: Actionable Incomplete Tasks */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Immediate Next Actions</span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded">
                {pendingTasks.length} pending
              </span>
            </div>

            {pendingTasks.length > 0 ? (
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {pendingTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-xs text-neutral-300 group">
                    <div className="flex items-center gap-2 truncate">
                      {onToggleTaskStatus && (
                        <button
                          onClick={() => onToggleTaskStatus(t.id, t.status)}
                          className="w-3.5 h-3.5 rounded border border-neutral-700 hover:border-indigo-400 flex items-center justify-center shrink-0 transition-colors"
                          title="Mark completed"
                        >
                          <Check className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 text-emerald-400" />
                        </button>
                      )}
                      <span className="truncate">{t.title}</span>
                    </div>
                    {t.dueDate && (
                      <span className="text-[10px] text-neutral-500 font-mono shrink-0 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {t.dueDate}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic py-2">No outstanding pending tasks. You are all caught up!</p>
            )}
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('goals')}
              className="pt-2 border-t border-neutral-850 text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center justify-between transition-colors"
            >
              <span>Manage all tasks & goals</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Discovered Patterns & Strategic Themes */}
      {brief?.keyPatterns && brief.keyPatterns.length > 0 && (
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recognized Patterns & Momentum Themes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {brief.keyPatterns.map((pattern, idx) => (
              <div
                key={idx}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>{pattern}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Proactive Prompts / Next Conversations */}
      {brief?.suggestedActions && brief.suggestedActions.length > 0 && (
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recommended Strategic Conversations</span>
            </span>
            <span className="text-[10px] text-neutral-500">1-click to start in Chat</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {brief.suggestedActions.map((promptText, idx) => (
              <button
                key={idx}
                onClick={() => onSelectActionPrompt && onSelectActionPrompt(promptText)}
                className="p-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 hover:border-indigo-500/50 text-left transition-all group flex items-start justify-between gap-2"
              >
                <span className="text-xs text-neutral-300 group-hover:text-indigo-200 transition-colors leading-relaxed">
                  "{promptText}"
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
