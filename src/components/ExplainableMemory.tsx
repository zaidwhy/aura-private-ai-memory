import React, { useState } from 'react';
import { Sparkles, Trash2, ChevronDown, ChevronUp, Info, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import type { ContextCitation, MemoryCategory } from '../types';

interface ExplainableMemoryProps {
  contextUsed?: ContextCitation[];
  onForgetMemory?: (memoryId: string) => Promise<void>;
  onInspectMemory?: (memoryId: string) => void;
}

const CATEGORY_STYLES: Record<MemoryCategory, { label: string; badge: string }> = {
  goal: { label: 'Goal', badge: 'bg-purple-950/70 text-purple-300 border-purple-800/60' },
  preference: { label: 'Preference', badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' },
  project: { label: 'Project', badge: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
  important_fact: { label: 'Important Fact', badge: 'bg-sky-950/70 text-sky-300 border-sky-800/60' },
  recurring_theme: { label: 'Theme', badge: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60' },
};

export const ExplainableMemory: React.FC<ExplainableMemoryProps> = ({
  contextUsed,
  onForgetMemory,
  onInspectMemory,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const [forgottenIds, setForgottenIds] = useState<Record<string, boolean>>({});

  if (!contextUsed || contextUsed.length === 0) {
    return null;
  }

  const handleForget = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onForgetMemory) return;
    setForgettingId(id);
    try {
      await onForgetMemory(id);
      setForgottenIds((prev) => ({ ...prev, [id]: true }));
    } finally {
      setForgettingId(null);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-neutral-800/80">
      <button
        id="explainable-memory-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>
          Explainable Context ({contextUsed.length} {contextUsed.length === 1 ? 'memory cited' : 'memories cited'})
        </span>
        {isOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          id="explainable-memory-details"
          className="mt-2 space-y-3 p-3.5 rounded-xl bg-neutral-900/95 border border-neutral-800 text-xs animate-in fade-in duration-150 shadow-lg"
        >
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-2 border-b border-neutral-800/80">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>AURA Grounding & Sovereign Retrieval Audit:</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">Tenant-isolated</span>
          </div>

          <div className="space-y-2.5 divide-y divide-neutral-800/50">
            {contextUsed.map((mem) => {
              const categoryConfig = CATEGORY_STYLES[mem.category] || {
                label: mem.category,
                badge: 'bg-neutral-800 text-neutral-300 border-neutral-700',
              };
              const isForgotten = forgottenIds[mem.id];

              return (
                <div key={mem.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3">
                  <div className={`space-y-1.5 min-w-0 flex-1 ${isForgotten ? 'opacity-40 line-through' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-200 truncate">{mem.title}</span>
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${categoryConfig.badge}`}
                      >
                        {categoryConfig.label}
                      </span>
                      {typeof mem.score === 'number' && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/40">
                          Match: {Math.round(mem.score * 100)}%
                        </span>
                      )}
                    </div>

                    <p className="text-neutral-400 text-[11px] italic">"{mem.contentSnippet}..."</p>

                    {/* Matched tokens chips */}
                    {Array.isArray(mem.matchedTerms) && mem.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-[10px] text-neutral-500">Tokens:</span>
                        {mem.matchedTerms.map((term, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 text-[10px] rounded bg-indigo-950/50 text-indigo-300 border border-indigo-900/50 font-mono"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-indigo-300/80 text-[10px] flex items-center gap-1">
                      <span className="text-neutral-500">Retrieval reason:</span> {mem.reason}
                    </p>

                    {isForgotten && (
                      <p className="text-red-400 text-[10px] flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3 text-red-400" /> Erased from user memory vault
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onInspectMemory && !isForgotten && (
                      <button
                        onClick={() => onInspectMemory(mem.id)}
                        className="p-1.5 text-neutral-400 hover:text-indigo-300 hover:bg-neutral-800 rounded transition-colors"
                        title="View in Memory Vault"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onForgetMemory && !isForgotten && (
                      <button
                        id={`forget-memory-${mem.id}`}
                        onClick={(e) => handleForget(mem.id, e)}
                        disabled={forgettingId === mem.id}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                        title="Forget this memory from AURA vault"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
