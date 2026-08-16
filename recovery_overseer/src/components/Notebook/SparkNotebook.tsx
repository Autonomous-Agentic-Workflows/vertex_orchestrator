import React, { useState } from 'react';
import { Play, Sparkles, Code2, Database, Table, Layers, BarChart3, Download, Search, CheckCircle2, AlertCircle, Clock, Zap, ArrowUpDown, HardDrive } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { QueryMode, QueryResult, SparkDataset } from '../../types/spark';
import { SparkExecutionEngine } from '../../engine/sparkEngine';

interface SparkNotebookProps {
  engine: SparkExecutionEngine;
  onOpenAiOptimize: (code: string, mode: 'pyspark' | 'sql') => void;
  onViewDag: (plan: any) => void;
  onOpenDrivePicker?: () => void;
  currentResult: QueryResult | null;
  setCurrentResult: (res: QueryResult) => void;
}

const SNIPPETS = [
  {
    name: 'Sales Aggregation (PySpark)',
    mode: 'pyspark' as QueryMode,
    dataset: 'ecommerce_sales',
    code: `# PySpark DataFrame Regional Sales Aggregation
from pyspark.sql import functions as F

# Read dataset
df = spark.read.table("ecommerce_sales")

# Filter nulls & aggregate by region
sales_summary = df.filter(F.col("region").isNotNull()) \\
    .groupBy("region") \\
    .agg(
        F.count("order_id").alias("order_count"),
        F.round(F.sum("price"), 2).alias("total_revenue"),
        F.round(F.avg("price"), 2).alias("avg_order_value")
    ) \\
    .orderBy(F.col("total_revenue").desc())

sales_summary.show(10)`
  },
  {
    name: 'Top Regional Revenue (Spark SQL)',
    mode: 'sql' as QueryMode,
    dataset: 'ecommerce_sales',
    code: `-- Spark SQL Regional Sales & Category Breakdown
SELECT 
  region,
  category,
  COUNT(order_id) AS total_orders,
  ROUND(SUM(price * quantity), 2) AS total_revenue,
  ROUND(AVG(price), 2) AS avg_price
FROM ecommerce_sales
WHERE is_discounted = true
GROUP BY region, category
ORDER BY total_revenue DESC
LIMIT 10;`
  },
  {
    name: 'HTTP Status Codes (Spark SQL)',
    mode: 'sql' as QueryMode,
    dataset: 'server_access_logs',
    code: `-- Web Server Status Code Distribution & Avg Latency
SELECT 
  status_code,
  COUNT(*) as request_count,
  ROUND(AVG(latency_ms), 2) as avg_latency_ms,
  SUM(bytes_sent) as total_bytes
FROM server_access_logs
GROUP BY status_code
ORDER BY request_count DESC;`
  },
  {
    name: 'IoT Anomaly Detection (PySpark)',
    mode: 'pyspark' as QueryMode,
    dataset: 'iot_sensors',
    code: `# PySpark Sensor Anomaly Aggregation
from pyspark.sql import functions as F

df = spark.read.table("iot_sensors")

anomalies = df.filter(F.col("anomaly_flag") == True) \\
    .groupBy("facility") \\
    .agg(
        F.count("*").alias("anomaly_count"),
        F.round(F.avg("temperature_c"), 2).alias("avg_temp_c"),
        F.round(F.max("vibration_hz"), 2).alias("max_vibration")
    ) \\
    .orderBy(F.col("anomaly_count").desc())

anomalies.show()`
  }
];

