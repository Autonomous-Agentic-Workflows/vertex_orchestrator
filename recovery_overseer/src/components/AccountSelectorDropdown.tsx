import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Database, 
  ShieldCheck, 
  Check, 
  ChevronDown, 
  Plus, 
  Trash2, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Server,
  Layers,
  Sparkles,
  X
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

export interface CloudSqlAccountContext {
  id: string;
  name: string;
  email: string;
  instanceConnectionName: string;
  database: string;
  role: 'Owner' | 'Developer' | 'Analyst' | 'Service Account';
  region: string;
  isDefault?: boolean;
}

const DEFAULT_ACCOUNTS: CloudSqlAccountContext[] = [
  {
    id: 'prod-primary',
    name: 'Production Primary Admin',
    email: 'jaylang085@gmail.com',
    instanceConnectionName: 'spark-studio:us-west2:spark-pg-prod',
    database: 'spark_studio_db',
    role: 'Owner',
    region: 'us-west2',
    isDefault: true,
  },
  {
    id: 'dev-engineering',
    name: 'Data Engineering Dev Context',
    email: 'dev-spark-engineer@spark-studio.iam.gserviceaccount.com',
    instanceConnectionName: 'spark-studio:us-west2:spark-pg-dev',
    database: 'spark_dev_db',
    role: 'Developer',
    region: 'us-west2',
  },
  {
    id: 'analytics-staging',
    name: 'Analytics Staging Context',
    email: 'analytics-reader@spark-studio.iam.gserviceaccount.com',
    instanceConnectionName: 'spark-studio:us-central1:analytics-pg-staging',
    database: 'analytics_staging_db',
    role: 'Analyst',
    region: 'us-central1',
  },
];

