import React, { useState, useEffect } from 'react';
import { Mail, Presentation, CheckSquare, Bookmark, X, Send, Sparkles, Plus, RefreshCw, ExternalLink, HardDrive, AlertCircle } from 'lucide-react';
import { getAccessToken, googleSignIn } from '../../lib/firebase';
import { sendGmailReport, listGmailMessages } from '../../lib/gmailService';
import { createSparkExecutiveDeck } from '../../lib/slidesService';
import { listTasks, createGoogleTask, TaskItem } from '../../lib/tasksService';
import { createGoogleKeepNote } from '../../lib/keepService';

interface WorkspaceToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCode: string;
  onImportCode?: (code: string, fileName: string) => void;
}

type TabType = 'gmail' | 'slides' | 'tasks' | 'keep';

export const WorkspaceToolsModal: React.FC<WorkspaceToolsModalProps> = ({
  isOpen,
  onClose,
  activeCode,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('gmail');
  const [token, setToken] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Gmail State
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('Spark Studio Pipeline Optimization Report');
  const [emailBody, setEmailBody] = useState<string>('');

  // Slides State
  const [slideTitle, setSlideTitle] = useState<string>('Spark Studio Pipeline Analysis');
  const [shufflePartitions, setShufflePartitions] = useState<number>(200);
  const [aqeEnabled, setAqeEnabled] = useState<boolean>(true);
  const [speedup, setSpeedup] = useState<string>('2.4x Speedup via AQE Skew Join Handling');
  const [memorySaved, setMemorySaved] = useState<string>('1.8 GB RAM saved per executor');

  // Tasks State
  const [tasksList, setTasksList] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');

  // Keep State
  const [keepTitle, setKeepTitle] = useState<string>('PySpark Optimization Notes');
  const [keepBody, setKeepBody] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const activeToken = getAccessToken();
      setToken(activeToken);
      if (activeCode && !emailBody) {
        setEmailBody(`Hello Team,\n\nHere is the updated PySpark Pipeline script generated from Spark Studio:\n\n${activeCode.slice(0, 1000)}\n\nBest regards,\nSpark Studio Data Team`);
      }
      if (activeCode && !keepBody) {
        setKeepBody(activeCode);
      }
    }
  }, [isOpen, activeCode]);

  if (!isOpen) return null;

  const ensureAuth = async (): Promise<string> => {
    let currentToken = getAccessToken();
    if (!currentToken) {
      const res = await googleSignIn();
      currentToken = res?.accessToken || null;
      setToken(currentToken);
    }
    if (!currentToken) {
      throw new Error('Google OAuth access token is required. Please sign in with Google.');
    }
    return currentToken;
  };

  // Gmail Handlers
  const handleSendEmail = async () => {
    try {
      setLoading(true);
      setStatusMsg({ type: 'info', text: 'Sending report via Gmail...' });
      const authToken = await ensureAuth();
      await sendGmailReport(authToken, emailTo, emailSubject, emailBody);
      setStatusMsg({ type: 'success', text: 'Email sent successfully via Gmail!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to send email.' });
    } finally {
      setLoading(false);
    }
  };

  // Slides Handlers
  const handleCreateSlides = async () => {
    try {
      setLoading(true);
      setStatusMsg({ type: 'info', text: 'Generating Google Slides presentation...' });
      const authToken = await ensureAuth();
      const presentation = await createSparkExecutiveDeck(authToken, slideTitle, activeCode, {
        shufflePartitions,
        aqeEnabled,
        estimatedSpeedup: speedup,
        memorySaved
      });
      setStatusMsg({
        type: 'success',
        text: `Slides presentation created successfully! ID: ${presentation.presentationId}`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create Google Slides.' });
    } finally {
      setLoading(false);
    }
  };

  // Tasks Handlers
  const handleLoadTasks = async () => {
    try {
      setLoading(true);
      const authToken = await ensureAuth();
      const items = await listTasks(authToken);
      setTasksList(items);
      setStatusMsg({ type: 'success', text: 'Loaded Google Tasks successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to fetch tasks.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      setLoading(true);
      const authToken = await ensureAuth();
      await createGoogleTask(authToken, {
        title: newTaskTitle,
        notes: `Task created from Spark Studio on ${new Date().toLocaleDateString()}`
      });
      setNewTaskTitle('');
      await handleLoadTasks();
      setStatusMsg({ type: 'success', text: 'Task added to Google Tasks!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add task.' });
    } finally {
      setLoading(false);
    }
  };

  // Keep Handlers
  const handleCreateKeepNote = async () => {
    try {
      setLoading(true);
      setStatusMsg({ type: 'info', text: 'Saving note to Google Keep...' });
      const authToken = await ensureAuth();
      await createGoogleKeepNote(authToken, keepTitle, keepBody);
      setStatusMsg({ type: 'success', text: 'Note created in Google Keep!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save note to Google Keep.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Google Workspace Integrations
              </h2>
              <p className="text-xs text-slate-400">
                Gmail • Google Slides • Google Tasks • Google Keep
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between ${
            statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/20' :
            statusMsg.type === 'error' ? 'bg-red-500/10 text-red-300 border-b border-red-500/20' :
            'bg-amber-500/10 text-amber-300 border-b border-amber-500/20'
          }`}>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 space-x-2 overflow-x-auto text-xs">
          <button
            onClick={() => { setActiveTab('gmail'); setStatusMsg(null); }}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'gmail'
                ? 'border-red-500 text-red-400 bg-red-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4 text-red-400" />
            <span>Gmail Reports</span>
          </button>

          <button
            onClick={() => { setActiveTab('slides'); setStatusMsg(null); }}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'slides'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Presentation className="w-4 h-4 text-amber-400" />
            <span>Google Slides</span>
          </button>

          <button
            onClick={() => { setActiveTab('tasks'); setStatusMsg(null); handleLoadTasks(); }}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'tasks'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span>Google Tasks</span>
          </button>

          <button
            onClick={() => { setActiveTab('keep'); setStatusMsg(null); }}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'keep'
                ? 'border-amber-400 text-amber-300 bg-amber-400/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4 text-amber-300" />
            <span>Google Keep</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: GMAIL */}
          {activeTab === 'gmail' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="data-eng-team@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Report Body
                </label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSendEmail}
                  disabled={loading || !emailTo}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Sending...' : 'Send Gmail Report'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE SLIDES */}
          {activeTab === 'slides' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Presentation Deck Title
                </label>
                <input
                  type="text"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shuffle Partitions
                  </label>
                  <input
                    type="number"
                    value={shufflePartitions}
                    onChange={(e) => setShufflePartitions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    AQE Skew Join Handling
                  </label>
                  <select
                    value={aqeEnabled ? 'true' : 'false'}
                    onChange={(e) => setAqeEnabled(e.target.value === 'true')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="true">Enabled (Adaptive Execution)</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Speedup Metric
                </label>
                <input
                  type="text"
                  value={speedup}
                  onChange={(e) => setSpeedup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateSlides}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Presentation className="w-4 h-4" />
                  <span>{loading ? 'Creating Deck...' : 'Generate Google Slides Deck'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Optimize shuffle spill memory in Stage 4"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={handleAddTask}
                  disabled={loading || !newTaskTitle.trim()}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-3 max-h-60 overflow-y-auto divide-y divide-slate-800/80">
                {tasksList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No pending tasks found in Google Tasks. Add one above!
                  </p>
                ) : (
                  tasksList.map((t, idx) => (
                    <div key={t.id || idx} className="py-2.5 flex items-start space-x-3 text-xs">
                      <div className="w-4 h-4 rounded border border-slate-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-200">{t.title}</p>
                        {t.notes && <p className="text-slate-400 text-[11px] mt-0.5">{t.notes}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GOOGLE KEEP */}
          {activeTab === 'keep' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Keep Note Title
                </label>
                <input
                  type="text"
                  value={keepTitle}
                  onChange={(e) => setKeepTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Note Content (PySpark Snippets or Plan Context)
                </label>
                <textarea
                  rows={6}
                  value={keepBody}
                  onChange={(e) => setKeepBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateKeepNote}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Save to Google Keep'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
