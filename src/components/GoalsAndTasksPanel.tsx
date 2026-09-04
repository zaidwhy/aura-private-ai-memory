import React, { useState, useMemo } from 'react';
import {
  Target,
  CheckSquare,
  Plus,
  Check,
  Clock,
  Trash2,
  Calendar,
  Edit3,
  Archive,
  ArrowRight,
  Sparkles,
  Search,
  Download,
  X,
  AlertCircle,
  BarChart3,
  Link as LinkIcon
} from 'lucide-react';
import type { GoalItem, TaskItem } from '../types';

interface GoalsAndTasksProps {
  goals: GoalItem[];
  tasks: TaskItem[];
  onAddGoal: (goal: { title: string; description: string; priority: 'low' | 'medium' | 'high'; targetDate?: string }) => Promise<void>;
  onUpdateGoal: (goalId: string, updates: Partial<GoalItem>) => Promise<void>;
  onToggleGoalStatus: (goalId: string, currentStatus: 'active' | 'completed' | 'archived') => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  onAddTask: (task: { title: string; goalId?: string; priority?: 'low' | 'medium' | 'high'; dueDate?: string }) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onToggleTaskStatus: (taskId: string, currentStatus: 'pending' | 'completed') => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onStrategizeInChat?: (promptText: string) => void;
}

