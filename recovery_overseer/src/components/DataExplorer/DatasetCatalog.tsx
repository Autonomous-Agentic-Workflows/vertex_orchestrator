import React, { useState } from 'react';
import { Database, Table, Search, HardDrive, Layers, ArrowUpRight, Play, Eye } from 'lucide-react';
import { SparkDataset } from '../../types/spark';

interface DatasetCatalogProps {
  datasets: SparkDataset[];
  onQueryDataset: (datasetName: string) => void;
}

export const DatasetCatalog: React.FC<DatasetCatalogProps> = ({ datasets, onQueryDataset }) => {
  const [selectedDataset, setSelectedDataset] = useState<SparkDataset>(datasets[0]);
  const [search, setSearch] = useState<string>('');

  const filteredDatasets = datasets.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-100 text-lg">Spark Metastore Data Catalog</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Explore schema definitions, data types, partition layouts, and sample rows across Spark tables.
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Spark catalog..."
            className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List */}
        <div className="space-y-3">
          {filteredDatasets.map(ds => {
            const isSelected = selectedDataset.id === ds.id;

            return (
              <div
                key={ds.id}
                onClick={() => setSelectedDataset(ds)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Table className="w-4 h-4 text-amber-400" />
                    <h3 className="font-mono font-bold text-xs text-white">{ds.name}</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{ds.sizeMb} MB</span>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{ds.description}</p>

                <div className="flex items-center space-x-3 mt-3 text-[11px] font-mono text-slate-500">
                  <span>{ds.rowCount.toLocaleString()} Rows</span>
                  <span>•</span>
                  <span>{ds.partitionCount} Partitions</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Inspector */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-mono font-bold text-base text-white">{selectedDataset.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{selectedDataset.description}</p>
            </div>

            <button
              onClick={() => onQueryDataset(selectedDataset.name)}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Query Table in Notebook</span>
            </button>
          </div>

          {/* Table Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">TOTAL RECORDS</span>
              <span className="font-mono text-sm font-bold text-amber-400">{selectedDataset.rowCount.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">STORAGE SIZE</span>
              <span className="font-mono text-sm font-bold text-white">{selectedDataset.sizeMb} MB</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">PARTITIONS</span>
              <span className="font-mono text-sm font-bold text-white">{selectedDataset.partitionCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">STORAGE LEVEL</span>
              <span className="font-mono text-xs font-bold text-emerald-400">{selectedDataset.storageLevel || 'DISK_ONLY'}</span>
            </div>
          </div>

          {/* Schema Definition Table */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Schema Metadata</span>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Column Name</th>
                    <th className="px-4 py-2.5">Spark DataType</th>
                    <th className="px-4 py-2.5">Nullable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedDataset.schema.map((col, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2 text-white font-semibold">{col.name}</td>
                      <td className="px-4 py-2 text-amber-400">{col.type}</td>
                      <td className="px-4 py-2 text-slate-500">{String(col.nullable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Rows Preview */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Sample Rows (Head 5)</span>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    {selectedDataset.schema.map((col, idx) => (
                      <th key={idx} className="px-4 py-2.5">{col.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedDataset.sampleData.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40">
                      {selectedDataset.schema.map((col, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 whitespace-nowrap text-slate-300">
                          {String(row[col.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
