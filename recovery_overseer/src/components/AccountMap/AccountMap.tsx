import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Cloud, 
  HardDrive, 
  Mail, 
  Presentation, 
  CheckSquare, 
  Bookmark, 
  ShieldCheck, 
  Cpu, 
  Database, 
  Flame, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  Activity, 
  Zap, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ExternalLink, 
  Search, 
  Filter, 
  Play, 
  Sliders, 
  Sparkles, 
  FileCode, 
  Server, 
  Key, 
  Lock, 
  Share2, 
  Copy, 
  Check, 
  ChevronRight,
  Bot
} from 'lucide-react';
import { ServiceNode, ServiceEdge, ServiceType, AccountMapTopology } from '../../types/accountMap';
import { getAccessToken, googleSignIn } from '../../lib/firebase';

interface AccountMapProps {
  onOpenWorkspaceTools?: () => void;
  onOpenMcpHub?: () => void;
  onOpenDrivePicker?: () => void;
}

const INITIAL_NODES: ServiceNode[] = [
  {
    id: 'google-iam-identity',
    name: 'Google IAM & Identity',
    serviceType: 'identity',
    category: 'IAM & Security',
    description: 'Master OAuth 2.0 PKCE authentication, scopes authority, and user session keys.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/userinfo.email'],
    status: 'authorized',
    x: 180,
    y: 110,
    dataStats: { artifactsCount: 1, lastSynced: 'Just now', bandwidth: '4.2 KB/s', avgLatencyMs: 38 },
    security: { protocol: 'OAuth 2.0 / PKCE', encryption: 'TLS 1.3 / AES-256', authType: 'Bearer Token' },
  },
  {
    id: 'google-drive',
    name: 'Google Drive & Picker',
    serviceType: 'drive',
    category: 'Workspace',
    description: 'Import and export PySpark scripts, Parquet data files, and shared team notebooks.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
    status: 'connected',
    x: 520,
    y: 90,
    dataStats: { artifactsCount: 14, lastSynced: '1 min ago', bandwidth: '18.4 MB/s', avgLatencyMs: 98 },
    security: { protocol: 'Google Drive REST v3', encryption: 'Google SSE-256', authType: 'OAuth 2.0' },
  },
  {
    id: 'google-gmail',
    name: 'Gmail Dispatcher',
    serviceType: 'gmail',
    category: 'Workspace',
    description: 'Automated Spark pipeline performance audits, skew alerts, and execution reports.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.send'],
    status: 'connected',
    x: 860,
    y: 100,
    dataStats: { artifactsCount: 28, lastSynced: '4 mins ago', bandwidth: '1.2 MB/s', avgLatencyMs: 135 },
    security: { protocol: 'Gmail REST v1 / MIME', encryption: 'TLS 1.3 Strict', authType: 'OAuth 2.0' },
  },
  {
    id: 'google-slides',
    name: 'Google Slides Generator',
    serviceType: 'slides',
    category: 'Workspace',
    description: 'Automated executive deck creation summarizing Catalyst DAG plans and AQE gains.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['https://www.googleapis.com/auth/presentations'],
    status: 'connected',
    x: 880,
    y: 280,
    dataStats: { artifactsCount: 6, lastSynced: '10 mins ago', bandwidth: '8.6 MB/s', avgLatencyMs: 210 },
    security: { protocol: 'Google Slides REST v4', encryption: 'TLS 1.3', authType: 'OAuth 2.0' },
  },
  {
    id: 'google-tasks',
    name: 'Google Tasks Sync',
    serviceType: 'tasks',
    category: 'Workspace',
    description: 'Action items for cluster memory tuning, partition rebalances, and migration todos.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['https://www.googleapis.com/auth/tasks'],
    status: 'connected',
    x: 840,
    y: 470,
    dataStats: { artifactsCount: 9, lastSynced: '3 mins ago', bandwidth: '120 KB/s', avgLatencyMs: 82 },
    security: { protocol: 'Google Tasks REST v1', encryption: 'TLS 1.3', authType: 'OAuth 2.0' },
  },
  {
    id: 'google-keep',
    name: 'Google Keep Notes',
    serviceType: 'keep',
    category: 'Workspace',
    description: 'Scratchpad notes for PySpark SQL snippets, execution logs, and Catalyst rules.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['https://www.googleapis.com/auth/keep'],
    status: 'connected',
    x: 520,
    y: 520,
    dataStats: { artifactsCount: 18, lastSynced: '7 mins ago', bandwidth: '450 KB/s', avgLatencyMs: 90 },
    security: { protocol: 'Google Keep REST v1', encryption: 'TLS 1.3', authType: 'OAuth 2.0' },
  },
  {
    id: 'spark-catalyst-engine',
    name: 'Spark Catalyst Engine',
    serviceType: 'spark_engine',
    category: 'Compute Engine',
    description: 'Core Apache Spark execution runtime, DAG plan generation, AQE optimizer, and metrics engine.',
    accountEmail: 'spark-master@spark-studio.internal',
    scopes: ['internal:spark:catalyst', 'internal:aqe:optimizer'],
    status: 'active',
    x: 520,
    y: 290,
    dataStats: { artifactsCount: 142, lastSynced: 'Live (Real-time)', bandwidth: '142 MB/s', avgLatencyMs: 14 },
    security: { protocol: 'Spark RPC / Netty', encryption: 'mTLS / SASL', authType: 'Internal Token' },
  },
  {
    id: 'cloud-sql-postgres',
    name: 'Cloud SQL (PostgreSQL)',
    serviceType: 'cloud_sql',
    category: 'Database & Storage',
    description: 'Managed relational storage for user accounts, saved notebooks, query history, and metadata.',
    accountEmail: 'jaylang085@gmail.com',
    scopes: ['cloudsql.admin', 'cloudsql.instances.connect'],
    status: 'connected',
    x: 180,
    y: 450,
    dataStats: { artifactsCount: 42, lastSynced: 'Live', bandwidth: '34 MB/s', avgLatencyMs: 22 },
    security: { protocol: 'PostgreSQL Wire 3.0', encryption: 'Cloud SQL Auth Proxy / TLS', authType: 'IAM DB Auth' },
  },
  {
    id: 'mcp-server-hub',
    name: 'Model Context Protocol (MCP)',
    serviceType: 'mcp_server',
    category: 'AI Protocol',
    description: 'Standard JSON-RPC 2.0 / SSE bridge connecting Claude Desktop, Cursor, and AI apps.',
    accountEmail: 'mcp-agent@spark-studio.io',
    scopes: ['mcp:tools:execute', 'mcp:resources:read', 'mcp:prompts:read'],
    status: 'active',
    x: 180,
    y: 280,
    dataStats: { artifactsCount: 9, lastSynced: 'Live (SSE Ready)', bandwidth: '12.4 MB/s', avgLatencyMs: 11 },
    security: { protocol: 'MCP 2024-11-05 (JSON-RPC 2.0 / SSE)', encryption: 'TLS 1.3', authType: 'Bearer / API Key' },
  },
];

