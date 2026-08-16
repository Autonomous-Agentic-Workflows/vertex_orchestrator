import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Network, 
  User, 
  Smartphone, 
  Database, 
  Server, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Search, 
  Filter, 
  RefreshCw, 
  Plus, 
  ChevronRight, 
  Lock, 
  ArrowUpRight, 
  Radio, 
  Cpu, 
  Cloud, 
  Layers, 
  Sliders, 
  X,
  Play,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type NodeType = 'account' | 'device' | 'resource';
export type PathwayStatus = 'firing' | 'active' | 'syncing' | 'idle' | 'restricted';

export interface NeuriteNode {
  id: string;
  name: string;
  type: NodeType;
  subType: string;
  address: string;
  x: number;
  y: number;
  status: 'online' | 'busy' | 'syncing' | 'offline';
  activationFunction: string;
  inputMechanism: string;
  outputMechanism: string;
  throughput: string;
  memoryFootprint: string;
  connectedCount: number;
  details: {
    owner?: string;
    os?: string;
    region?: string;
    securityLevel?: string;
    lastPing?: string;
  };
}

export interface NeuritePathway {
  id: string;
  sourceId: string;
  targetId: string;
  protocol: string;
  status: PathwayStatus;
  bandwidth: string;
  latencyMs: number;
  synapticWeight: number; // 0.1 to 1.0
  encrypted: boolean;
}

