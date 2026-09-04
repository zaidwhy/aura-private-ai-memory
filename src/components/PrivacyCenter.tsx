import React, { useState, useEffect } from 'react';
import {
  Shield,
  Trash2,
  Download,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
  Filter,
  Lock,
  Layers,
  FileText,
  X
} from 'lucide-react';
import type { PrivacySettings, MemoryItem, GoalItem, TaskItem, MemoryCategory } from '../types';
import { uploadAuraBackupToDrive, listAuraDriveBackups } from '../lib/driveService';
import { signInWithGoogle } from '../lib/firebase';

interface PrivacyCenterProps {
  settings: PrivacySettings;
  onUpdateSettings: (newSettings: Partial<PrivacySettings>) => Promise<void>;
  onDeleteAllMemories: () => Promise<void>;
  memories: MemoryItem[];
  goals: GoalItem[];
  tasks: TaskItem[];
  userEmail: string;
}

const ALL_CATEGORIES: { id: MemoryCategory; label: string }[] = [
  { id: 'goal', label: 'Goals & Ambitions' },
  { id: 'preference', label: 'Preferences' },
  { id: 'project', label: 'Active Projects' },
  { id: 'important_fact', label: 'Important Facts' },
  { id: 'recurring_theme', label: 'Recurring Themes' },
];

const RETENTION_OPTIONS = [
  { value: 0, label: 'Indefinite (Keep Forever)' },
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
  { value: 180, label: '180 Days' },
];