const INITIAL_EDGES: ServiceEdge[] = [
  {
    id: 'e-iam-drive',
    source: 'google-iam-identity',
    target: 'google-drive',
    label: 'OAuth 2.0 Scopes & Tokens',
    dataFlowType: 'Bidirectional',
    payloadType: 'OAuth Token',
    frequency: 'Event-Driven',
    bandwidthUsage: '12 KB/s',
  },
  {
    id: 'e-iam-gmail',
    source: 'google-iam-identity',
    target: 'google-gmail',
    label: 'Mail Scopes & Auth Header',
    dataFlowType: 'Bidirectional',
    payloadType: 'OAuth Token',
    frequency: 'Event-Driven',
    bandwidthUsage: '8 KB/s',
  },
  {
    id: 'e-iam-slides',
    source: 'google-iam-identity',
    target: 'google-slides',
    label: 'Presentations Scope & Bearer',
    dataFlowType: 'Bidirectional',
    payloadType: 'OAuth Token',
    frequency: 'Event-Driven',
    bandwidthUsage: '8 KB/s',
  },
  {
    id: 'e-iam-tasks',
    source: 'google-iam-identity',
    target: 'google-tasks',
    label: 'Tasks Auth & Token',
    dataFlowType: 'Bidirectional',
    payloadType: 'OAuth Token',
    frequency: 'Event-Driven',
    bandwidthUsage: '6 KB/s',
  },
  {
    id: 'e-iam-keep',
    source: 'google-iam-identity',
    target: 'google-keep',
    label: 'Keep Auth & Token',
    dataFlowType: 'Bidirectional',
    payloadType: 'OAuth Token',
    frequency: 'Event-Driven',
    bandwidthUsage: '6 KB/s',
  },
  {
    id: 'e-drive-engine',
    source: 'google-drive',
    target: 'spark-catalyst-engine',
    label: 'PySpark Script Import / Parquet',
    dataFlowType: 'Bidirectional',
    payloadType: 'PySpark Script',
    frequency: 'On-Demand',
    bandwidthUsage: '18.4 MB/s',
  },
  {
    id: 'e-engine-slides',
    source: 'spark-catalyst-engine',
    target: 'google-slides',
    label: 'Catalyst DAG Metrics & Charts',
    dataFlowType: 'Egress',
    payloadType: 'Slide Deck',
    frequency: 'On-Demand',
    bandwidthUsage: '8.6 MB/s',
  },
  {
    id: 'e-engine-gmail',
    source: 'spark-catalyst-engine',
    target: 'google-gmail',
    label: 'Optimization Audits & Alerts',
    dataFlowType: 'Egress',
    payloadType: 'Email Report',
    frequency: 'Event-Driven',
    bandwidthUsage: '1.2 MB/s',
  },
  {
    id: 'e-engine-tasks',
    source: 'spark-catalyst-engine',
    target: 'google-tasks',
    label: 'Shuffle & Memory Action Items',
    dataFlowType: 'Egress',
    payloadType: 'Task Item',
    frequency: 'Event-Driven',
    bandwidthUsage: '120 KB/s',
  },
  {
    id: 'e-engine-keep',
    source: 'spark-catalyst-engine',
    target: 'google-keep',
    label: 'PySpark Snippets & Notes',
    dataFlowType: 'Egress',
    payloadType: 'Note',
    frequency: 'On-Demand',
    bandwidthUsage: '450 KB/s',
  },
  {
    id: 'e-engine-cloudsql',
    source: 'spark-catalyst-engine',
    target: 'cloud-sql-postgres',
    label: 'Saved Notebooks & Query Telemetry',
    dataFlowType: 'Bidirectional',
    payloadType: 'SQL Query',
    frequency: 'Real-time',
    bandwidthUsage: '34 MB/s',
  },
  {
    id: 'e-mcp-engine',
    source: 'mcp-server-hub',
    target: 'spark-catalyst-engine',
    label: 'AI Tool Execution & Code Tuning',
    dataFlowType: 'Bidirectional',
    payloadType: 'MCP RPC',
    frequency: 'Real-time',
    bandwidthUsage: '12.4 MB/s',
  },
  {
    id: 'e-mcp-drive',
    source: 'mcp-server-hub',
    target: 'google-drive',
    label: 'External AI Workspace Automation',
    dataFlowType: 'Bidirectional',
    payloadType: 'MCP RPC',
    frequency: 'On-Demand',
    bandwidthUsage: '4.8 MB/s',
  },
];