interface AccountSelectorDropdownProps {
  currentUser: FirebaseUser | null;
  isAuthLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AccountSelectorDropdown: React.FC<AccountSelectorDropdownProps> = ({
  currentUser,
  isAuthLoading,
  onSignIn,
  onSignOut,
}) => {
  const [accounts, setAccounts] = useState<CloudSqlAccountContext[]>(() => {
    try {
      const saved = localStorage.getItem('spark_cloudsql_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load Cloud SQL accounts from localStorage', e);
    }
    return DEFAULT_ACCOUNTS;
  });

  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem('spark_active_cloudsql_account_id');
      if (savedActive) return savedActive;
    } catch (e) {
      // fallback
    }
    return DEFAULT_ACCOUNTS[0].id;
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New account form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newInstance, setNewInstance] = useState('');
  const [newDatabase, setNewDatabase] = useState('spark_app_db');
  const [newRole, setNewRole] = useState<'Owner' | 'Developer' | 'Analyst' | 'Service Account'>('Developer');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update account array if user logs in
  useEffect(() => {
    if (currentUser) {
      setAccounts(prev => {
        const updated = prev.map(acc => {
          if (acc.id === 'prod-primary') {
            return {
              ...acc,
              email: currentUser.email || acc.email,
              name: currentUser.displayName ? `${currentUser.displayName} (Primary)` : acc.name,
            };
          }
          return acc;
        });
        localStorage.setItem('spark_cloudsql_accounts', JSON.stringify(updated));
        return updated;
      });
    }
  }, [currentUser]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || DEFAULT_ACCOUNTS[0];

  const handleSelectAccount = (acc: CloudSqlAccountContext) => {
    setActiveAccountId(acc.id);
    localStorage.setItem('spark_active_cloudsql_account_id', acc.id);
    setToastMessage(`Switched Cloud SQL context to ${acc.name}`);
    setTimeout(() => setToastMessage(null), 3000);
    setIsOpen(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newInstance.trim()) return;

    const newAcc: CloudSqlAccountContext = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim() || (currentUser?.email || 'custom-user@spark-studio.io'),
      instanceConnectionName: newInstance.trim(),
      database: newDatabase.trim() || 'spark_custom_db',
      role: newRole,
      region: newInstance.includes(':') ? newInstance.split(':')[1] : 'us-west2',
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    localStorage.setItem('spark_cloudsql_accounts', JSON.stringify(updated));
    setActiveAccountId(newAcc.id);
    localStorage.setItem('spark_active_cloudsql_account_id', newAcc.id);

    // Reset form
    setNewName('');
    setNewEmail('');
    setNewInstance('');
    setNewDatabase('spark_app_db');
    setShowAddForm(false);
    setToastMessage(`Added and switched to ${newAcc.name}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteAccount = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = accounts.filter(a => a.id !== idToDelete);
    if (updated.length === 0) return;
    setAccounts(updated);
    localStorage.setItem('spark_cloudsql_accounts', JSON.stringify(updated));
    if (activeAccountId === idToDelete) {
      setActiveAccountId(updated[0].id);
      localStorage.setItem('spark_active_cloudsql_account_id', updated[0].id);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Account Selector Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm text-slate-200"
        title="Switch Cloud SQL Account Context"
      >
        <div className="relative flex items-center justify-center">
          {currentUser && currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full border border-emerald-500/50" referrerPolicy="no-referrer" />
          ) : (
            <div className="p-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/30">
              <Database className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
        </div>

        <div className="text-left hidden sm:block max-w-[130px] truncate">
          <div className="text-[11px] font-semibold text-slate-100 truncate flex items-center space-x-1">
            <span>{activeAccount.name}</span>
          </div>
          <div className="text-[9px] font-mono text-slate-400 truncate">
            {activeAccount.database}
          </div>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/80 animate-in fade-in zoom-in-95">
          {/* Header section */}
          <div className="p-3.5 bg-slate-950/90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">Cloud SQL Account Contexts</h4>
                <p className="text-[10px] text-slate-400">Switch database credentials & IAM access</p>
              </div>
            </div>

            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span>Connected</span>
            </span>
          </div>

          {/* Account Context List */}
          <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              return (
                <div
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc)}
                  className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/40 text-slate-100 ring-1 ring-amber-500/30'
                      : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-1.5 rounded-lg text-xs ${isActive ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-xs text-white">{acc.name}</span>
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
                            {acc.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                          {acc.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {isActive && (
                        <div className="p-1 bg-amber-500/20 text-amber-400 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {!acc.isDefault && (
                        <button
                          onClick={(e) => handleDeleteAccount(acc.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all"
                          title="Remove Context"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connection Detail Footprint */}
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate max-w-[190px]" title={acc.instanceConnectionName}>
                      {acc.instanceConnectionName}
                    </span>
                    <span className="text-amber-400/90 font-semibold">{acc.database}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Custom Account Form Toggle */}
          <div className="p-2.5 bg-slate-950/80">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Cloud SQL Account Context</span>
              </button>
            ) : (
              <form onSubmit={handleAddAccount} className="space-y-2.5 p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-semibold text-white">Register Cloud SQL Context</span>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Account / Profile Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Analytics Read-Only Account"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Cloud SQL Instance Connection Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="project:region:instance-id"
                    value={newInstance}
                    onChange={e => setNewInstance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Database Name:</label>
                    <input
                      type="text"
                      value={newDatabase}
                      onChange={e => setNewDatabase(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">IAM Role:</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="Developer">Developer</option>
                      <option value="Owner">Owner</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Service Account">Service Account</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1 flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                  >
                    Save Context
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* User Auth Integration Footer */}
          <div className="p-3 bg-slate-950 flex items-center justify-between text-xs">
            {currentUser ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300 font-medium text-[11px] truncate max-w-[150px]">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors"
                >
                  <LogOut className="w-3 h-3 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-slate-400 text-[11px]">Firebase Auth: Disconnected</span>
                <button
                  onClick={onSignIn}
                  disabled={isAuthLoading}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-medium transition-colors"
                >
                  <LogIn className="w-3 h-3 text-emerald-400" />
                  <span>Google Auth</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