const INITIAL_NODES: NeuriteNode[] = [
  // Accounts
  {
    id: 'acc-admin',
    name: 'Primary Admin Account',
    type: 'account',
    subType: 'Firebase / Google IAM',
    address: 'jaylang085@gmail.com',
    x: 180,
    y: 120,
    status: 'online',
    activationFunction: 'OAuth 2.0 PKCE Sigmoid',
    inputMechanism: 'Google Identity Token / WebAuthn',
    outputMechanism: 'Signed JWT Bearer & Scopes',
    throughput: '1.2k ops/sec',
    memoryFootprint: '64 MB',
    connectedCount: 4,
    details: { owner: 'Jay Lang (Primary Owner)', region: 'us-west2', securityLevel: 'Tier 1 Admin' }
  },
  {
    id: 'acc-dev-sa',
    name: 'Spark Engineer Service Acc',
    type: 'account',
    subType: 'IAM Service Account',
    address: 'dev-spark-engineer@spark-studio.iam',
    x: 180,
    y: 320,
    status: 'online',
    activationFunction: 'Key-Based Asymmetric Threshold',
    inputMechanism: 'gRPC mTLS Credentials',
    outputMechanism: 'Short-lived Auth Tokens',
    throughput: '4.8k ops/sec',
    memoryFootprint: '128 MB',
    connectedCount: 3,
    details: { owner: 'System Automation', region: 'us-west2', securityLevel: 'Tier 2 Developer' }
  },
  {
    id: 'acc-analytics-sa',
    name: 'Analytics Reader Context',
    type: 'account',
    subType: 'Read-Only Service Context',
    address: 'analytics-reader@spark-studio.iam',
    x: 180,
    y: 520,
    status: 'online',
    activationFunction: 'LeakyReLU Rate Limiter',
    inputMechanism: 'Restricted Connection String',
    outputMechanism: 'Read-Only Data Frames',
    throughput: '850 ops/sec',
    memoryFootprint: '32 MB',
    connectedCount: 2,
    details: { owner: 'Analytics Workgroup', region: 'us-central1', securityLevel: 'Tier 3 Analyst' }
  },

  // Devices
  {
    id: 'dev-primary-workstation',
    name: 'Primary Workstation Engine',
    type: 'device',
    subType: 'Cloud Run Container',
    address: 'spark-app-container:3000',
    x: 480,
    y: 200,
    status: 'online',
    activationFunction: 'Softmax Load Balancer',
    inputMechanism: 'HTTP/2 Reverse Proxy & WS',
    outputMechanism: 'React Canvas / REST Payload',
    throughput: '12.5 GB/s',
    memoryFootprint: '4.2 GB',
    connectedCount: 6,
    details: { os: 'Linux (Debian Container)', region: 'us-west2', lastPing: '0.2ms ago' }
  },
  {
    id: 'dev-spark-driver',
    name: 'Edge Spark Driver Node',
    type: 'device',
    subType: 'PySpark Master Node',
    address: 'driver-node-us-west2:4040',
    x: 480,
    y: 440,
    status: 'busy',
    activationFunction: 'Adaptive Query Activation (AQE)',
    inputMechanism: 'PySpark Catalyst AST Pipelines',
    outputMechanism: 'DAG Execution Tasks & Partition Vectors',
    throughput: '38.4 GB/s',
    memoryFootprint: '8.0 GB',
    connectedCount: 5,
    details: { os: 'Spark JVM 3.5.1', region: 'us-west2', lastPing: '1.1ms ago' }
  },
  {
    id: 'dev-mobile-admin',
    name: 'Mobile Admin Edge Console',
    type: 'device',
    subType: 'iOS Client App',
    address: 'device-id-883a9f-mobile',
    x: 480,
    y: 620,
    status: 'syncing',
    activationFunction: 'Biometric TouchID Pulse',
    inputMechanism: 'Touch / Push Notifications',
    outputMechanism: 'Telemetry Logs & Command Actions',
    throughput: '120 KB/s',
    memoryFootprint: '45 MB',
    connectedCount: 2,
    details: { os: 'iOS 17.4', region: 'Mobile Remote', lastPing: '14ms ago' }
  },

  // Shared Data Resources
  {
    id: 'res-cloudsql',
    name: 'Cloud SQL PostgreSQL',
    type: 'resource',
    subType: 'Relational DB Instance',
    address: 'spark-studio:us-west2:spark-pg-prod',
    x: 820,
    y: 130,
    status: 'online',
    activationFunction: 'ACID Transaction Pipeline',
    inputMechanism: 'Drizzle ORM Connection Pool',
    outputMechanism: 'Normalized SQL Result Sets',
    throughput: '8.4k qps',
    memoryFootprint: '16.0 GB',
    connectedCount: 4,
    details: { region: 'us-west2', securityLevel: 'SSL Encrypted', lastPing: '2ms' }
  },
  {
    id: 'res-gdrive',
    name: 'Google Drive Repository',
    type: 'resource',
    subType: 'Cloud Workspace Storage',
    address: 'drive.google.com/pyspark_jobs',
    x: 820,
    y: 330,
    status: 'online',
    activationFunction: 'OAuth Picker Access Token',
    inputMechanism: 'Google Picker API REST Handshake',
    outputMechanism: 'PySpark & SQL Notebook Scripts',
    throughput: '320 MB/s',
    memoryFootprint: 'Cloud Managed',
    connectedCount: 3,
    details: { region: 'Global Workspace', securityLevel: 'Scoped OAuth 2.0', lastPing: '45ms' }
  },
  {
    id: 'res-firestore',
    name: 'Firestore Neurite Context',
    type: 'resource',
    subType: 'Document Database',
    address: 'ai-studio-neuriteoverseer-732a3e30',
    x: 820,
    y: 510,
    status: 'online',
    activationFunction: 'Realtime WebSocket Listener',
    inputMechanism: 'Firebase Admin SDK / Firestore Rules',
    outputMechanism: 'JSON State & Applet Metadata',
    throughput: '2.1k doc ops/sec',
    memoryFootprint: 'Cloud Managed',
    connectedCount: 4,
    details: { region: 'us-central1', securityLevel: 'Firestore Security Rules', lastPing: '8ms' }
  },
  {
    id: 'res-gcs-lake',
    name: 'GCS Data Lakehouse',
    type: 'resource',
    subType: 'Object Lake Storage',
    address: 'gs://spark-warehouse/sales_parquet',
    x: 820,
    y: 660,
    status: 'online',
    activationFunction: 'Parquet Scan Streamer',
    inputMechanism: 'Spark S3A / GCS Connector',
    outputMechanism: 'Partitioned Parquet / Delta Logs',
    throughput: '450.0 MB/s',
    memoryFootprint: '500 TB Capacity',
    connectedCount: 2,
    details: { region: 'us-west2 (Multi-Region)', securityLevel: 'Bucket IAM Managed', lastPing: '18ms' }
  }
];