export const AccountMap: React.FC<AccountMapProps> = ({
  onOpenWorkspaceTools,
  onOpenMcpHub,
  onOpenDrivePicker,
}) => {
  const [nodes, setNodes] = useState<ServiceNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<ServiceEdge[]>(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('spark-catalyst-engine');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isSimulatingFlow, setIsSimulatingFlow] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [copiedScope, setCopiedScope] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const token = getAccessToken();
    setActiveToken(token);
  }, []);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Filter nodes based on category and search query
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchCategory = filterCategory === 'all' || n.category.toLowerCase().includes(filterCategory.toLowerCase());
      const matchSearch = searchQuery === '' || 
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.scopes.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [nodes, filterCategory, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  }, [edges, filteredNodeIds]);

  // Connected edges for the selected node
  const selectedNodeConnections = useMemo(() => {
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [edges, selectedNodeId]);

  const handleSimulateFlow = () => {
    if (isSimulatingFlow) return;
    setIsSimulatingFlow(true);
    setSimulationStep(1);
    setSimulationLogs(['Initiating cross-service Google Workspace & Spark data flow cascade...']);

    const steps = [
      { step: 1, log: '🔑 IAM Auth: Verified OAuth 2.0 PKCE access tokens for Drive, Gmail, Slides, Tasks & Keep.' },
      { step: 2, log: '📂 Google Drive: Imported raw dataset "ecommerce_sales.parquet" & PySpark ETL script.' },
      { step: 3, log: '⚡ Spark Catalyst: Generated physical plan, AQE activated (estimated speedup 3.1x).' },
      { step: 4, log: '🗄️ Cloud SQL: Persisted execution plan telemetry & run metrics into PostgreSQL.' },
      { step: 5, log: '📊 Google Slides: Created executive presentation deck with Catalyst stage metrics.' },
      { step: 6, log: '📧 Gmail: Dispatched automated pipeline optimization audit report to team.' },
      { step: 7, log: '✅ Google Tasks: Added memory tuning & shuffle partition rebalance action items.' },
      { step: 8, log: '📝 Google Keep: Stored PySpark broadcast join snippet to developer scratchpad.' },
      { step: 9, log: '🤖 MCP Hub: Broadcasted tool execution completion to connected AI apps (Claude/Cursor).' },
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setSimulationStep(s.step);
        setSimulationLogs(prev => [...prev, s.log]);
        if (idx === steps.length - 1) {
          setTimeout(() => {
            setIsSimulatingFlow(false);
            setSimulationStep(0);
          }, 2500);
        }
      }, (idx + 1) * 700);
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScope(text);
    setTimeout(() => setCopiedScope(null), 2000);
  };

  const getServiceIcon = (type: ServiceType) => {
    switch (type) {
      case 'drive':
        return <HardDrive className="w-5 h-5 text-emerald-400" />;
      case 'gmail':
        return <Mail className="w-5 h-5 text-rose-400" />;
      case 'slides':
        return <Presentation className="w-5 h-5 text-amber-400" />;
      case 'tasks':
        return <CheckSquare className="w-5 h-5 text-blue-400" />;
      case 'keep':
        return <Bookmark className="w-5 h-5 text-yellow-400" />;
      case 'identity':
        return <ShieldCheck className="w-5 h-5 text-cyan-400" />;
      case 'spark_engine':
        return <Flame className="w-6 h-6 text-orange-400" />;
      case 'cloud_sql':
        return <Database className="w-5 h-5 text-indigo-400" />;
      case 'firestore':
        return <Layers className="w-5 h-5 text-amber-500" />;
      case 'mcp_server':
        return <Bot className="w-5 h-5 text-purple-400" />;
      default:
        return <Cloud className="w-5 h-5 text-slate-400" />;
    }
  };

  const getNodeBorderColor = (type: ServiceType, isSelected: boolean) => {
    if (isSelected) return 'stroke-amber-400 stroke-2';
    switch (type) {
      case 'spark_engine': return 'stroke-orange-500/80';
      case 'drive': return 'stroke-emerald-500/70';
      case 'gmail': return 'stroke-rose-500/70';
      case 'slides': return 'stroke-amber-500/70';
      case 'tasks': return 'stroke-blue-500/70';
      case 'keep': return 'stroke-yellow-500/70';
      case 'identity': return 'stroke-cyan-500/70';
      case 'cloud_sql': return 'stroke-indigo-500/70';
      case 'mcp_server': return 'stroke-purple-500/70';
      default: return 'stroke-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/5 via-orange-500/5 to-transparent rounded-full pointer-events-none blur-3xl" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Google Workspace & Account Dependency Map
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span>Live Graph Active</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              Real-time cross-service data flow map connecting <strong className="text-slate-200 font-semibold">Google Drive, Gmail, Slides, Tasks, Keep</strong> with your <strong className="text-orange-400 font-semibold">Spark Catalyst Engine</strong>, Cloud SQL, and MCP AI clients.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSimulateFlow}
              disabled={isSimulatingFlow}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
                isSimulatingFlow
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSimulatingFlow ? `Simulating Flow (${simulationStep}/9)...` : 'Simulate Workspace Flow'}</span>
            </button>

            {onOpenWorkspaceTools && (
              <button
                onClick={onOpenWorkspaceTools}
                className="flex items-center space-x-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Workspace Tools</span>
              </button>
            )}

            {onOpenMcpHub && (
              <button
                onClick={onOpenMcpHub}
                className="flex items-center space-x-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all"
              >
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span>MCP Hub</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Topology Metrics Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Google Services</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">5 Connected</span>
              <span className="text-[10px] text-emerald-400 font-mono">100% OK</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">OAuth 2.0 Scopes</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">8 Granted</span>
              <span className="text-[10px] text-cyan-400 font-mono">PKCE</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Active Data Streams</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">{filteredEdges.length} Arcs</span>
              <span className="text-[10px] text-amber-400 font-mono">Bi-dir</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Aggregate Throughput</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">184.2 MB/s</span>
              <span className="text-[10px] text-orange-400 font-mono">Spark IO</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Avg RPC Latency</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">18 ms</span>
              <span className="text-[10px] text-emerald-400 font-mono">Ultra-low</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">MCP AI Protocol</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-purple-300 text-sm">JSON-RPC / SSE</span>
              <span className="text-[10px] text-purple-400 font-mono">v2024-11</span>
            </div>
          </div>
        </div>

        {/* Live Simulation Ticker */}
        {isSimulatingFlow && simulationLogs.length > 0 && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span>Workspace Simulation Telemetry Stream</span>
            </div>
            <p className="text-xs text-amber-200/90 font-mono">
              {simulationLogs[simulationLogs.length - 1]}
            </p>
          </div>
        )}
      </div>

      {/* Main Interactive Map & Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Dependency Cloud Graph Canvas */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {[
                { id: 'all', label: 'All Services' },
                { id: 'workspace', label: 'Google Workspace' },
                { id: 'compute', label: 'Compute Engine' },
                { id: 'storage', label: 'Storage & DB' },
                { id: 'iam', label: 'IAM & Security' },
                { id: 'ai', label: 'AI MCP' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    filterCategory === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter services or scopes..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* SVG Dependency Cloud Graph Canvas */}
          <div className="relative w-full h-[520px] bg-slate-950/90 rounded-xl border border-slate-800/80 overflow-hidden select-none">
            {/* Background grid dots */}
            <svg
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#64748b" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dot-grid)" />
            </svg>

            <svg
              ref={svgRef}
              viewBox="0 0 1000 600"
              className="w-full h-full cursor-grab active:cursor-grabbing"
            >
              <defs>
                {/* Glow Filters */}
                <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Arrow markers */}
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-pulse"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Render Edges / Dependency Arcs */}
              {filteredEdges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sx = sourceNode.x || 0;
                const sy = sourceNode.y || 0;
                const tx = targetNode.x || 0;
                const ty = targetNode.y || 0;

                const isConnectedToSelected =
                  sourceNode.id === selectedNodeId || targetNode.id === selectedNodeId;

                // Bezier curve calculation
                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;
                const dx = tx - sx;
                const dy = ty - sy;
                const curveOffset = Math.sin((sx + ty) * 0.01) * 35;
                const cx = midX - dy * 0.15 + curveOffset;
                const cy = midY + dx * 0.15;

                const pathD = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

                return (
                  <g key={edge.id} className="transition-all duration-300">
                    {/* Background wider hit target */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      className="cursor-pointer"
                    />

                    {/* Visible line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isConnectedToSelected ? '#f59e0b' : '#334155'}
                      strokeWidth={isConnectedToSelected ? '2.5' : '1.5'}
                      strokeDasharray={edge.frequency === 'Event-Driven' ? '4,4' : undefined}
                      markerEnd={isConnectedToSelected ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                      className="transition-colors duration-300"
                    />

                    {/* Animated Pulse Particle along path */}
                    {(isConnectedToSelected || isSimulatingFlow) && (
                      <circle r="3.5" fill="#f59e0b">
                        <animateMotion
                          path={pathD}
                          dur={edge.frequency === 'Real-time' ? '2s' : '3.5s'}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Edge Label on hover or selected */}
                    {isConnectedToSelected && (
                      <text
                        x={cx}
                        y={cy - 8}
                        textAnchor="middle"
                        fill="#fde68a"
                        fontSize="9"
                        fontFamily="monospace"
                        className="pointer-events-none drop-shadow"
                      >
                        {edge.payloadType} ({edge.bandwidthUsage})
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Render Nodes */}
              {filteredNodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const nx = node.x || 0;
                const ny = node.y || 0;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${nx}, ${ny})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer group"
                  >
                    {/* Outer selection ring */}
                    {isSelected && (
                      <circle
                        r="38"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        className="animate-spin"
                        style={{ transformOrigin: '0 0', animationDuration: '10s' }}
                      />
                    )}

                    {/* Node Circle Background */}
                    <circle
                      r="30"
                      fill="#0f172a"
                      className={`${getNodeBorderColor(node.serviceType, isSelected)} transition-all duration-200 group-hover:stroke-amber-400`}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />

                    {/* Inner highlight */}
                    <circle
                      r="24"
                      fill={
                        node.serviceType === 'spark_engine'
                          ? '#7c2d12'
                          : node.serviceType === 'mcp_server'
                          ? '#581c87'
                          : '#1e293b'
                      }
                      opacity={isSelected ? 0.9 : 0.6}
                    />

                    {/* Service Icon Text / Marker */}
                    <foreignObject x="-14" y="-14" width="28" height="28" className="pointer-events-none">
                      <div className="w-full h-full flex items-center justify-center">
                        {getServiceIcon(node.serviceType)}
                      </div>
                    </foreignObject>

                    {/* Status Dot */}
                    <circle
                      cx="20"
                      cy="-20"
                      r="4.5"
                      fill={node.status === 'connected' || node.status === 'active' || node.status === 'authorized' ? '#10b981' : '#f59e0b'}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />

                    {/* Node Name Label */}
                    <text
                      y="46"
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                      fontSize="11"
                      fontWeight={isSelected ? 'bold' : '600'}
                      className="pointer-events-none"
                    >
                      {node.name}
                    </text>

                    {/* Category Subtitle */}
                    <text
                      y="59"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="8"
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {node.category}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Bottom Floating Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] text-slate-400 flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Connected / Authorized</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Active Data Stream</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>MCP Protocol</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Service Inspector & Details Drawer */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Service Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                  {getServiceIcon(selectedNode.serviceType)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedNode.name}</h3>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    {selectedNode.category}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                {selectedNode.status.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              {selectedNode.description}
            </p>

            {/* Account & Security Footprint */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Authenticated Account:</span>
                <span className="font-mono text-slate-200 truncate max-w-[170px]" title={selectedNode.accountEmail}>
                  {selectedNode.accountEmail}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Protocol & Auth:</span>
                <span className="font-mono text-amber-300">{selectedNode.security.protocol}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Security Encryption:</span>
                <span className="font-mono text-cyan-300">{selectedNode.security.encryption}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] py-1">
                <span className="text-slate-400">Avg RPC Latency:</span>
                <span className="font-mono text-emerald-400">{selectedNode.dataStats.avgLatencyMs} ms</span>
              </div>
            </div>

            {/* Granted OAuth Scopes */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Authorized Scopes</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{selectedNode.scopes.length} active</span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedNode.scopes.map((scope, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyToClipboard(scope)}
                    className="group flex items-center justify-between p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 cursor-pointer transition-all"
                    title="Click to copy scope URI"
                  >
                    <span className="truncate max-w-[200px]">{scope}</span>
                    {copiedScope === scope ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Service Actions */}
            <div className="pt-2 border-t border-slate-800 flex flex-col space-y-2">
              {selectedNode.serviceType === 'drive' && onOpenDrivePicker && (
                <button
                  onClick={onOpenDrivePicker}
                  className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Launch Google Drive Explorer</span>
                </button>
              )}

              {(selectedNode.serviceType === 'gmail' || 
                selectedNode.serviceType === 'slides' || 
                selectedNode.serviceType === 'tasks' || 
                selectedNode.serviceType === 'keep') && onOpenWorkspaceTools && (
                <button
                  onClick={onOpenWorkspaceTools}
                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open {selectedNode.name} Suite</span>
                </button>
              )}

              {selectedNode.serviceType === 'mcp_server' && onOpenMcpHub && (
                <button
                  onClick={onOpenMcpHub}
                  className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Configure MCP Client Snippets</span>
                </button>
              )}
            </div>
          </div>

          {/* Connected Data Flow Relationships for Selected Node */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white tracking-wide uppercase flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Data Flow Pipelines ({selectedNodeConnections.length})</span>
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {selectedNodeConnections.map((conn) => {
                const isOutbound = conn.source === selectedNodeId;
                const peerId = isOutbound ? conn.target : conn.source;
                const peerNode = nodes.find(n => n.id === peerId);

                return (
                  <div
                    key={conn.id}
                    onClick={() => setSelectedNodeId(peerId)}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                        <span>{isOutbound ? 'Egress ➔' : 'Ingress ⬅'}</span>
                        <span className="text-amber-300">{peerNode?.name || peerId}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{conn.bandwidthUsage}</span>
                    </div>

                    <p className="text-[10px] text-slate-400 truncate">{conn.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
