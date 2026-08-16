import React, { useState } from 'react';
import { Activity, Cpu, HardDrive, Layers, ListChecks, Server, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ClusterConfig, SparkExecutor, SparkJob, SparkStage, SparkStorageRDD } from '../../types/spark';

interface SparkWebUiProps {
  config: ClusterConfig;
}

const MOCK_JOBS: SparkJob[] = [
  { jobId: 104, name: 'show at SparkNotebook.tsx:142', submittedTime: '2026-07-28 07:01:10', durationMs: 145, status: 'SUCCEEDED', stagesCount: 2, completedStages: 2, tasksCount: 16, completedTasks: 16 },
  { jobId: 103, name: 'count at SparkNotebook.tsx:98', submittedTime: '2026-07-28 07:00:42', durationMs: 82, status: 'SUCCEEDED', stagesCount: 1, completedStages: 1, tasksCount: 8, completedTasks: 8 },
  { jobId: 102, name: 'write at SparkPipeline.tsx:55', submittedTime: '2026-07-28 06:58:12', durationMs: 420, status: 'SUCCEEDED', stagesCount: 3, completedStages: 3, tasksCount: 32, completedTasks: 32 },
  { jobId: 101, name: 'collect at DatasetCatalog.tsx:24', submittedTime: '2026-07-28 06:55:00', durationMs: 64, status: 'SUCCEEDED', stagesCount: 1, completedStages: 1, tasksCount: 4, completedTasks: 4 },
];

const MOCK_STAGES: SparkStage[] = [
  { stageId: 8, name: 'HashAggregate at SparkNotebook.tsx:142', submittedTime: '2026-07-28 07:01:10', durationMs: 85, status: 'COMPLETE', tasksTotal: 16, tasksComplete: 16, shuffleReadBytes: 4200000, shuffleWriteBytes: 0 },
  { stageId: 7, name: 'FileScan parquet ecommerce_sales', submittedTime: '2026-07-28 07:01:10', durationMs: 60, status: 'COMPLETE', tasksTotal: 16, tasksComplete: 16, shuffleReadBytes: 0, shuffleWriteBytes: 4200000 },
  { stageId: 6, name: 'Exchange hashpartitioning(200)', submittedTime: '2026-07-28 07:00:42', durationMs: 82, status: 'COMPLETE', tasksTotal: 8, tasksComplete: 8, shuffleReadBytes: 1800000, shuffleWriteBytes: 1800000 },
];

const MOCK_RDDS: SparkStorageRDD[] = [
  { id: 1, name: 'ecommerce_sales_cached', storageLevel: 'MEMORY_AND_DISK', partitionsCount: 16, cachedPartitions: 16, sizeInMemoryMb: 142.5, sizeOnDiskMb: 42.0 },
  { id: 2, name: 'server_access_logs_mem', storageLevel: 'MEMORY_ONLY', partitionsCount: 32, cachedPartitions: 32, sizeInMemoryMb: 920.0, sizeOnDiskMb: 0.0 },
];

const MOCK_EXECUTORS: SparkExecutor[] = [
  { id: 'driver', hostPort: '10.0.1.10:4040', status: 'Active', rddBlocks: 16, memoryUsedMb: 512, maxMemoryMb: 4096, cores: 4, activeTasks: 0, completedTasks: 184, failedTasks: 0, totalDurationMs: 12400, gcTimeMs: 420 },
  { id: '1', hostPort: '10.0.1.11:38821', status: 'Active', rddBlocks: 8, memoryUsedMb: 2150, maxMemoryMb: 8192, cores: 8, activeTasks: 0, completedTasks: 420, failedTasks: 0, totalDurationMs: 48900, gcTimeMs: 1120 },
  { id: '2', hostPort: '10.0.1.12:38822', status: 'Active', rddBlocks: 8, memoryUsedMb: 2310, maxMemoryMb: 8192, cores: 8, activeTasks: 0, completedTasks: 412, failedTasks: 0, totalDurationMs: 46200, gcTimeMs: 980 },
  { id: '3', hostPort: '10.0.1.13:38823', status: 'Active', rddBlocks: 8, memoryUsedMb: 1890, maxMemoryMb: 8192, cores: 8, activeTasks: 0, completedTasks: 398, failedTasks: 0, totalDurationMs: 42100, gcTimeMs: 890 },
];

