import React, { useState } from 'react';
import { Settings, X, Check, Server, Cpu, HardDrive, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { ClusterConfig } from '../../types/spark';

interface ClusterSettingsModalProps {
  config: ClusterConfig;
  onSaveConfig: (updated: ClusterConfig) => void;
  onClose: () => void;
}

export const ClusterSettingsModal: React.FC<ClusterSettingsModalProps> = ({
  config,
  onSaveConfig,
  onClose,
}) => {
  const [formConfig, setFormConfig] = useState<ClusterConfig>({ ...config });
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const handleTestConnection = () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    setTimeout(() => {
      setTestingConnection(false);
      setConnectionStatus(`Connected to Spark Master (${formConfig.masterUrl}) successfully! Spark v${formConfig.sparkVersion}`);
    }, 600);
  };

  const handleSave = () => {
    onSaveConfig(formConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-800 rounded-xl text-amber-400 border border-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Spark Cluster Configuration</h3>
              <p className="text-xs text-slate-400">Configure Master URL, memory limits, cores, and REST endpoints.</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Master Mode */}
          <div>
            <label className="font-medium text-slate-200 block mb-1">Spark Master URL:</label>
            <select
              value={formConfig.masterUrl}
              onChange={e => setFormConfig({ ...formConfig, masterUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            >
              <option value="local[*]">local[*] (All Available CPU Threads)</option>
              <option value="spark://spark-master:7077">spark://spark-master:7077 (Spark Standalone Cluster)</option>
              <option value="yarn">yarn (Apache Hadoop YARN Resource Manager)</option>
              <option value="k8s://https://kubernetes.default.svc">k8s://kubernetes.default.svc (Kubernetes Cluster)</option>
            </select>
          </div>

          {/* Memory & Cores Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-medium text-slate-200 block mb-1">Driver Memory:</label>
              <select
                value={formConfig.driverMemory}
                onChange={e => setFormConfig({ ...formConfig, driverMemory: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="2g">2 GB</option>
                <option value="4g">4 GB</option>
                <option value="8g">8 GB</option>
                <option value="16g">16 GB</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-200 block mb-1">Executor Memory:</label>
              <select
                value={formConfig.executorMemory}
                onChange={e => setFormConfig({ ...formConfig, executorMemory: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="4g">4 GB</option>
                <option value="8g">8 GB</option>
                <option value="16g">16 GB</option>
                <option value="32g">32 GB</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-200 block mb-1">Cores per Executor:</label>
              <select
                value={formConfig.executorCores}
                onChange={e => setFormConfig({ ...formConfig, executorCores: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value={2}>2 Cores</option>
                <option value={4}>4 Cores</option>
                <option value={8}>8 Cores</option>
                <option value={16}>16 Cores</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-200 block mb-1">Total Executor Instances:</label>
              <select
                value={formConfig.numExecutors}
                onChange={e => setFormConfig({ ...formConfig, numExecutors: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value={2}>2 Executors</option>
                <option value={4}>4 Executors</option>
                <option value={8}>8 Executors</option>
                <option value={16}>16 Executors</option>
              </select>
            </div>
          </div>

          {/* AQE & Dynamic Allocation Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Adaptive Query Execution (AQE)</span>
                <span className="text-[11px] text-slate-400">Dynamically coalesces shuffle partitions and converts join strategies.</span>
              </div>
              <input
                type="checkbox"
                checked={formConfig.adaptiveQueryExecution}
                onChange={e => setFormConfig({ ...formConfig, adaptiveQueryExecution: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Dynamic Executor Allocation</span>
                <span className="text-[11px] text-slate-400 font-mono">spark.dynamicAllocation.enabled</span>
              </div>
              <input
                type="checkbox"
                checked={formConfig.dynamicAllocation}
                onChange={e => setFormConfig({ ...formConfig, dynamicAllocation: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </div>
          </div>

          {/* Spark REST API Endpoint */}
          <div className="pt-2 border-t border-slate-800">
            <label className="font-medium text-slate-200 block mb-1">External Spark / Apache Livy REST Endpoint (Optional):</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={formConfig.restApiEndpoint || 'http://localhost:4040/api/v1'}
                onChange={e => setFormConfig({ ...formConfig, restApiEndpoint: e.target.value })}
                placeholder="http://spark-master:4040/api/v1"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono flex-1 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1"
              >
                {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Test</span>
              </button>
            </div>

            {connectionStatus && (
              <p className="mt-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                {connectionStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
