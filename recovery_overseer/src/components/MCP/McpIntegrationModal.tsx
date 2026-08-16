import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Copy, 
  Check, 
  Terminal, 
  Play, 
  Code, 
  Radio, 
  ShieldCheck, 
  Server, 
  Cpu, 
  Layers, 
  ExternalLink, 
  FileText, 
  Sparkles, 
  Zap, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle,
  Database,
  ArrowRight
} from 'lucide-react';
import { MCP_TOOLS, MCP_RESOURCES, MCP_PROMPTS } from '../../server/mcpHandler';

interface McpIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCode?: string;
}

type TabType = 'configs' | 'playground' | 'resources' | 'security';

export const McpIntegrationModal: React.FC<McpIntegrationModalProps> = ({
  isOpen,
  onClose,
  activeCode,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('configs');
  const [configType, setConfigType] = useState<'claude' | 'cursor' | 'windsurf' | 'python'>('claude');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [selectedToolName, setSelectedToolName] = useState<string>('spark_execute_query');
  const [toolParamsJson, setToolParamsJson] = useState<string>('');
  const [playgroundLoading, setPlaygroundLoading] = useState<boolean>(false);
  const [rpcResponse, setRpcResponse] = useState<any>(null);
  const [rpcLatencyMs, setRpcLatencyMs] = useState<number | null>(null);

  // Security token state
  const [mcpApiKey, setMcpApiKey] = useState<string>(() => {
    return localStorage.getItem('spark_mcp_api_key') || 'mcp_sk_spark_' + Math.random().toString(36).substring(2, 15);
  });

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const mcpEndpointUrl = `${currentHost}/api/mcp`;
  const mcpSseUrl = `${currentHost}/api/mcp/sse`;

  // Pre-fill tool parameters when tool changes
  useEffect(() => {
    switch (selectedToolName) {
      case 'spark_execute_query':
        setToolParamsJson(
          JSON.stringify(
            {
              query: activeCode || 'from pyspark.sql import functions as F\nspark.read.table("ecommerce_sales").groupBy("region").count().show()',
              mode: 'pyspark',
            },
            null,
            2
          )
        );
        break;
      case 'spark_optimize_pipeline':
        setToolParamsJson(
          JSON.stringify(
            {
              code: activeCode || 'df.join(small_df, "id").filter("status == \'ACTIVE\'")',
              mode: 'pyspark',
            },
            null,
            2
          )
        );
        break;
      case 'workspace_account_map':
        setToolParamsJson(
          JSON.stringify(
            {
              filterCategory: 'all',
            },
            null,
            2
          )
        );
        break;
      case 'workspace_send_gmail':
        setToolParamsJson(
          JSON.stringify(
            {
              to: 'data-engineering@company.com',
              subject: 'Spark Optimization Audit Report',
              body: 'PySpark pipeline optimized with 2.8x speedup using Spark AQE.',
            },
            null,
            2
          )
        );
        break;
      case 'workspace_create_slides':
        setToolParamsJson(
          JSON.stringify(
            {
              title: 'Spark Studio Executive Benchmark',
              pysparkCode: activeCode ? activeCode.slice(0, 150) : 'df.groupBy("category").sum()',
              speedup: '3.2x faster',
              memorySaved: '2.4 GB RAM per executor',
            },
            null,
            2
          )
        );
        break;
      case 'workspace_create_task':
        setToolParamsJson(
          JSON.stringify(
            {
              title: 'Tune Spark shuffle partitions for customer_360',
              notes: 'Set spark.sql.shuffle.partitions to dynamic AQE allocation.',
              due: new Date(Date.now() + 86400000).toISOString(),
            },
            null,
            2
          )
        );
        break;
      case 'workspace_create_keep_note':
        setToolParamsJson(
          JSON.stringify(
            {
              title: 'Spark Catalyst AQE Rule Checklist',
              textContent: '1. CoalesceShufflePartitions\n2. RebalancePartitions\n3. OptimizeSkewedJoin',
            },
            null,
            2
          )
        );
        break;
      case 'cloudsql_list_notebooks':
        setToolParamsJson(
          JSON.stringify(
            {
              limit: 5,
            },
            null,
            2
          )
        );
        break;
      case 'spark_cluster_metrics':
        setToolParamsJson(JSON.stringify({}, null, 2));
        break;
      default:
        setToolParamsJson('{}');
    }
  }, [selectedToolName, activeCode]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteMcpPlayground = async () => {
    try {
      setPlaygroundLoading(true);
      setRpcResponse(null);
      const startTime = performance.now();

      let parsedParams = {};
      if (toolParamsJson.trim()) {
        try {
          parsedParams = JSON.parse(toolParamsJson);
        } catch (e: any) {
          throw new Error(`Invalid JSON parameters: ${e.message}`);
        }
      }

      const rpcPayload = {
        jsonrpc: '2.0',
        id: `test-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: selectedToolName,
          arguments: parsedParams,
        },
      };

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mcpApiKey}`,
        },
        body: JSON.stringify(rpcPayload),
      });

      const data = await res.json();
      const endTime = performance.now();
      setRpcLatencyMs(Math.round(endTime - startTime));
      setRpcResponse(data);
    } catch (err: any) {
      setRpcResponse({
        jsonrpc: '2.0',
        id: 'error',
        error: {
          code: -32000,
          message: err.message || 'Failed to call MCP server',
        },
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Generate Claude Desktop Config snippet
  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        spark_studio: {
          command: "npx",
          args: ["-y", "mcp-remote-client", mcpEndpointUrl],
          env: {
            SPARK_MCP_API_KEY: mcpApiKey,
          },
        },
      },
    },
    null,
    2
  );

  // Generate Cursor IDE Config snippet
  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "spark-studio": {
          url: mcpSseUrl,
          headers: {
            Authorization: `Bearer ${mcpApiKey}`,
          },
        },
      },
    },
    null,
    2
  );

  // Generate Windsurf Config snippet
  const windsurfConfig = JSON.stringify(
    {
      mcpServers: {
        "spark-analytics": {
          serverUrl: mcpEndpointUrl,
          transport: "http",
        },
      },
    },
    null,
    2
  );

  // Python MCP client script
  const pythonMcpSnippet = `# Python Model Context Protocol (MCP) Client Integration
import asyncio
from mcp import ClientSession, StdioServerParameters
import httpx

async def run():
    async with httpx.AsyncClient() as client:
        # 1. Initialize MCP Handshake
        init_res = await client.post(
            "${mcpEndpointUrl}",
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
        )
        print("MCP Server Init:", init_res.json())

        # 2. Call PySpark execution tool
        tool_res = await client.post(
            "${mcpEndpointUrl}",
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "spark_execute_query",
                    "arguments": {
                        "query": "spark.read.table('ecommerce_sales').show(5)",
                        "mode": "pyspark"
                    }
                }
            }
        )
        print("Spark Execution Plan & Rows:", tool_res.json())

asyncio.run(run())
`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-xl text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Model Context Protocol (MCP) Integration Hub
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span>ONLINE v2024-11-05</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connect external AI clients (Claude Desktop, Cursor, AI agents) to Spark Studio tools & Workspace APIs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-2 space-x-2 text-xs overflow-x-auto">
          {[
            { id: 'configs', label: 'AI App Connectors', icon: Terminal },
            { id: 'playground', label: 'MCP Tool Tester', icon: Play },
            { id: 'resources', label: 'Resources & Prompts', icon: FileText },
            { id: 'security', label: 'Endpoint & Keys', icon: Key },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* TAB 1: AI App Configs */}
          {activeTab === 'configs' && (
            <div className="space-y-5">
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-start space-x-3 text-purple-200">
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-white mb-1">Standard Model Context Protocol Integration</h4>
                  <p className="text-xs text-purple-200/90 leading-relaxed">
                    Paste the generated configuration JSON snippet into your AI desktop app or IDE. This gives your AI models instant access to execute PySpark queries, generate Google Slides, send Gmail reports, create Google Tasks, and inspect workspace account dependencies.
                  </p>
                </div>
              </div>

              {/* Client Selector Pills */}
              <div className="flex items-center space-x-2">
                {[
                  { id: 'claude', label: 'Claude Desktop' },
                  { id: 'cursor', label: 'Cursor IDE' },
                  { id: 'windsurf', label: 'Windsurf / Codeium' },
                  { id: 'python', label: 'Python / MCP SDK' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setConfigType(c.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      configType === c.id
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Configuration Code Block */}
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] text-slate-400 font-sans">
                  <span>
                    {configType === 'claude' && 'File: ~/Library/Application Support/Claude/claude_desktop_config.json'}
                    {configType === 'cursor' && 'File: .cursor/mcp.json'}
                    {configType === 'windsurf' && 'File: ~/.codeium/windsurf/mcp_config.json'}
                    {configType === 'python' && 'Script: mcp_spark_agent.py'}
                  </span>

                  <button
                    onClick={() => {
                      const snippet =
                        configType === 'claude'
                          ? claudeDesktopConfig
                          : configType === 'cursor'
                          ? cursorConfig
                          : configType === 'windsurf'
                          ? windsurfConfig
                          : pythonMcpSnippet;
                      copyToClipboard(snippet, 'config-snippet');
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all"
                  >
                    {copiedKey === 'config-snippet' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Snippet</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="overflow-x-auto max-h-64 text-slate-300">
                  {configType === 'claude' && claudeDesktopConfig}
                  {configType === 'cursor' && cursorConfig}
                  {configType === 'windsurf' && windsurfConfig}
                  {configType === 'python' && pythonMcpSnippet}
                </pre>
              </div>

              {/* Supported Tools List Preview */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  Exposed MCP Tools Available to AI Apps ({MCP_TOOLS.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {MCP_TOOLS.map((t) => (
                    <div
                      key={t.name}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1"
                    >
                      <div className="flex items-center space-x-1.5 text-amber-400 font-mono font-semibold text-[11px]">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Live Tool Tester / Playground */}
          {activeTab === 'playground' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Request Box */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200 text-xs">Select Tool to Test:</label>
                    <span className="text-[10px] text-slate-400 font-mono">JSON-RPC 2.0</span>
                  </div>

                  <select
                    value={selectedToolName}
                    onChange={(e) => setSelectedToolName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  >
                    {MCP_TOOLS.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <div>
                    <label className="font-bold text-slate-200 text-xs block mb-1">
                      Tool Arguments (JSON Payload):
                    </label>
                    <textarea
                      value={toolParamsJson}
                      onChange={(e) => setToolParamsJson(e.target.value)}
                      rows={8}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    onClick={handleExecuteMcpPlayground}
                    disabled={playgroundLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {playgroundLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{playgroundLoading ? 'Executing Tool in Spark Engine...' : 'Execute MCP Tool Call'}</span>
                  </button>
                </div>

                {/* Response Box */}
                <div className="space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200 text-xs">MCP Server Response:</label>
                    {rpcLatencyMs !== null && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        Latency: {rpcLatencyMs} ms
                      </span>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 overflow-y-auto max-h-[340px]">
                    {rpcResponse ? (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(rpcResponse, null, 2)}</pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                        <Terminal className="w-6 h-6 text-slate-600" />
                        <p className="text-center">Select a tool and click "Execute MCP Tool Call" to view the live JSON-RPC response.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Resources & Prompts */}
          {activeTab === 'resources' && (
            <div className="space-y-5">
              {/* Resources */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs flex items-center space-x-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Exposed MCP Resources ({MCP_RESOURCES.length})</span>
                </h4>
                <div className="space-y-2">
                  {MCP_RESOURCES.map((r) => (
                    <div
                      key={r.uri}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start justify-between"
                    >
                      <div className="space-y-1">
                        <span className="font-mono text-cyan-400 font-semibold">{r.uri}</span>
                        <h5 className="font-bold text-white text-xs">{r.name}</h5>
                        <p className="text-[11px] text-slate-400">{r.description}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-mono bg-slate-800 text-slate-300 rounded">
                        {r.mimeType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prompts */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Exposed MCP Prompt Templates ({MCP_PROMPTS.length})</span>
                </h4>
                <div className="space-y-2">
                  {MCP_PROMPTS.map((p) => (
                    <div
                      key={p.name}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-amber-400 font-semibold">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Args: {p.arguments?.map((a) => a.name).join(', ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Security & Endpoint URLs */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  <span>Public & Local MCP Server Endpoints</span>
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 font-mono">
                      HTTP POST JSON-RPC 2.0 Endpoint:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={mcpEndpointUrl}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(mcpEndpointUrl, 'post-url')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all"
                      >
                        {copiedKey === 'post-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 font-mono">
                      Server-Sent Events (SSE) Stream Endpoint:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={mcpSseUrl}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(mcpSseUrl, 'sse-url')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all"
                      >
                        {copiedKey === 'sse-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* MCP API Key */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>MCP Bearer Authentication Key</span>
                  </h4>
                  <button
                    onClick={() => {
                      const newKey = 'mcp_sk_spark_' + Math.random().toString(36).substring(2, 15);
                      setMcpApiKey(newKey);
                      localStorage.setItem('spark_mcp_api_key', newKey);
                    }}
                    className="text-[10px] text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate Key</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    readOnly
                    value={mcpApiKey}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(mcpApiKey, 'api-key')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all"
                  >
                    {copiedKey === 'api-key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Spark Studio MCP Server • Compatible with Anthropic Claude Desktop, Cursor & Agent Frameworks</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