const INITIAL_PATHWAYS: NeuritePathway[] = [
  { id: 'pw-1', sourceId: 'acc-admin', targetId: 'dev-primary-workstation', protocol: 'OAuth 2.0 / HTTPS', status: 'firing', bandwidth: '1.2 GB/s', latencyMs: 2, synapticWeight: 0.95, encrypted: true },
  { id: 'pw-2', sourceId: 'acc-admin', targetId: 'res-firestore', protocol: 'Firebase Admin Token', status: 'active', bandwidth: '450 MB/s', latencyMs: 6, synapticWeight: 0.88, encrypted: true },
  { id: 'pw-3', sourceId: 'acc-admin', targetId: 'res-gdrive', protocol: 'Google Picker OAuth', status: 'syncing', bandwidth: '120 MB/s', latencyMs: 35, synapticWeight: 0.75, encrypted: true },
  { id: 'pw-4', sourceId: 'acc-dev-sa', targetId: 'dev-spark-driver', protocol: 'gRPC / mTLS', status: 'firing', bandwidth: '8.4 GB/s', latencyMs: 1, synapticWeight: 0.98, encrypted: true },
  { id: 'pw-5', sourceId: 'acc-dev-sa', targetId: 'res-cloudsql', protocol: 'Drizzle TCP Pool', status: 'active', bandwidth: '2.1 GB/s', latencyMs: 4, synapticWeight: 0.90, encrypted: true },
  { id: 'pw-6', sourceId: 'acc-analytics-sa', targetId: 'res-cloudsql', protocol: 'PostgreSQL Read-Replica', status: 'active', bandwidth: '650 MB/s', latencyMs: 12, synapticWeight: 0.65, encrypted: true },
  { id: 'pw-7', sourceId: 'dev-primary-workstation', targetId: 'res-cloudsql', protocol: 'PostgreSQL SSL Wire', status: 'firing', bandwidth: '4.8 GB/s', latencyMs: 3, synapticWeight: 0.92, encrypted: true },
  { id: 'pw-8', sourceId: 'dev-primary-workstation', targetId: 'dev-spark-driver', protocol: 'REST PySpark Gateway', status: 'firing', bandwidth: '12.0 GB/s', latencyMs: 1, synapticWeight: 0.99, encrypted: true },
  { id: 'pw-9', sourceId: 'dev-spark-driver', targetId: 'res-gcs-lake', protocol: 'GCS Parquet I/O', status: 'firing', bandwidth: '18.5 GB/s', latencyMs: 14, synapticWeight: 0.94, encrypted: true },
  { id: 'pw-10', sourceId: 'dev-mobile-admin', targetId: 'dev-primary-workstation', protocol: 'WebSocket / TLS 1.3', status: 'syncing', bandwidth: '85 KB/s', latencyMs: 24, synapticWeight: 0.55, encrypted: true },
  { id: 'pw-11', sourceId: 'dev-primary-workstation', targetId: 'res-gdrive', protocol: 'Google Drive API v3', status: 'idle', bandwidth: '300 MB/s', latencyMs: 42, synapticWeight: 0.70, encrypted: true },
  { id: 'pw-12', sourceId: 'dev-primary-workstation', targetId: 'res-firestore', protocol: 'Firestore SDK WS', status: 'active', bandwidth: '800 MB/s', latencyMs: 7, synapticWeight: 0.85, encrypted: true },
];

