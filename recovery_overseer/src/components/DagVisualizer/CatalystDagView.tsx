import React, { useState } from 'react';
import { Workflow, Layers, ArrowDown, Database, Cpu, Activity, Sparkles, Filter, Info, RefreshCw } from 'lucide-react';
import { CatalystPlan, DagNode } from '../../types/spark';
import { explainCatalystPlanWithAi } from '../../engine/aiService';

interface CatalystDagViewProps {
  plan: CatalystPlan;
}

export const CatalystDagView: React.FC<CatalystDagViewProps> = ({ plan }) => {
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(plan.nodes[0] || null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);

  const handleExplainWithAi = async () => {
    setIsExplaining(true);
    const text = await explainCatalystPlanWithAi(plan.physicalPlan);
    setAiExplanation(text);
    setIsExplaining(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Banner */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Workflow className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-100 text-lg">Catalyst Execution DAG & Physical Plan</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual inspection of Spark physical operators, shuffle exchange dependencies, and executor task metrics.
          </p>
        </div>

        <button
          onClick={handleExplainWithAi}
          disabled={isExplaining}
          className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
        >
          {isExplaining ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing Physical Operators...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Explain DAG with Gemini AI</span>
            </>
          )}
        </button>
      </div>

      {/* AI Explanation Banner */}
      {aiExplanation && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-2 text-xs text-slate-200">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Gemini Catalyst Execution Insights</span>
          </div>
          <div className="prose prose-invert max-w-none font-mono text-xs leading-relaxed text-slate-300">
            {aiExplanation}
          </div>
        </div>
      )}

      {/* Split View: Left DAG Flowchart, Right Operator Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: DAG Visual Flowchart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-md flex flex-col items-center space-y-4 min-h-[480px] justify-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono font-semibold">Stage 0 & Stage 1 Operators</span>
            <span className="text-amber-400">Click any node to inspect metrics</span>
          </div>

          <div className="w-full space-y-4 py-4 flex flex-col items-center">
            {plan.nodes.map((node, idx) => {
              const isSelected = selectedNode?.id === node.id;
              const isShuffle = node.type === 'ShuffleExchange';

              return (
                <React.Fragment key={node.id}>
                  {idx > 0 && (
                    <div className="flex flex-col items-center my-1">
                      <div className={`h-6 w-0.5 ${isShuffle ? 'bg-amber-500 border-dashed border-l-2' : 'bg-slate-700'}`}></div>
                      <ArrowDown className={`w-4 h-4 -mt-1 ${isShuffle ? 'text-amber-500' : 'text-slate-600'}`} />
                      {isShuffle && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider my-0.5 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Network Shuffle Exchange Boundary
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedNode(node)}
                    className={`w-full max-w-md p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20'
                        : isShuffle
                        ? 'bg-slate-950 border-amber-500/40 hover:border-amber-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-2 rounded-lg text-white ${
                          node.type === 'FileScan' ? 'bg-blue-600' :
                          node.type === 'Filter' ? 'bg-amber-600' :
                          node.type === 'ShuffleExchange' ? 'bg-orange-600' :
                          node.type === 'HashAggregate' ? 'bg-purple-600' : 'bg-emerald-600'
                        }`}>
                          {node.type === 'FileScan' ? <Database className="w-4 h-4" /> :
                           node.type === 'ShuffleExchange' ? <Activity className="w-4 h-4" /> :
                           node.type === 'Filter' ? <Filter className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-mono font-bold text-xs text-slate-100">{node.label}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">Stage {node.stageId} • {node.type}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono text-[11px]">
                        <span className="text-amber-400 font-semibold block">{node.metrics.recordsOut?.toLocaleString() || 0} rows</span>
                        <span className="text-slate-500">{node.metrics.timeMs} ms</span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Selected Node Inspector */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md flex flex-col justify-between space-y-6">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <Info className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-100 text-sm">Operator Details</h3>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase block">Operator Name</span>
                <span className="font-mono text-xs font-bold text-slate-100">{selectedNode.label}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase block">Stage ID</span>
                <span className="font-mono text-xs text-amber-400 font-semibold">Stage {selectedNode.stageId}</span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-mono uppercase block">Stage Metrics</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Records Input:</span>
                    <span className="text-white font-semibold">{selectedNode.metrics.recordsIn?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Records Output:</span>
                    <span className="text-amber-400 font-semibold">{selectedNode.metrics.recordsOut?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Execution Time:</span>
                    <span className="text-white">{selectedNode.metrics.timeMs} ms</span>
                  </div>
                  {selectedNode.metrics.shuffleReadBytes !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shuffle Read Bytes:</span>
                      <span className="text-amber-400">{(selectedNode.metrics.shuffleReadBytes / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                  {selectedNode.metrics.shuffleWriteBytes !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shuffle Write Bytes:</span>
                      <span className="text-amber-400">{(selectedNode.metrics.shuffleWriteBytes / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedNode.details && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Operator Attributes</span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed break-words">
                    {selectedNode.details}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs py-10 font-mono">
              Select a DAG operator node to view detailed metrics.
            </div>
          )}

          {/* Logical Plan Raw Snippet */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Parsed Logical Plan</span>
            <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre">
              {plan.parsedLogicalPlan}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