export const SparkNotebook: React.FC<SparkNotebookProps> = ({
  engine,
  onOpenAiOptimize,
  onViewDag,
  onOpenDrivePicker,
  currentResult,
  setCurrentResult,
}) => {
  const [queryMode, setQueryMode] = useState<QueryMode>('pyspark');
  const [selectedDatasetName, setSelectedDatasetName] = useState<string>('ecommerce_sales');
  const [code, setCode] = useState<string>(SNIPPETS[0].code);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeResultTab, setActiveResultTab] = useState<'table' | 'schema' | 'chart' | 'plan'>('table');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  const datasets = engine.getDatasets();
  const currentDataset = engine.getDatasetByName(selectedDatasetName) || datasets[0];

  const handleRunQuery = () => {
    setIsExecuting(true);
    setTimeout(() => {
      const res = engine.executeQuery(code, queryMode);
      setCurrentResult(res);
      setIsExecuting(false);
    }, 180);
  };

  const handleSelectSnippet = (snippet: typeof SNIPPETS[0]) => {
    setQueryMode(snippet.mode);
    setSelectedDatasetName(snippet.dataset);
    setCode(snippet.code);
  };

  // Filter output rows
  const filteredData = (currentResult?.data || []).filter(row => {
    if (!searchFilter) return true;
    return Object.values(row).some(val => String(val).toLowerCase().includes(searchFilter.toLowerCase()));
  });

  // Chart data extraction
  const chartXKey = currentResult?.schema[0]?.name || 'name';
  const chartYKey = currentResult?.schema.find(s => s.type === 'DoubleType' || s.type === 'LongType' || s.type === 'IntegerType')?.name || currentResult?.schema[1]?.name || 'value';

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Mode Selector */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setQueryMode('pyspark');
              setCode(SNIPPETS[0].code);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              queryMode === 'pyspark'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PySpark (Python)
          </button>
          <button
            onClick={() => {
              setQueryMode('sql');
              setCode(SNIPPETS[1].code);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              queryMode === 'sql'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Spark SQL
          </button>
        </div>

        {/* Dataset Quick Select */}
        <div className="flex items-center space-x-2 text-xs">
          <Database className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 font-medium">Dataset:</span>
          <select
            value={selectedDatasetName}
            onChange={e => setSelectedDatasetName(e.target.value)}
            className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 font-mono text-xs"
          >
            {datasets.map(d => (
              <option key={d.id} value={d.name}>
                {d.name} ({d.rowCount.toLocaleString()} rows)
              </option>
            ))}
          </select>
        </div>

        {/* Snippets Preset Picker */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          <span className="text-xs text-slate-500 font-medium mr-1 hidden lg:inline">Templates:</span>
          {SNIPPETS.map((snip, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectSnippet(snip)}
              className="text-[11px] bg-slate-800/60 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/50 whitespace-nowrap transition-all"
            >
              {snip.name}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor Box */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        {/* Editor Top Bar */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Code2 className="w-4 h-4 text-amber-500" />
            <span>spark_workspace_notebook.{queryMode === 'pyspark' ? 'py' : 'sql'}</span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenDrivePicker && (
              <button
                onClick={onOpenDrivePicker}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                title="Open Google Drive or Google Picker"
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Drive</span>
              </button>
            )}

            <button
              onClick={() => onOpenAiOptimize(code, queryMode === 'streaming' ? 'pyspark' : queryMode)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Optimize</span>
            </button>

            <button
              onClick={handleRunQuery}
              disabled={isExecuting}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <Zap className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting to Cluster...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Code (Ctrl + Enter)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Textarea Code Input */}
        <div className="p-4 bg-slate-950 font-mono text-xs sm:text-sm text-slate-100">
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            rows={10}
            className="w-full bg-transparent focus:outline-none resize-y leading-relaxed text-slate-200 font-mono"
            placeholder="Type PySpark or Spark SQL code here..."
            onKeyDown={e => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleRunQuery();
              }
            }}
          />
        </div>

        {/* Active Dataset Schema Quick Pill */}
        <div className="bg-slate-900/90 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3 overflow-x-auto">
            <span className="font-semibold text-slate-300">Schema ({currentDataset.name}):</span>
            {currentDataset.schema.map((col, idx) => (
              <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300">
                {col.name}: <span className="text-amber-400">{col.type}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Execution Results Section */}
      {currentResult && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg space-y-0">
          {/* Status Header */}
          <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              {currentResult.status === 'SUCCESS' ? (
                <div className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Job Succeeded</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Job Failed</span>
                </div>
              )}

              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentResult.executionTimeMs} ms</span>
              </div>

              <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <span>Shuffle Read: {currentResult.shuffleReadMb} MB</span>
                <span>•</span>
                <span>Shuffle Write: {currentResult.shuffleWriteMb} MB</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onViewDag(currentResult.catalystPlan)}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>View Catalyst DAG</span>
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(currentResult.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `spark_result_${currentResult.executionId}.json`;
                  a.click();
                }}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
                title="Download JSON Results"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-Tabs for Result View */}
          <div className="bg-slate-900/60 px-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveResultTab('table')}
                className={`flex items-center space-x-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
                  activeResultTab === 'table'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Data Table ({currentResult.totalRows})</span>
              </button>

              <button
                onClick={() => setActiveResultTab('schema')}
                className={`flex items-center space-x-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
                  activeResultTab === 'schema'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Schema Tree</span>
              </button>

              <button
                onClick={() => setActiveResultTab('chart')}
                className={`flex items-center space-x-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
                  activeResultTab === 'chart'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Visual Chart</span>
              </button>

              <button
                onClick={() => setActiveResultTab('plan')}
                className={`flex items-center space-x-2 py-3 px-3 text-xs font-medium border-b-2 transition-all ${
                  activeResultTab === 'plan'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Physical Plan (.explain())</span>
              </button>
            </div>

            {/* Table Search */}
            {activeResultTab === 'table' && (
              <div className="relative hidden sm:block">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Filter rows..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Sub-Tab Contents */}
          <div className="p-5">
            {/* Table View */}
            {activeResultTab === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      {currentResult.schema.map((col, idx) => (
                        <th key={idx} className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <span>{col.name}</span>
                            <span className="text-[9px] text-amber-400 font-normal">({col.type})</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {filteredData.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500">{rIdx + 1}</td>
                        {currentResult.schema.map((col, cIdx) => (
                          <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap text-slate-200">
                            {typeof row[col.name] === 'boolean'
                              ? String(row[col.name])
                              : row[col.name] !== undefined
                              ? row[col.name]
                              : 'null'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Schema Tree View */}
            {activeResultTab === 'schema' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-amber-400">root</div>
                {currentResult.schema.map((col, idx) => (
                  <div key={idx} className="pl-4 border-l-2 border-slate-800 flex items-center space-x-2">
                    <span className="text-slate-500">|--</span>
                    <span className="text-white font-semibold">{col.name}:</span>
                    <span className="text-amber-400">{col.type}</span>
                    <span className="text-slate-500 text-[10px]">(nullable = {String(col.nullable)})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recharts Data Visualization View */}
            {activeResultTab === 'chart' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-medium">Chart Type:</span>
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${chartType === 'bar' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Bar
                    </button>
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${chartType === 'line' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Line
                    </button>
                    <button
                      onClick={() => setChartType('pie')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${chartType === 'pie' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Pie
                    </button>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    X-Axis: <span className="text-amber-400">{chartXKey}</span> | Y-Axis: <span className="text-amber-400">{chartYKey}</span>
                  </span>
                </div>

                <div className="h-72 w-full bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={currentResult.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey={chartXKey} stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                        <Bar dataKey={chartYKey} fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={currentResult.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey={chartXKey} stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                        <Line type="monotone" dataKey={chartYKey} stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316' }} />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                        <Pie
                          data={currentResult.data}
                          dataKey={chartYKey}
                          nameKey={chartXKey}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {currentResult.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Catalyst Physical Plan View */}
            {activeResultTab === 'plan' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed">
                <div className="text-amber-400 font-bold mb-2">== Physical Plan ==</div>
                {currentResult.catalystPlan.physicalPlan}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
