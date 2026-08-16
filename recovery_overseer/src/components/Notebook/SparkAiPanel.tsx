import React, { useState } from 'react';
import { Sparkles, Zap, ArrowRight, CheckCircle2, AlertTriangle, Copy, Check, X, RefreshCw, Code2, ExternalLink, Bot, Flame, Share2 } from 'lucide-react';
import { AiOptimizationResult } from '../../types/spark';
import { generatePySparkCodeWithAi, optimizeSparkCodeWithAi } from '../../engine/aiService';

interface SparkAiPanelProps {
  initialCode: string;
  initialMode: 'pyspark' | 'sql';
  onClose: () => void;
  onApplyCode: (optimizedCode: string) => void;
  onOpenJulesAgent?: () => void;
}

export const SparkAiPanel: React.FC<SparkAiPanelProps> = ({
  initialCode,
  initialMode,
  onClose,
  onApplyCode,
  onOpenJulesAgent,
}) => {
  const [activeTab, setActiveTab] = useState<'optimize' | 'generate' | 'geminispark'>('optimize');
  const [codeToOptimize, setCodeToOptimize] = useState<string>(initialCode);
  const [mode, setMode] = useState<'pyspark' | 'sql'>(initialMode);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<AiOptimizationResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Generator State
  const [prompt, setPrompt] = useState<string>('Find top 5 customer regions by revenue and count discounted orders');
  const [tableName, setTableName] = useState<string>('ecommerce_sales');
  const [generatedResult, setGeneratedResult] = useState<{ pysparkCode: string; sqlCode: string; explanation: string } | null>(null);

  // Gemini Spark Context state
  const [sparkContextCopied, setSparkContextCopied] = useState<boolean>(false);

  const handleRunOptimize = async () => {
    setIsLoading(true);
    const result = await optimizeSparkCodeWithAi(codeToOptimize, mode);
    setOptimizationResult(result);
    setIsLoading(false);
  };

  const handleRunGenerate = async () => {
    setIsLoading(true);
    const result = await generatePySparkCodeWithAi(prompt, tableName);
    setGeneratedResult(result);
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGeminiSparkContextPrompt = () => {
    return `[Gemini Spark Deep Optimization Context]
Target Spark Code Mode: ${mode.toUpperCase()}
Code Snippet:
\`\`\`${mode}
${codeToOptimize}
\`\`\`

Request:
Analyze this Apache Spark pipeline for Catalyst query optimizations, AQE partition coalescing, and ShuffleExchange reduction. Provide tuning suggestions for Google Cloud Dataproc & Spark clusters.`;
  };

  const handleCopyAndLaunchGeminiSpark = () => {
    const fullContext = getGeminiSparkContextPrompt();
    navigator.clipboard.writeText(fullContext);
    setSparkContextCopied(true);
    setTimeout(() => setSparkContextCopied(false), 2500);

    // Open https://gemini.google.com/spark
    window.open('https://gemini.google.com/spark', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 rounded-xl text-white shadow-md shadow-orange-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-base">Spark AI & Gemini Integrations</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Gemini Spark & Jules
                </span>
              </div>
              <p className="text-xs text-slate-400">Optimize Catalyst physical plans, fix shuffles, and leverage Gemini Spark & Jules AI Agent.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="bg-slate-950/60 px-6 border-b border-slate-800 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('optimize')}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'optimize'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>AI Code Optimizer</span>
            </button>

            <button
              onClick={() => setActiveTab('generate')}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'generate'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Natural Language to PySpark</span>
            </button>

            <button
              onClick={() => setActiveTab('geminispark')}
              className={`py-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'geminispark'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Gemini Spark (gemini.google.com/spark)</span>
            </button>
          </div>

          {onOpenJulesAgent && (
            <button
              onClick={() => {
                onClose();
                onOpenJulesAgent();
              }}
              className="my-2 px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Launch Jules Agent</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'optimize' ? (
            <div className="space-y-6">
              {/* Input Code Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-300">Target Code to Optimize:</label>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      onClick={() => setMode('pyspark')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        mode === 'pyspark' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      PySpark
                    </button>
                    <button
                      onClick={() => setMode('sql')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        mode === 'sql' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Spark SQL
                    </button>
                  </div>
                </div>

                <textarea
                  value={codeToOptimize}
                  onChange={e => setCodeToOptimize(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Action Run */}
              <div className="flex justify-end space-x-3">
                <a
                  href="https://gemini.google.com/spark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-orange-300 border border-orange-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                  <span>Open gemini.google.com/spark</span>
                </a>

                <button
                  onClick={handleRunOptimize}
                  disabled={isLoading}
                  className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Catalyst Rules...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Optimize Code with Gemini</span>
                    </>
                  )}
                </button>
              </div>

              {/* Results View */}
              {optimizationResult && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  {/* Summary Metric */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                        Estimated Performance Gain
                      </span>
                      <span className="text-lg font-extrabold text-white">
                        {optimizationResult.performanceGainEstimate}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300 max-w-xs text-right">
                      {optimizationResult.summary}
                    </span>
                  </div>

                  {/* Anti Patterns Detected */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Anti-Patterns Detected:</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {optimizationResult.antiPatternsDetected.map((ap, idx) => (
                        <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                          <span>{ap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optimized Code Display */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">Optimized Spark Code:</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopy(optimizationResult.optimizedCode)}
                          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => {
                            onApplyCode(optimizationResult.optimizedCode);
                            onClose();
                          }}
                          className="flex items-center space-x-1 text-xs bg-amber-500 text-white font-semibold px-3 py-1 rounded-lg hover:bg-amber-600"
                        >
                          <span>Apply to Editor</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
                      {optimizationResult.optimizedCode}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'generate' ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Table / Dataset:</label>
                  <select
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="ecommerce_sales">ecommerce_sales</option>
                    <option value="server_access_logs">server_access_logs</option>
                    <option value="iot_sensors">iot_sensors</option>
                    <option value="financial_trades">financial_trades</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Describe desired PySpark pipeline:</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                    placeholder="e.g. Find top 10 categories by average item price and total revenue..."
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleRunGenerate}
                    disabled={isLoading}
                    className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating PySpark...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate PySpark Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generatedResult && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <span className="font-semibold text-amber-400 block mb-1">Explanation:</span>
                    {generatedResult.explanation}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">Generated PySpark Code:</span>
                      <button
                        onClick={() => {
                          onApplyCode(generatedResult.pysparkCode);
                          onClose();
                        }}
                        className="flex items-center space-x-1 text-xs bg-amber-500 text-white font-semibold px-3 py-1 rounded-lg hover:bg-amber-600"
                      >
                        <span>Insert Code into Notebook</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto whitespace-pre leading-relaxed">
                      {generatedResult.pysparkCode}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 3: Gemini Spark Integration (https://gemini.google.com/spark) */
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-red-500/10 border border-orange-500/20 p-5 rounded-2xl space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Gemini Spark Deep Optimization Portal
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        https://gemini.google.com/spark
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Connect your notebook session directly to Gemini Spark for deep Catalyst plan analysis and Dataproc tuning.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-xs font-mono text-slate-300 block">Exportable Prompt Package for Gemini Spark:</span>
                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-orange-300 overflow-x-auto whitespace-pre-wrap max-h-[140px]">
                    {getGeminiSparkContextPrompt()}
                  </pre>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-orange-400" />
                    Copies context to clipboard & launches gemini.google.com/spark
                  </span>

                  <button
                    onClick={handleCopyAndLaunchGeminiSpark}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2"
                  >
                    {sparkContextCopied ? <Check className="w-4 h-4 text-white" /> : <ExternalLink className="w-4 h-4" />}
                    <span>{sparkContextCopied ? 'Context Copied! Opening...' : 'Launch Gemini Spark'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-semibold text-amber-400 block">🔥 Catalyst Plan Analyzer</span>
                  <p className="text-slate-400 text-[11px]">
                    Pass Physical and Logical Catalyst execution plans to Gemini Spark to identify broadcast hash joins and filter pushdowns.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-semibold text-cyan-400 block">🤖 Jules Agent Coordination</span>
                  <p className="text-slate-400 text-[11px]">
                    Combine Gemini Spark tuning guidelines with Jules AI Agent to automatically patch PySpark repositories asynchronously.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