export const SparkWebUi: React.FC<SparkWebUiProps> = ({ config }) => {
  const [subTab, setSubTab] = useState<'jobs' | 'stages' | 'storage' | 'executors' | 'env'>('jobs');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Replica */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-slate-100 text-lg">Apache Spark Web UI</h2>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-semibold">
                Spark Cluster Alive
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Master: <span className="font-mono text-amber-400">{config.masterUrl}</span> • Spark Version: {config.sparkVersion}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh UI</span>
        </button>
      </div>

      {/* Web UI Navigation Tabs */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="bg-slate-950 px-6 border-b border-slate-800 flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setSubTab('jobs')}
            className={`py-3.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'jobs' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Jobs ({MOCK_JOBS.length})</span>
          </button>

          <button
            onClick={() => setSubTab('stages')}
            className={`py-3.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'stages' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stages ({MOCK_STAGES.length})</span>
          </button>

          <button
            onClick={() => setSubTab('storage')}
            className={`py-3.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'storage' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage ({MOCK_RDDS.length})</span>
          </button>

          <button
            onClick={() => setSubTab('executors')}
            className={`py-3.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'executors' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Executors ({MOCK_EXECUTORS.length})</span>
          </button>

          <button
            onClick={() => setSubTab('env')}
            className={`py-3.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'env' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Environment Properties</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* Jobs Tab */}
          {subTab === 'jobs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Stages Progress</th>
                    <th className="px-4 py-3">Tasks Progress</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {MOCK_JOBS.map(job => (
                    <tr key={job.jobId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-amber-400">Job {job.jobId}</td>
                      <td className="px-4 py-3 font-semibold text-white">{job.name}</td>
                      <td className="px-4 py-3 text-slate-400">{job.submittedTime}</td>
                      <td className="px-4 py-3 text-slate-300">{job.durationMs} ms</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full w-full"></div>
                          </div>
                          <span className="text-[11px] text-slate-400">{job.completedStages}/{job.stagesCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300">{job.completedTasks}/{job.tasksCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px]">
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stages Tab */}
          {subTab === 'stages' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Stage ID</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Tasks (Succeeded/Total)</th>
                    <th className="px-4 py-3">Shuffle Read</th>
                    <th className="px-4 py-3">Shuffle Write</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {MOCK_STAGES.map(stage => (
                    <tr key={stage.stageId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-amber-400">Stage {stage.stageId}</td>
                      <td className="px-4 py-3 text-white font-semibold">{stage.name}</td>
                      <td className="px-4 py-3 text-slate-400">{stage.submittedTime}</td>
                      <td className="px-4 py-3">{stage.durationMs} ms</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{stage.tasksComplete}/{stage.tasksTotal}</td>
                      <td className="px-4 py-3 text-amber-400">{(stage.shuffleReadBytes / 1024 / 1024).toFixed(1)} MB</td>
                      <td className="px-4 py-3 text-amber-400">{(stage.shuffleWriteBytes / 1024 / 1024).toFixed(1)} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Storage Tab */}
          {subTab === 'storage' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">RDD / DataFrame Name</th>
                    <th className="px-4 py-3">Storage Level</th>
                    <th className="px-4 py-3">Partitions Cached</th>
                    <th className="px-4 py-3">Size in Memory</th>
                    <th className="px-4 py-3">Size on Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {MOCK_RDDS.map(rdd => (
                    <tr key={rdd.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-amber-400">{rdd.id}</td>
                      <td className="px-4 py-3 font-semibold text-white">{rdd.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px]">
                          {rdd.storageLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">{rdd.cachedPartitions} / {rdd.partitionsCount} (100%)</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{rdd.sizeInMemoryMb} MB</td>
                      <td className="px-4 py-3 text-slate-400">{rdd.sizeOnDiskMb} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Executors Tab */}
          {subTab === 'executors' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Executor ID</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Cores</th>
                    <th className="px-4 py-3">Memory Usage</th>
                    <th className="px-4 py-3">Tasks Completed</th>
                    <th className="px-4 py-3">Task Time</th>
                    <th className="px-4 py-3">GC Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {MOCK_EXECUTORS.map(exec => (
                    <tr key={exec.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-amber-400">{exec.id}</td>
                      <td className="px-4 py-3 text-white">{exec.hostPort}</td>
                      <td className="px-4 py-3 text-amber-400 font-semibold">{exec.cores}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-amber-500 h-full" style={{ width: `${Math.round((exec.memoryUsedMb / exec.maxMemoryMb) * 100)}%` }}></div>
                          </div>
                          <span>{exec.memoryUsedMb} MB / {exec.maxMemoryMb} MB</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{exec.completedTasks}</td>
                      <td className="px-4 py-3">{(exec.totalDurationMs / 1000).toFixed(1)}s</td>
                      <td className="px-4 py-3 text-orange-400">{exec.gcTimeMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Environment Properties Tab */}
          {subTab === 'env' && (
            <div className="space-y-4 font-mono text-xs text-slate-300">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold block mb-2">Spark Configuration Properties</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.master</span>
                    <span className="text-white">{config.masterUrl}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.app.name</span>
                    <span className="text-white">SparkStudio_Cluster</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.driver.memory</span>
                    <span className="text-amber-400 font-semibold">{config.driverMemory}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.executor.memory</span>
                    <span className="text-amber-400 font-semibold">{config.executorMemory}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.sql.shuffle.partitions</span>
                    <span className="text-white">200</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">spark.sql.adaptive.enabled</span>
                    <span className="text-emerald-400 font-semibold">{String(config.adaptiveQueryExecution)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
