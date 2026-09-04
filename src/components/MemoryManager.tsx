/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit2,
  Sliders,
  Sparkles,
  Filter,
  CheckCircle,
  Tag,
  Clock,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  X
} from 'lucide-react';
import { MemoryItem, MemoryCategory } from '../types';
import { retrieveRelevantMemories, sanitizeMemoryForContext } from '../lib/memoryRetriever';

interface MemoryManagerProps {
  memories: MemoryItem[];
  onAddMemory: (mem: Omit<MemoryItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  onUpdateMemory: (id: string, updates: Partial<Omit<MemoryItem, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

const CATEGORY_COLORS: Record<MemoryCategory, { bg: string; text: string; border: string }> = {
  goal: { bg: 'bg-emerald-950/40', text: 'text-emerald-300', border: 'border-emerald-800/60' },
  preference: { bg: 'bg-violet-950/40', text: 'text-violet-300', border: 'border-violet-800/60' },
  project: { bg: 'bg-blue-950/40', text: 'text-blue-300', border: 'border-blue-800/60' },
  important_fact: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/60' },
  recurring_theme: { bg: 'bg-fuchsia-950/40', text: 'text-fuchsia-300', border: 'border-fuchsia-800/60' }
};

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'importance' | 'title'>('recent');

  // Retrieval simulation tester state
  const [testerQuery, setTesterQuery] = useState('');
  const [showTester, setShowTester] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('important_fact');
  const [formImportance, setFormImportance] = useState(0.8);
  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Filtered and Sorted Memories
  const filteredMemories = useMemo(() => {
    return memories
      .filter((m) => {
        const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
        const matchesSearch =
          !searchQuery.trim() ||
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.content.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'importance') {
          return (b.importance || 0) - (a.importance || 0);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        // recent
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [memories, selectedCategory, searchQuery, sortBy]);

  // Real-time retrieval simulation results
  const simulatedRetrieval = useMemo(() => {
    if (!testerQuery.trim()) return [];
    return retrieveRelevantMemories(testerQuery, memories, { maxK: 4, fallbackToTopSalient: false });
  }, [testerQuery, memories]);

  const handleOpenAddModal = () => {
    setEditingMemory(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('important_fact');
    setFormImportance(0.8);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mem: MemoryItem) => {
    setEditingMemory(mem);
    setFormTitle(mem.title);
    setFormContent(mem.content);
    setFormCategory(mem.category);
    setFormImportance(mem.importance);
    setIsModalOpen(true);
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    setIsSaving(true);
    try {
      if (editingMemory) {
        await onUpdateMemory(editingMemory.id, {
          title: sanitizeMemoryForContext(formTitle.trim()),
          content: sanitizeMemoryForContext(formContent.trim()),
          category: formCategory,
          importance: Number(formImportance),
        });
        setStatusNotice('Memory updated successfully.');
      } else {
        await onAddMemory({
          title: sanitizeMemoryForContext(formTitle.trim()),
          content: sanitizeMemoryForContext(formContent.trim()),
          category: formCategory,
          importance: Number(formImportance),
        });
        setStatusNotice('New memory committed to sovereign store.');
      }
      setIsModalOpen(false);
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to save memory:', err);
      setStatusNotice('Error saving memory.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Permanently delete memory "${title}"?`)) {
      try {
        await onDeleteMemory(id);
        setStatusNotice('Memory erased from sovereign database.');
        setTimeout(() => setStatusNotice(null), 3000);
      } catch (err) {
        console.error('Failed to delete memory:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-neutral-100">AURA Sovereign Memory Vault</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Personal cognitive store automatically curated by AURA and fully editable by you.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="toggle-retrieval-tester-btn"
            onClick={() => setShowTester(!showTester)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showTester
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{showTester ? 'Hide Retrieval Inspector' : 'Inspect Retrieval Matching'}</span>
          </button>

          <button
            id="create-new-memory-btn"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800 text-indigo-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Interactive Retrieval Matching Inspector */}
      {showTester && (
        <div className="p-5 rounded-2xl bg-neutral-900/90 border border-indigo-800/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-neutral-200">
                Live Memory Retrieval Simulator (OWASP-Hardened Matching)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-indigo-400">TF-IDF + Salience Ranking</span>
          </div>

          <p className="text-xs text-neutral-400">
            Type any phrase below to test which memories AURA's retrieval engine would inject into context:
          </p>

          <div className="relative">
            <input
              id="retrieval-test-input"
              type="text"
              placeholder="e.g. Preparing for Cloud Run architecture interviews, or food preferences..."
              value={testerQuery}
              onChange={(e) => setTesterQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {testerQuery.trim() && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Retrieval Matches ({simulatedRetrieval.length}):
              </div>

              {simulatedRetrieval.length === 0 ? (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400">
                  No memories exceeded the relevance threshold for this query.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {simulatedRetrieval.map((item, idx) => (
                    <div
                      key={item.memory.id}
                      className="p-3 rounded-xl bg-neutral-950 border border-indigo-900/50 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-200 truncate">
                          #{idx + 1} {item.memory.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300 font-mono text-[10px]">
                          Score: {item.score}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-2">{item.memory.content}</p>
                      <div className="text-[10px] text-indigo-400 font-mono flex items-center justify-between">
                        <span>Matched: {item.matchedTerms.join(', ') || 'semantic fallback'}</span>
                        <span className="capitalize">{item.memory.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
          <input
            id="memory-search-input"
            type="text"
            placeholder="Search memories by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'goal', 'preference', 'project', 'important_fact', 'recurring_theme'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors capitalize ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <select
          id="memory-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none"
        >
          <option value="recent">Sort by Newest</option>
          <option value="importance">Sort by Importance</option>
          <option value="title">Sort by Title</option>
        </select>
      </div>

      {/* Memory Cards Grid */}
      {filteredMemories.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
          <Brain className="w-8 h-8 mx-auto text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-300">No Memories Found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all'
              ? 'No memories match your active filters. Try broadening your search or resetting category chips.'
              : 'As you converse with AURA, important goals, habits, and preferences will be recorded here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((mem) => {
            const catStyle = CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.important_fact;
            return (
              <div
                key={mem.id}
                className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700/80 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {mem.category.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {Math.round((mem.importance || 0.8) * 100)}% salience
                      </span>
                      <button
                        id={`edit-memory-${mem.id}-btn`}
                        onClick={() => handleOpenEditModal(mem)}
                        className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="Edit Memory"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-memory-${mem.id}-btn`}
                        onClick={() => handleDelete(mem.id, mem.title)}
                        className="p-1 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Forget Memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-neutral-100 mt-2">{mem.title}</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed whitespace-pre-wrap">
                    {mem.content}
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>Added {new Date(mem.createdAt).toLocaleDateString()}</span>
                  </div>
                  {mem.sourceConversationId && (
                    <span className="text-neutral-400">From conversation</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-100">
                {editingMemory ? 'Edit Memory' : 'Add Sovereign Memory'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Memory Title
                </label>
                <input
                  id="memory-modal-title"
                  type="text"
                  required
                  placeholder="e.g. Master Cloud Run and System Design"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Detailed Content / Summary
                </label>
                <textarea
                  id="memory-modal-content"
                  required
                  rows={3}
                  placeholder="e.g. Preparing for software engineering interview rounds over the next 4 weeks. Prefers concise explanations."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Category
                  </label>
                  <select
                    id="memory-modal-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 capitalize"
                  >
                    <option value="goal">Goal</option>
                    <option value="preference">Preference</option>
                    <option value="project">Project</option>
                    <option value="important_fact">Important Fact</option>
                    <option value="recurring_theme">Recurring Theme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Salience ({Math.round(formImportance * 100)}%)
                  </label>
                  <input
                    id="memory-modal-importance"
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={formImportance}
                    onChange={(e) => setFormImportance(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="memory-modal-submit-btn"
                  type="submit"
                  disabled={isSaving || !formTitle.trim() || !formContent.trim()}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingMemory ? 'Update Memory' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