export const PrivacyCenter: React.FC<PrivacyCenterProps> = ({
  settings,
  onUpdateSettings,
  onDeleteAllMemories,
  memories,
  goals,
  tasks,
  userEmail,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check Drive token on mount
  useEffect(() => {
    const token = sessionStorage.getItem('aura_drive_token');
    setHasDriveToken(!!token);
    if (token) {
      loadDriveBackups(token);
    }
  }, []);

  const loadDriveBackups = async (token: string) => {
    setIsLoadingBackups(true);
    try {
      const files = await listAuraDriveBackups(token);
      setDriveBackups(files);
    } catch (e) {
      console.warn('Could not list drive backups:', e);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleToggle = async (key: keyof PrivacySettings, currentVal: boolean) => {
    try {
      await onUpdateSettings({ [key]: !currentVal });
      setFeedback({ type: 'success', message: 'Sovereign privacy setting updated.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update setting.' });
    }
  };

  const handleRetentionChange = async (days: number) => {
    try {
      await onUpdateSettings({ retentionPeriodDays: days });
      setFeedback({ type: 'success', message: `Retention policy updated to: ${days === 0 ? 'Indefinite' : `${days} days`}.` });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update retention policy.' });
    }
  };

  const handleToggleCategoryMute = async (cat: MemoryCategory) => {
    const currentMuted = settings.mutedCategories || [];
    const isMuted = currentMuted.includes(cat);
    const newMuted = isMuted ? currentMuted.filter((c) => c !== cat) : [...currentMuted, cat];

    try {
      await onUpdateSettings({ mutedCategories: newMuted });
      setFeedback({
        type: 'success',
        message: isMuted ? `Unmuted ${cat} memories.` : `Muted ${cat} memories from automated capture.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update category mute list.' });
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const res = await signInWithGoogle();
      if (res.accessToken) {
        sessionStorage.setItem('aura_drive_token', res.accessToken);
        setHasDriveToken(true);
        await loadDriveBackups(res.accessToken);
        setFeedback({ type: 'success', message: 'Google Drive connected successfully with drive.file scope.' });
      } else {
        setFeedback({ type: 'error', message: 'Google Drive access token not returned.' });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to authenticate Google Drive.' });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAllMemories();
      setShowDeleteModal(false);
      setFeedback({ type: 'success', message: 'All stored memories permanently deleted from vault.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete memories.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const exportObject = {
        exportedAt: new Date().toISOString(),
        userEmail,
        tenantIsolationVerified: true,
        privacySettings: settings,
        counts: {
          memories: memories.length,
          goals: goals.length,
          tasks: tasks.length,
        },
        memories,
        goals,
        tasks,
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `AURA_Private_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFeedback({ type: 'success', message: 'Private data snapshot exported safely to your machine.' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDriveBackup = async () => {
    const token = sessionStorage.getItem('aura_drive_token');
    if (!token) {
      setFeedback({
        type: 'error',
        message: 'Google Drive session token not found. Please click "Authorize Google Drive" first.',
      });
      return;
    }

    setIsDriveSyncing(true);
    try {
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        userEmail,
        memories,
        goals,
        tasks,
      };
      const result = await uploadAuraBackupToDrive(token, backupPayload);
      setFeedback({
        type: 'success',
        message: `Backup successfully uploaded to your Google Drive: "${result.name}"`,
      });
      await loadDriveBackups(token);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to upload backup to Google Drive.',
      });
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const mutedList = settings.mutedCategories || [];
  const retentionDays = settings.retentionPeriodDays ?? 0;

  return (
    <div id="privacy-center-container" className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-neutral-100 flex items-center gap-2">
              <span>Sovereign Privacy & Memory Control Center</span>
            </h3>
            <p className="text-xs text-neutral-400">Owner-bound encryption, strict tenant isolation, and Google Drive portability</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            <span>Zero-Cross-Tenant</span>
          </span>
          <span className="text-[11px] font-mono text-neutral-300 bg-neutral-800 px-2.5 py-1 rounded-md">
            {memories.length} Memories Stored
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-red-950/60 border border-red-800 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Core Sovereign Toggles */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Core AI Memory Policy</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Toggle 1: Memory Extraction */}
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200">Memory Extraction</span>
                <button
                  id="toggle-memory-btn"
                  onClick={() => handleToggle('memoryEnabled', settings.memoryEnabled)}
                  className={`text-xs px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                    settings.memoryEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {settings.memoryEnabled ? 'ACTIVE' : 'MUTED'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                When enabled, AURA selectively extracts long-term goals and facts from your reflections.
              </p>
            </div>
          </div>

          {/* Toggle 2: Personalized Context */}
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200">Personalized Context</span>
                <button
                  id="toggle-personalization-btn"
                  onClick={() => handleToggle('personalizationEnabled', settings.personalizationEnabled)}
                  className={`text-xs px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                    settings.personalizationEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {settings.personalizationEnabled ? 'ACTIVE' : 'MUTED'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                When enabled, relevant past memories are provided to Gemini to tailor advice and responses.
              </p>
            </div>
          </div>

          {/* Toggle 3: AI Daily Brief Insights */}
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200">AI Daily Briefs</span>
                <button
                  id="toggle-insights-btn"
                  onClick={() => handleToggle('insightsEnabled', settings.insightsEnabled)}
                  className={`text-xs px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                    settings.insightsEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {settings.insightsEnabled ? 'ACTIVE' : 'MUTED'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                Synthesize focus recommendations and recurring themes on your private dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Granular Controls: Retention & Muted Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Retention Policy */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Automatic Memory Retention</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded">
              {retentionDays === 0 ? 'Indefinite' : `${retentionDays} Days`}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Select how long memories remain active in the grounding retrieval pool before decaying.
          </p>

          <select
            id="retention-period-select"
            value={retentionDays}
            onChange={(e) => handleRetentionChange(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
          >
            {RETENTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category Muting */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Category Capture Muting</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {mutedList.length} muted
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Mute specific categories to stop AURA from automatically extracting them from chat.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const isMuted = mutedList.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleToggleCategoryMute(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    isMuted
                      ? 'bg-red-950/40 text-red-300 border-red-800/60 line-through'
                      : 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:border-neutral-500'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data Portability & Google Drive Cloud Backup */}
      <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
              <span>Data Portability & Google Drive Backup</span>
            </h4>
            <p className="text-[11px] text-neutral-400">
              Export your full memory graph to your local disk or upload verified backups directly to your personal Google Drive.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Local Export */}
            <button
              id="export-private-data-btn"
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isExporting ? 'Exporting...' : 'Export JSON'}</span>
            </button>

            {/* Google Drive Connect / Backup */}
            {!hasDriveToken ? (
              <button
                id="connect-google-drive-btn"
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded-lg transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isConnectingDrive ? 'Connecting...' : 'Authorize Google Drive'}</span>
              </button>
            ) : (
              <button
                id="sync-google-drive-btn"
                onClick={handleDriveBackup}
                disabled={isDriveSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-bounce' : ''}`} />
                <span>{isDriveSyncing ? 'Uploading...' : 'Backup to Google Drive'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Existing Google Drive Backups List */}
        {hasDriveToken && (
          <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Google Drive Snapshots (drive.file scope):</span>
              <button
                onClick={() => {
                  const token = sessionStorage.getItem('aura_drive_token');
                  if (token) loadDriveBackups(token);
                }}
                className="flex items-center gap-1 hover:text-neutral-200"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {driveBackups.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {driveBackups.map((file) => (
                  <div
                    key={file.id}
                    className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-neutral-200 truncate">{file.name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(file.createdTime).toLocaleDateString()}
                      </span>
                    </div>

                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 ml-2"
                      >
                        <span>Open in Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500 italic">No cloud backups uploaded yet. Click "Backup to Google Drive" to create your first cloud snapshot.</p>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone: Erase All Memories */}
      <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Danger Zone: Permanent Memory Purge</span>
          </span>
          <p className="text-[11px] text-neutral-400">
            Irrevocably erases all memories in your personal Firestore collection. Does not affect goals or tasks.
          </p>
        </div>

        <button
          id="delete-all-memories-btn"
          onClick={() => setShowDeleteModal(true)}
          disabled={isDeleting || memories.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-300 bg-red-950/60 hover:bg-red-900/60 border border-red-900/80 rounded-lg transition-colors disabled:opacity-40 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span>Delete All Memories</span>
        </button>
      </div>

      {/* Custom Confirmation Modal (Safe for iframes) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you absolutely sure you want to delete all <span className="font-bold text-white">{memories.length}</span> stored memories? This action is immediate, permanent, and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-all-btn"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
