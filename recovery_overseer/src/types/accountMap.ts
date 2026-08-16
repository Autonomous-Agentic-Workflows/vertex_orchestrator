export type ServiceType = 
  | 'drive' 
  | 'gmail' 
  | 'slides' 
  | 'tasks' 
  | 'keep' 
  | 'identity' 
  | 'spark_engine' 
  | 'cloud_sql' 
  | 'firestore'
  | 'mcp_server';

export interface ServiceNode {
  id: string;
  name: string;
  serviceType: ServiceType;
  category: 'Workspace' | 'Compute Engine' | 'Database & Storage' | 'IAM & Security' | 'AI Protocol';
  description: string;
  icon?: string;
  status: 'connected' | 'authorized' | 'active' | 'syncing' | 'idle';
  accountEmail: string;
  scopes: string[];
  x?: number;
  y?: number;
  dataStats: {
    artifactsCount: number;
    lastSynced: string;
    bandwidth: string;
    avgLatencyMs: number;
  };
  security: {
    protocol: string;
    encryption: string;
    authType: string;
  };
}

export interface ServiceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  dataFlowType: 'Bidirectional' | 'Egress' | 'Ingress';
  payloadType: 'PySpark Script' | 'JSON Telemetry' | 'OAuth Token' | 'Slide Deck' | 'Email Report' | 'Task Item' | 'Note' | 'SQL Query' | 'MCP RPC';
  frequency: 'Real-time' | 'On-Demand' | 'Event-Driven' | 'Batch';
  bandwidthUsage: string;
  activePulse?: boolean;
}

export interface AccountMapTopology {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  lastUpdated: string;
  totalConnections: number;
}