export const GoalsAndTasksPanel: React.FC<GoalsAndTasksProps> = ({
  goals,
  tasks,
  onAddGoal,
  onUpdateGoal,
  onToggleGoalStatus,
  onDeleteGoal,
  onAddTask,
  onUpdateTask,
  onToggleTaskStatus,
  onDeleteTask,
  onStrategizeInChat,
}) => {
  const [activeTab, setActiveTab] = useState<'goals' | 'tasks'>('goals');
  const [goalFilter, setGoalFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('active');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedGoalForTaskFilter, setSelectedGoalForTaskFilter] = useState<string | null>(null);

  // Goal Form State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalPriority, setGoalPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  // Task Form State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskGoalId, setTaskGoalId] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<{ type: 'goal' | 'task'; id: string; title: string } | null>(null);

  // Compute Goal Progress & Task Association Map
  const goalStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; percentage: number }> = {};
    for (const g of goals) {
      const linked = tasks.filter((t) => t.goalId === g.id);
      const completed = linked.filter((t) => t.status === 'completed').length;
      const percentage = linked.length > 0 ? Math.round((completed / linked.length) * 100) : (g.status === 'completed' ? 100 : 0);
      stats[g.id] = { total: linked.length, completed, percentage };
    }
    return stats;
  }, [goals, tasks]);

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (goalFilter === 'all') return true;
      return g.status === goalFilter;
    });
  }, [goals, goalFilter]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter !== 'all' && t.status !== taskFilter) return false;
      if (selectedGoalForTaskFilter && t.goalId !== selectedGoalForTaskFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const parentGoal = goals.find((g) => g.id === t.goalId);
        const matchesGoal = parentGoal?.title.toLowerCase().includes(q) || false;
        return matchesTitle || matchesGoal;
      }
      return true;
    });
  }, [tasks, taskFilter, selectedGoalForTaskFilter, taskSearch, goals]);

  // Goal Form Handlers
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    if (editingGoalId) {
      await onUpdateGoal(editingGoalId, {
        title: goalTitle.trim(),
        description: goalDesc.trim(),
        priority: goalPriority,
        targetDate: goalTargetDate || undefined,
      });
      setEditingGoalId(null);
    } else {
      await onAddGoal({
        title: goalTitle.trim(),
        description: goalDesc.trim(),
        priority: goalPriority,
        targetDate: goalTargetDate || undefined,
      });
      setIsAddingGoal(false);
    }

    setGoalTitle('');
    setGoalDesc('');
    setGoalPriority('medium');
    setGoalTargetDate('');
  };

  const startEditGoal = (goal: GoalItem) => {
    setEditingGoalId(goal.id);
    setGoalTitle(goal.title);
    setGoalDesc(goal.description || '');
    setGoalPriority(goal.priority);
    setGoalTargetDate(goal.targetDate || '');
    setIsAddingGoal(true);
  };

  // Task Form Handlers
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (editingTaskId) {
      await onUpdateTask(editingTaskId, {
        title: taskTitle.trim(),
        goalId: taskGoalId || undefined,
        priority: taskPriority,
        dueDate: taskDueDate || undefined,
      });
      setEditingTaskId(null);
    } else {
      await onAddTask({
        title: taskTitle.trim(),
        goalId: taskGoalId || undefined,
        priority: taskPriority,
        dueDate: taskDueDate || undefined,
      });
      setIsAddingTask(false);
    }

    setTaskTitle('');
    setTaskGoalId('');
    setTaskPriority('medium');
    setTaskDueDate('');
  };

  const startEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskGoalId(task.goalId || '');
    setTaskPriority(task.priority || 'medium');
    setTaskDueDate(task.dueDate || '');
    setIsAddingTask(true);
  };

  // Quick action: Add task under specific goal
  const handleQuickAddTaskToGoal = (goalId: string) => {
    setTaskGoalId(goalId);
    setActiveTab('tasks');
    setIsAddingTask(true);
  };

  // Export tasks as .ics Calendar File
  const handleExportICS = () => {
    const calendarTasks = tasks.filter((t) => t.dueDate);
    if (calendarTasks.length === 0) {
      alert('No tasks with due dates found to export.');
      return;
    }

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AURA Cognitive OS//Tasks Export//EN',
      'CALSCALE:GREGORIAN',
    ];

    calendarTasks.forEach((t) => {
      const cleanDate = t.dueDate?.replace(/-/g, '') || '';
      const parentGoal = goals.find((g) => g.id === t.goalId);
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:aura-task-${t.id}@auraprivate.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${cleanDate}`,
        `SUMMARY:${t.title.replace(/[,;]/g, ' ')}`,
        `DESCRIPTION:${parentGoal ? `Linked Goal: ${parentGoal.title}` : 'AURA Task'}`,
        `STATUS:${t.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');
    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `AURA_Tasks_${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete Confirmation Handler
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'goal') {
      await onDeleteGoal(itemToDelete.id);
    } else {
      await onDeleteTask(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  return (
    <div id="goals-tasks-panel" className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl space-y-6">
      {/* Top Header & View Switching Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
        <div className="flex items-center gap-2.5">
          <button
            id="tab-goals-btn"
            onClick={() => {
              setActiveTab('goals');
              setSelectedGoalForTaskFilter(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'goals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Strategic Goals ({goals.filter((g) => g.status === 'active').length})</span>
          </button>

          <button
            id="tab-tasks-btn"
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks ({tasks.filter((t) => t.status === 'pending').length} open)</span>
          </button>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'tasks' && (
            <button
              id="export-ics-btn"
              onClick={handleExportICS}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              title="Export calendar file for Google Calendar or iCal"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export .ICS</span>
            </button>
          )}

          {activeTab === 'goals' ? (
            <button
              id="new-goal-toggle-btn"
              onClick={() => {
                setEditingGoalId(null);
                setGoalTitle('');
                setGoalDesc('');
                setGoalPriority('medium');
                setGoalTargetDate('');
                setIsAddingGoal(!isAddingGoal);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingGoal ? 'Cancel' : 'New Goal'}</span>
            </button>
          ) : (
            <button
              id="new-task-toggle-btn"
              onClick={() => {
                setEditingTaskId(null);
                setTaskTitle('');
                setTaskPriority('medium');
                setTaskDueDate('');
                setIsAddingTask(!isAddingTask);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingTask ? 'Cancel' : 'New Task'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* GOALS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          {/* Goal Filter Pills */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(['active', 'completed', 'archived', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGoalFilter(filter)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                    goalFilter === filter
                      ? 'bg-neutral-200 text-neutral-900 font-semibold'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {filter} ({filter === 'all' ? goals.length : goals.filter((g) => g.status === filter).length})
                </button>
              ))}
            </div>

            <span className="text-[11px] text-neutral-500 font-mono">
              {goals.filter((g) => g.status === 'completed').length}/{goals.length} Achieved
            </span>
          </div>

          {/* Goal Create/Edit Form */}
          {isAddingGoal && (
            <form onSubmit={handleSaveGoal} className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-semibold text-neutral-200">
                  {editingGoalId ? 'Edit Goal' : 'Create High-Impact Goal'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGoal(false);
                    setEditingGoalId(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                id="goal-title-input"
                type="text"
                placeholder="Goal Title (e.g. Master Cloud Run container architecture & Gemini SDK)"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                maxLength={200}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                required
              />

              <textarea
                id="goal-desc-input"
                placeholder="Success criteria, milestones, or personal motivation..."
                value={goalDesc}
                onChange={(e) => setGoalDesc(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Priority Selection */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Priority:</span>
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setGoalPriority(p)}
                      className={`text-[11px] px-2.5 py-0.5 rounded capitalize font-medium transition-colors ${
                        goalPriority === p
                          ? p === 'high'
                            ? 'bg-red-900 text-red-100 border border-red-700'
                            : 'bg-indigo-600 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Target Date */}
                <div className="flex items-center gap-2 justify-start sm:justify-end">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Target Date:</span>
                  </span>
                  <input
                    type="date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGoal(false);
                    setEditingGoalId(null);
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-goal-submit-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {editingGoalId ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          )}

          {/* Goals List */}
          <div className="space-y-3">
            {filteredGoals.map((g) => {
              const stats = goalStats[g.id] || { total: 0, completed: 0, percentage: 0 };
              return (
                <div
                  key={g.id}
                  className={`p-4 rounded-xl border transition-all ${
                    g.status === 'completed'
                      ? 'bg-neutral-950/40 border-neutral-800/60 opacity-80'
                      : g.status === 'archived'
                      ? 'bg-neutral-950/30 border-neutral-800/40 opacity-60'
                      : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 shadow-sm'
                  }`}
                >
                  {/* Top Bar of Goal Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`text-sm font-semibold tracking-tight ${
                            g.status === 'completed' ? 'line-through text-neutral-400' : 'text-neutral-100'
                          }`}
                        >
                          {g.title}
                        </h4>

                        {/* Priority Badge */}
                        <span
                          className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border ${
                            g.priority === 'high'
                              ? 'bg-red-950/60 text-red-300 border-red-800/60'
                              : g.priority === 'medium'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700/60'
                          }`}
                        >
                          {g.priority} priority
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded ${
                            g.status === 'completed'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : g.status === 'archived'
                              ? 'bg-neutral-800 text-neutral-400'
                              : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                          }`}
                        >
                          {g.status}
                        </span>

                        {/* Target Date */}
                        {g.targetDate && (
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-indigo-400" />
                            <span>Target: {g.targetDate}</span>
                          </span>
                        )}
                      </div>

                      {g.description && (
                        <p className="text-xs text-neutral-300/90 leading-relaxed max-w-2xl">{g.description}</p>
                      )}
                    </div>

                    {/* Top Action Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Strategize in chat */}
                      {onStrategizeInChat && g.status === 'active' && (
                        <button
                          onClick={() =>
                            onStrategizeInChat(
                              `Let's build a focused execution strategy and milestone breakdown for my goal: "${g.title}".`
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 transition-colors"
                          title="Reflect and strategize on this goal with AURA"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span className="hidden sm:inline">Strategize</span>
                        </button>
                      )}

                      {/* Complete Toggle */}
                      <button
                        onClick={() => onToggleGoalStatus(g.id, g.status)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          g.status === 'completed'
                            ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-800'
                            : 'text-neutral-400 hover:text-white bg-neutral-800'
                        }`}
                        title={g.status === 'completed' ? 'Reopen goal' : 'Mark as completed'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => startEditGoal(g)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                        title="Edit goal"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Archive Button */}
                      <button
                        onClick={() =>
                          onUpdateGoal(g.id, {
                            status: g.status === 'archived' ? 'active' : 'archived',
                          })
                        }
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                        title={g.status === 'archived' ? 'Unarchive' : 'Archive'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setItemToDelete({ type: 'goal', id: g.id, title: g.title })}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Linked Task Info */}
                  <div className="mt-3 pt-3 border-t border-neutral-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                      <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                        {stats.completed}/{stats.total} tasks ({stats.percentage}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedGoalForTaskFilter(g.id);
                          setActiveTab('tasks');
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                      >
                        <span>View Tasks ({stats.total})</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleQuickAddTaskToGoal(g.id)}
                        className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors pl-2 border-l border-neutral-800"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Task</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredGoals.length === 0 && (
              <div className="text-center py-12 rounded-xl bg-neutral-950/40 border border-neutral-800/60 space-y-2">
                <Target className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400 font-medium">No {goalFilter} goals found.</p>
                <p className="text-[11px] text-neutral-500">Define high-leverage goals to give AURA clear direction for daily briefs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TASKS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filter, Search & Goal Association Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              {(['all', 'pending', 'completed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                    taskFilter === filter
                      ? 'bg-neutral-200 text-neutral-900 font-semibold'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {filter} ({filter === 'all' ? tasks.length : tasks.filter((t) => t.status === filter).length})
                </button>
              ))}
            </div>

            {/* Task Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search tasks or goals..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Active Goal Scope Filter Banner (if filtering by a specific goal) */}
          {selectedGoalForTaskFilter && (
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-neutral-400">Scoped to Goal:</span>
                <span className="font-semibold text-indigo-200 truncate">
                  {goals.find((g) => g.id === selectedGoalForTaskFilter)?.title || 'Selected Goal'}
                </span>
              </div>
              <button
                onClick={() => setSelectedGoalForTaskFilter(null)}
                className="text-[11px] text-indigo-400 hover:text-indigo-200 flex items-center gap-1 font-medium shrink-0 ml-2"
              >
                <span>Clear Scope</span>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Task Create/Edit Form */}
          {isAddingTask && (
            <form onSubmit={handleSaveTask} className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-semibold text-neutral-200">
                  {editingTaskId ? 'Edit Task' : 'Add New Task'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTask(false);
                    setEditingTaskId(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                id="task-title-input"
                type="text"
                placeholder="Task title (e.g. Verify Cloud Run container labels and environment bindings)"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                maxLength={200}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Linked Goal Selector */}
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Associate with Goal (Optional):</label>
                  <select
                    value={taskGoalId}
                    onChange={(e) => setTaskGoalId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">None (Independent Task)</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Priority:</label>
                  <div className="flex items-center gap-1 pt-0.5">
                    {(['low', 'medium', 'high'] as const).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setTaskPriority(p)}
                        className={`text-[11px] px-2 py-1 rounded capitalize flex-1 font-medium transition-colors ${
                          taskPriority === p
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Due Date:</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTask(false);
                    setEditingTaskId(null);
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-task-submit-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {editingTaskId ? 'Save Changes' : 'Save Task'}
                </button>
              </div>
            </form>
          )}

          {/* Tasks List */}
          <div className="space-y-2">
            {filteredTasks.map((t) => {
              const parentGoal = goals.find((g) => g.id === t.goalId);
              const isOverdue = t.dueDate && new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && t.status !== 'completed';

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 group transition-colors ${
                    t.status === 'completed'
                      ? 'bg-neutral-950/40 border-neutral-850 opacity-70'
                      : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      onClick={() => onToggleTaskStatus(t.id, t.status)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        t.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-700 hover:border-indigo-500'
                      }`}
                    >
                      {t.status === 'completed' && <Check className="w-3 h-3" />}
                    </button>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-xs truncate ${
                          t.status === 'completed' ? 'line-through text-neutral-500' : 'text-neutral-200 font-medium'
                        }`}
                      >
                        {t.title}
                      </span>

                      {/* Badges: Goal link + Due date + Priority */}
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {parentGoal && (
                          <button
                            onClick={() => setSelectedGoalForTaskFilter(parentGoal.id)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition-colors"
                          >
                            <LinkIcon className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[150px]">{parentGoal.title}</span>
                          </button>
                        )}

                        {t.dueDate && (
                          <span
                            className={`text-[10px] flex items-center gap-1 font-mono ${
                              isOverdue ? 'text-red-400 font-semibold' : 'text-neutral-400'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{t.dueDate}</span>
                            {isOverdue && <span className="text-[9px] uppercase tracking-wider">(Overdue)</span>}
                          </span>
                        )}

                        {t.priority && t.priority !== 'medium' && (
                          <span
                            className={`text-[9px] uppercase font-mono px-1 rounded ${
                              t.priority === 'high' ? 'bg-red-950/60 text-red-400' : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {t.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Task Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditTask(t)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                      title="Edit task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setItemToDelete({ type: 'task', id: t.id, title: t.title })}
                      className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="text-center py-10 rounded-xl bg-neutral-950/40 border border-neutral-800/60 space-y-1">
                <CheckSquare className="w-7 h-7 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400">No {taskFilter} tasks found.</p>
                <p className="text-[11px] text-neutral-500">Capture next steps in chat or add tasks above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal (Safe for iframe and zero native alerts) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>Confirm Deletion</span>
              </div>
              <button
                onClick={() => setItemToDelete(null)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to permanently remove this {itemToDelete.type}:
              <br />
              <span className="font-semibold text-white mt-1 block italic">"{itemToDelete.title}"</span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-item-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for chevron icon
function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