export const NeuritePathwayGraph: React.FC = () => {
  const [nodes, setNodes] = useState<NeuriteNode[]>(INITIAL_NODES);
  const [pathways, setPathways] = useState<NeuritePathway[]>(INITIAL_PATHWAYS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('dev-primary-workstation');
  const [selectedPathwayId, setSelectedPathwayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'account' | 'device' | 'resource'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PathwayStatus>('all');
  const [isEnergized, setIsEnergized] = useState<boolean>(true);
  const [pulseCount, setPulseCount] = useState<number>(0);
  const [showAddNodeModal, setShowAddNodeModal] = useState<boolean>(false);

  // New Node Form state
  const [newNodeName, setNewName] = useState('');
  const [newNodeType, setNewType] = useState<NodeType>('device');
  const [newNodeAddress, setNewAddress] = useState('');
  const [newNodeSubType, setNewSubType] = useState('Custom Edge Unit');

  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger pulse animation counter
  const handleFireImpulse = () => {
    setPulseCount(prev => prev + 1);
  };

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const selectedPathway = useMemo(() => {
    return pathways.find(p => p.id === selectedPathwayId) || null;
  }, [pathways, selectedPathwayId]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            n.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            n.subType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || n.type === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [nodes, searchQuery, categoryFilter]);

  // Connected pathways for the selected node
  const connectedPathways = useMemo(() => {
    if (!selectedNodeId) return [];
    return pathways.filter(p => p.sourceId === selectedNodeId || p.targetId === selectedNodeId);
  }, [pathways, selectedNodeId]);

  // Compute pathway line parameters
  const getLineCoordinates = (pathway: NeuritePathway) => {
    const source = nodes.find(n => n.id === pathway.sourceId);
    const target = nodes.find(n => n.id === pathway.targetId);
    if (!source || !target) return null;

    // Curved SVG path calculation
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const cx1 = source.x + dx * 0.5;
    const cy1 = source.y;
    const cx2 = source.x + dx * 0.5;
    const cy2 = target.y;

    const pathD = `M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`;
    return { source, target, pathD, midX: (source.x + target.x) / 2, midY: (source.y + target.y) / 2 };
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim() || !newNodeAddress.trim()) return;

    const id = `node-custom-${Date.now()}`;
    const newX = newNodeType === 'account' ? 180 : newNodeType === 'device' ? 480 : 820;
    const newY = 250 + (nodes.length * 45) % 350;

    const createdNode: NeuriteNode = {
      id,
      name: newNodeName.trim(),
      type: newNodeType,
      subType: newNodeSubType.trim(),
      address: newNodeAddress.trim(),
      x: newX,
      y: newY,
      status: 'online',
      activationFunction: 'Adaptive Sigmoid Gate',
      inputMechanism: 'Secure Encrypted Channel',
      outputMechanism: 'JSON State Packet',
      throughput: '1.5 GB/s',
      memoryFootprint: '64 MB',
      connectedCount: 1,
      details: { region: 'us-west2', securityLevel: 'Tier 2 Active' }
    };

    setNodes(prev => [...prev, createdNode]);

    // Connect to Primary Workstation by default
    const createdPathway: NeuritePathway = {
      id: `pw-${Date.now()}`,
      sourceId: 'dev-primary-workstation',
      targetId: id,
      protocol: 'gRPC / TLS 1.3',
      status: 'firing',
      bandwidth: '1.8 GB/s',
      latencyMs: 3,
      synapticWeight: 0.85,
      encrypted: true
    };

    setPathways(prev => [...prev, createdPathway]);
    setSelectedNodeId(id);
    setShowAddNodeModal(false);
    setNewName('');
    setNewAddress('');
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'account':
        return <User className="w-4 h-4 text-emerald-400" />;
      case 'device':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'resource':
        return <Database className="w-4 h-4 text-amber-400" />;
    }
  };

  const getNodeBadgeColor = (type: NodeType) => {
    switch (type) {
      case 'account':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'device':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'resource':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-500 rounded-xl text-slate-950 shadow-lg shadow-orange-500/20">
            <Network className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Neurite Pathways Visualizer</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span>Synaptic Graph Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mapping interconnected cognitive pathways between User Accounts, Compute Devices, and Cloud SQL Data Resources
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleFireImpulse}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Fire Synaptic Impulse</span>
          </button>

          <button
            onClick={() => setIsEnergized(!isEnergized)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isEnergized 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isEnergized ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>{isEnergized ? 'Energy Flow: ON' : 'Energy Flow: OFF'}</span>
          </button>

          <button
            onClick={() => setShowAddNodeModal(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Pathway Node</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid: Graph Viewport (Left 8/12) + Synaptic Telemetry Drawer (Right 4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Interactive Canvas */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col relative min-h-[580px] overflow-hidden">
          {/* Header Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-slate-800/80 z-10">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search accounts, devices, resources..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${categoryFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                All Nodes ({nodes.length})
              </button>
              <button
                onClick={() => setCategoryFilter('account')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${categoryFilter === 'account' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Accounts
              </button>
              <button
                onClick={() => setCategoryFilter('device')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${categoryFilter === 'device' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Devices
              </button>
              <button
                onClick={() => setCategoryFilter('resource')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${categoryFilter === 'resource' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Resources
              </button>
            </div>
          </div>

          {/* Graph Column Labels */}
          <div className="grid grid-cols-3 text-center py-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-800/40 z-10">
            <div className="flex items-center justify-center space-x-1 text-emerald-400/80">
              <User className="w-3 h-3" />
              <span>Identity Accounts</span>
            </div>
            <div className="flex items-center justify-center space-x-1 text-cyan-400/80">
              <Smartphone className="w-3 h-3" />
              <span>Compute Devices</span>
            </div>
            <div className="flex items-center justify-center space-x-1 text-amber-400/80">
              <Database className="w-3 h-3" />
              <span>Data Resources</span>
            </div>
          </div>

          {/* Canvas SVG Body */}
          <div ref={containerRef} className="flex-1 relative w-full h-[480px] bg-slate-950/60 rounded-xl mt-3 border border-slate-950 overflow-hidden">
            {/* Background Grid Lines */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20" 
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #334155 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }} 
            />

            <svg className="w-full h-full absolute inset-0 pointer-events-none">
              <defs>
                <linearGradient id="pathway-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id="pathway-gradient-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
                </linearGradient>

                <filter id="glow-synapse" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Render Neurite Pathway Edges */}
              {pathways.map((pathway) => {
                const coords = getLineCoordinates(pathway);
                if (!coords) return null;

                const isConnectedToSelected = selectedNodeId && 
                  (pathway.sourceId === selectedNodeId || pathway.targetId === selectedNodeId);
                const isThisPathwaySelected = selectedPathwayId === pathway.id;

                let strokeColor = '#334155';
                let strokeWidth = Math.max(1.5, pathway.synapticWeight * 3);
                let opacity = selectedNodeId ? (isConnectedToSelected ? 1 : 0.2) : 0.6;

                if (isConnectedToSelected || isThisPathwaySelected) {
                  strokeColor = 'url(#pathway-gradient-highlight)';
                  strokeWidth = 3.5;
                } else if (pathway.status === 'firing') {
                  strokeColor = 'url(#pathway-gradient-active)';
                }

                return (
                  <g key={pathway.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedPathwayId(pathway.id)}>
                    {/* Shadow / Base Line */}
                    <path
                      d={coords.pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                    />

                    {/* Animated Pulsing Signal Impulse Dots */}
                    {isEnergized && (pathway.status === 'firing' || isConnectedToSelected) && (
                      <circle r="3.5" fill="#f59e0b" filter="url(#glow-synapse)">
                        <animateMotion
                          path={coords.pathD}
                          dur={`${2.5 / (pathway.synapticWeight * 1.5)}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Render Neurite Nodes */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnected = selectedNodeId && connectedPathways.some(p => p.sourceId === node.id || p.targetId === node.id);

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    setSelectedPathwayId(null);
                  }}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-20 ${
                    isSelected ? 'scale-110 z-30' : 'hover:scale-105'
                  }`}
                >
                  <div
                    className={`relative p-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center space-x-3 max-w-[210px] ${
                      isSelected
                        ? 'bg-slate-900/95 border-amber-500 ring-2 ring-amber-500/40 text-white shadow-amber-500/20'
                        : isConnected
                        ? 'bg-slate-900/90 border-cyan-500/60 text-slate-100'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {/* Glowing Synaptic Ring */}
                    <div className={`p-2 rounded-xl flex-shrink-0 ${getNodeBadgeColor(node.type)}`}>
                      {getNodeIcon(node.type)}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-xs truncate text-white">{node.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                        {node.subType}
                      </div>
                    </div>

                    {/* Status Pulse Indicator */}
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      {node.status === 'online' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                        node.status === 'online' ? 'bg-emerald-500' : node.status === 'busy' ? 'bg-amber-500' : 'bg-cyan-500'
                      }`} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graph Footer Legend */}
          <div className="pt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 mt-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Account Neurons</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span>Device Neurons</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Resource Neurons</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Synapses Active:</span>
              <span className="text-amber-400 font-bold">{pathways.length} Pathways</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Synaptic Telemetry & Node Inspector */}
        <div className="lg:col-span-4 space-y-4">
          {selectedNode ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${getNodeBadgeColor(selectedNode.type)}`}>
                    {getNodeIcon(selectedNode.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      {selectedNode.type} neuron
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">{selectedNode.name}</h3>
                  </div>
                </div>

                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>

              {/* Cognitive & Activation Mechanism details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>Activation & I/O Telemetry</span>
                </h4>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Activation Function:</span>
                    <span className="text-amber-300 font-semibold">{selectedNode.activationFunction}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Input Mechanism:</span>
                      <span className="text-cyan-300 truncate block" title={selectedNode.inputMechanism}>
                        {selectedNode.inputMechanism}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Output Mechanism:</span>
                      <span className="text-emerald-300 truncate block" title={selectedNode.outputMechanism}>
                        {selectedNode.outputMechanism}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Throughput Rate:</span>
                      <span className="text-slate-200 font-bold">{selectedNode.throughput}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Memory Footprint:</span>
                      <span className="text-slate-200 font-bold">{selectedNode.memoryFootprint}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Synaptic Pathways */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Synaptic Connections ({connectedPathways.length})</span>
                  </span>
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {connectedPathways.map((pw) => {
                    const otherId = pw.sourceId === selectedNode.id ? pw.targetId : pw.sourceId;
                    const otherNode = nodes.find(n => n.id === otherId);
                    if (!otherNode) return null;

                    return (
                      <div
                        key={pw.id}
                        onClick={() => setSelectedPathwayId(pw.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          selectedPathwayId === pw.id
                            ? 'bg-amber-500/10 border-amber-500/50 text-white'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <div className={`p-1 rounded ${getNodeBadgeColor(otherNode.type)}`}>
                            {getNodeIcon(otherNode.type)}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold block truncate text-slate-200">{otherNode.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{pw.protocol}</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 font-mono text-[10px]">
                          <span className="text-emerald-400 block">{pw.bandwidth}</span>
                          <span className="text-slate-400">{pw.latencyMs}ms</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Node Details & Actions */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                  <span>Address / Endpoint:</span>
                  <span className="text-slate-200 truncate max-w-[170px]" title={selectedNode.address}>
                    {selectedNode.address}
                  </span>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    onClick={handleFireImpulse}
                    className="flex-1 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Test Synapse Pulse</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedNodeId(null);
                      setSelectedPathwayId(null);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-3">
              <Network className="w-8 h-8 text-amber-400/60 mx-auto" />
              <h3 className="text-sm font-bold text-white">Select a Neurite Node</h3>
              <p className="text-xs text-slate-400">
                Click any Account, Device, or Data Resource node on the graph to inspect input/output mechanisms, synaptic throughput, and cognitive activation functions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Pathway Node Modal */}
      {showAddNodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Add Neurite Pathway Node</h3>
              </div>
              <button onClick={() => setShowAddNodeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNode} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Node Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Edge Storage Node B"
                  value={newNodeName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Neuron Category:</label>
                <select
                  value={newNodeType}
                  onChange={e => setNewType(e.target.value as NodeType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="account">Account Neuron (IAM / Identity)</option>
                  <option value="device">Device Neuron (Compute / Container / Mobile)</option>
                  <option value="resource">Data Resource Neuron (Cloud SQL / Lakehouse)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">SubType / Specification:</label>
                <input
                  type="text"
                  value={newNodeSubType}
                  onChange={e => setNewSubType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Address / Connection Endpoint:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. spark-node-4:50051"
                  value={newNodeAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-colors"
                >
                  Create & Connect Node
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddNodeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
