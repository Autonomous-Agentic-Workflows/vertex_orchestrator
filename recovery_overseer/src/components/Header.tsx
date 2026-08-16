import React, { useState, useEffect } from 'react';
import { Flame, Cpu, Workflow, Database, Code2, Settings, Sparkles, Activity, HardDrive, Bot, ExternalLink, Network, LayoutGrid, Cloud } from 'lucide-react';
import { ClusterConfig } from '../types/spark';
import { googleSignIn, logoutUser, initAuth } from '../lib/firebase';
import { saveUserMetadata } from '../lib/firestoreService';
import { User as FirebaseUser } from 'firebase/auth';
import { AccountSelectorDropdown } from './AccountSelectorDropdown';

interface HeaderProps {
  activeTab: 'notebook' | 'dag' | 'webui' | 'pipeline' | 'catalog' | 'pathways' | 'accountmap';
  setActiveTab: (tab: 'notebook' | 'dag' | 'webui' | 'pipeline' | 'catalog' | 'pathways' | 'accountmap') => void;
  clusterConfig: ClusterConfig;
  onOpenSettings: () => void;
  onOpenAiAssist: () => void;
  onOpenDrivePicker: () => void;
  onOpenWorkspaceTools: () => void;
  onOpenJulesAgent: () => void;
  onOpenMcpHub?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  clusterConfig,
  onOpenSettings,
  onOpenAiAssist,
  onOpenDrivePicker,
  onOpenWorkspaceTools,
  onOpenJulesAgent,
  onOpenMcpHub,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      saveUserMetadata(user).catch(console.error);
    }, () => {
      setCurrentUser(null);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      await googleSignIn();
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Version */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 p-2 rounded-xl shadow-lg shadow-orange-500/20 text-white flex items-center justify-center">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  Spark Studio
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Spark v3.5.1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Apache Spark Analytics • Jules & Gemini Spark Integrated
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('notebook')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'notebook'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Notebook</span>
            </button>

            <button
              onClick={() => setActiveTab('dag')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dag'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Workflow className="w-4 h-4" />
              <span>Catalyst DAG</span>
            </button>

            <button
              onClick={() => setActiveTab('webui')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'webui'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Spark Web UI</span>
            </button>

            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Pipeline Builder</span>
            </button>

            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'catalog'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Data Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab('pathways')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'pathways'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Network className="w-4 h-4 text-amber-400" />
              <span>Neurite Pathways</span>
            </button>

            <button
              onClick={() => setActiveTab('accountmap')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'accountmap'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>Account Map</span>
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* MCP Integration Hub Button */}
            {onOpenMcpHub && (
              <button
                onClick={onOpenMcpHub}
                className="flex items-center space-x-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
                title="Model Context Protocol (MCP) Integration for AI Apps"
              >
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden xl:inline">MCP Bridge</span>
              </button>
            )}

            {/* Jules AI Agent Button */}
            <button
              onClick={onOpenJulesAgent}
              className="flex items-center space-x-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Launch Jules Autonomous Code Agent"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Jules Agent</span>
            </button>

            {/* Gemini Spark Link */}
            <a
              href="https://gemini.google.com/spark"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1 bg-gradient-to-r from-orange-500/15 to-red-500/15 hover:from-orange-500/25 hover:to-red-500/25 text-orange-300 border border-orange-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Gemini Spark Portal (gemini.google.com/spark)"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Gemini Spark</span>
              <ExternalLink className="w-3 h-3 text-orange-400/80" />
            </a>

            {/* Google Workspace Suite Tools */}
            <button
              onClick={onOpenWorkspaceTools}
              className="flex items-center space-x-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Gmail, Google Slides, Google Tasks, Google Keep"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Workspace</span>
            </button>

            {/* Google Drive & Picker Button */}
            <button
              onClick={onOpenDrivePicker}
              className="flex items-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Open Google Drive & Google Picker"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Drive</span>
            </button>

            {/* AI Assist Button */}
            <button
              onClick={onOpenAiAssist}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Spark AI</span>
            </button>

            {/* Account & Cloud SQL Context Dropdown */}
            <AccountSelectorDropdown
              currentUser={currentUser}
              isAuthLoading={isAuthLoading}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
              title="Cluster & Database Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('notebook')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'notebook' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
          >
            Notebook
          </button>
          <button
            onClick={() => setActiveTab('dag')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'dag' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
          >
            Catalyst DAG
          </button>
          <button
            onClick={() => setActiveTab('webui')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'webui' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
          >
            Spark Web UI
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'pipeline' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
          >
            Pipeline Builder
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'catalog' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
          >
            Data Catalog
          </button>
          <button
            onClick={() => setActiveTab('pathways')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'pathways' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
          >
            Neurite Pathways
          </button>
          <button
            onClick={() => setActiveTab('accountmap')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg ${activeTab === 'accountmap' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
          >
            Account Map
          </button>
        </div>
      </div>
    </header>
  );
};
