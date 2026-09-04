import React, { useState } from 'react';
import { ShieldCheck, Lock, Database, KeyRound, Cpu, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface SecurityBadgeProps {
  userEmail?: string | null;
}

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({ userEmail }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        id="security-architecture-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/40 transition-colors shadow-sm"
        title="View AURA Zero-Trust Security Architecture"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Private & Isolated</span>
        {isOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          id="security-architecture-modal"
          className="absolute right-0 mt-2 w-80 md:w-96 p-4 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-neutral-800 shadow-2xl text-neutral-200 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-neutral-100">AURA Security Architecture</h4>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
              Verified
            </span>
          </div>

          <div className="mt-3 space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-neutral-200">Firebase Token Cryptography</span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Every request requires a verified RS256 JWT. Client-forged identities are rejected at the edge.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-neutral-200">Owner-Scoped Firestore Rules</span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Enforced by rule engine: <code className="text-emerald-300 font-mono text-[10px]">request.auth.uid == userId</code>. Cross-tenant reads/writes are impossible.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-neutral-200">Server-Side Gemini Trust Boundary</span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  The model runs exclusively inside Cloud Run. API keys are never exposed in client bundles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-neutral-200">Google Drive Least Privilege</span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Restricted strictly to <code className="text-emerald-300 font-mono text-[10px]">drive.file</code>. Only files created by AURA can ever be accessed.
                </p>
              </div>
            </div>
          </div>

          {userEmail && (
            <div className="mt-3.5 pt-2.5 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
              <span>Isolated Tenant:</span>
              <span className="font-mono text-neutral-300 truncate max-w-[180px]">{userEmail}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
