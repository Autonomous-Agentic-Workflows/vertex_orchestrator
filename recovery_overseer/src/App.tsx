import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SparkNotebook } from './components/Notebook/SparkNotebook';
import { SparkAiPanel } from './components/Notebook/SparkAiPanel';
import { CatalystDagView } from './components/DagVisualizer/CatalystDagView';
import { SparkWebUi } from './components/Cluster/SparkWebUi';
import { VisualPipelineBuilder } from './components/Pipeline/VisualPipelineBuilder';
import { DatasetCatalog } from './components/DataExplorer/DatasetCatalog';
import { NeuritePathwayGraph } from './components/Neurite/NeuritePathwayGraph';
import { AccountMap } from './components/AccountMap/AccountMap';
import { ClusterSettingsModal } from './components/Settings/ClusterSettingsModal';
import { GoogleDrivePickerModal } from './components/Drive/GoogleDrivePickerModal';
import { WorkspaceToolsModal } from './components/Workspace/WorkspaceToolsModal';
import { JulesAgentModal } from './components/Jules/JulesAgentModal';
import { McpIntegrationModal } from './components/MCP/McpIntegrationModal';
import { SparkExecutionEngine } from './engine/sparkEngine';
import { ClusterConfig, QueryResult } from './types/spark';

const engine = new SparkExecutionEngine();

export default function App() {
  const [activeTab, setActiveTab] = useState<'notebook' | 'dag' | 'webui' | 'pipeline' | 'catalog' | 'pathways' | 'accountmap'>('notebook');
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);

  const [clusterConfig, setClusterConfig] = useState<ClusterConfig>({
    masterUrl: 'local[*]',
    sparkVersion: '3.5.1',
    driverMemory: '4g',
    executorMemory: '8g',
    executorCores: 4,
    numExecutors: 4,
    dynamicAllocation: true,
    adaptiveQueryExecution: true,
    restApiEndpoint: 'http://localhost:4040/api/v1',
  });

  // AI, Drive Picker, Workspace, Jules, MCP & Settings Modals State
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiModalCode, setAiModalCode] = useState<string>('');
  const [aiModalMode, setAiModalMode] = useState<'pyspark' | 'sql'>('pyspark');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDrivePickerModal, setShowDrivePickerModal] = useState<boolean>(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [showJulesModal, setShowJulesModal] = useState<boolean>(false);
  const [showMcpModal, setShowMcpModal] = useState<boolean>(false);

  // Initialize sample result on load
  useEffect(() => {
    const defaultCode = `# PySpark DataFrame Regional Sales Aggregation
from pyspark.sql import functions as F

df = spark.read.table("ecommerce_sales")

sales_summary = df.filter(F.col("region").isNotNull()) \\
    .groupBy("region") \\
    .agg(
        F.count("order_id").alias("order_count"),
        F.round(F.sum("price"), 2).alias("total_revenue"),
        F.round(F.avg("price"), 2).alias("avg_order_value")
    ) \\
    .orderBy(F.col("total_revenue").desc())

sales_summary.show(10)`;

    const res = engine.executeQuery(defaultCode, 'pyspark');
    setCurrentResult(res);
  }, []);

  const handleOpenAiOptimize = (code: string, mode: 'pyspark' | 'sql') => {
    setAiModalCode(code);
    setAiModalMode(mode);
    setShowAiModal(true);
  };

  const handleApplyAiCode = (optimizedCode: string) => {
    const res = engine.executeQuery(optimizedCode, aiModalMode);
    setCurrentResult(res);
    setActiveTab('notebook');
  };

  const handleViewDagFromNotebook = (plan: any) => {
    setActiveTab('dag');
  };

  const handleRunPipelineInNotebook = (code: string) => {
    const res = engine.executeQuery(code, 'pyspark');
    setCurrentResult(res);
    setActiveTab('notebook');
  };

  const handleQueryDatasetFromCatalog = (datasetName: string) => {
    const code = `SELECT * FROM ${datasetName} LIMIT 20;`;
    const res = engine.executeQuery(code, 'sql');
    setCurrentResult(res);
    setActiveTab('notebook');
  };

  const handleImportDriveCode = (code: string, fileName: string, mode: 'pyspark' | 'sql') => {
    const res = engine.executeQuery(code, mode);
    setCurrentResult(res);
    setActiveTab('notebook');
  };

  const handleApplyJulesPatch = (patchCode: string) => {
    const res = engine.executeQuery(patchCode, 'pyspark');
    setCurrentResult(res);
    setActiveTab('notebook');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white flex flex-col">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clusterConfig={clusterConfig}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenAiAssist={() => handleOpenAiOptimize(currentResult?.query || '', 'pyspark')}
        onOpenDrivePicker={() => setShowDrivePickerModal(true)}
        onOpenWorkspaceTools={() => setShowWorkspaceModal(true)}
        onOpenJulesAgent={() => setShowJulesModal(true)}
        onOpenMcpHub={() => setShowMcpModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'notebook' && (
          <SparkNotebook
            engine={engine}
            onOpenAiOptimize={handleOpenAiOptimize}
            onViewDag={handleViewDagFromNotebook}
            onOpenDrivePicker={() => setShowDrivePickerModal(true)}
            currentResult={currentResult}
            setCurrentResult={setCurrentResult}
          />
        )}

        {activeTab === 'dag' && currentResult && (
          <CatalystDagView plan={currentResult.catalystPlan} />
        )}

        {activeTab === 'webui' && (
          <SparkWebUi config={clusterConfig} />
        )}

        {activeTab === 'pipeline' && (
          <VisualPipelineBuilder onRunInNotebook={handleRunPipelineInNotebook} />
        )}

        {activeTab === 'catalog' && (
          <DatasetCatalog
            datasets={engine.getDatasets()}
            onQueryDataset={handleQueryDatasetFromCatalog}
          />
        )}

        {activeTab === 'pathways' && (
          <NeuritePathwayGraph />
        )}

        {activeTab === 'accountmap' && (
          <AccountMap
            onOpenWorkspaceTools={() => setShowWorkspaceModal(true)}
            onOpenMcpHub={() => setShowMcpModal(true)}
            onOpenDrivePicker={() => setShowDrivePickerModal(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Apache Spark Analytics Studio • Cloud SQL, Firebase, Jules, Gemini Spark & Model Context Protocol (MCP) Integrated</span>
          <span className="font-mono text-[11px] text-slate-600">Master: {clusterConfig.masterUrl} | Version: {clusterConfig.sparkVersion}</span>
        </div>
      </footer>

      {/* Modals */}
      {showAiModal && (
        <SparkAiPanel
          initialCode={aiModalCode}
          initialMode={aiModalMode}
          onClose={() => setShowAiModal(false)}
          onApplyCode={handleApplyAiCode}
          onOpenJulesAgent={() => setShowJulesModal(true)}
        />
      )}

      {showSettingsModal && (
        <ClusterSettingsModal
          config={clusterConfig}
          onSaveConfig={setClusterConfig}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showDrivePickerModal && (
        <GoogleDrivePickerModal
          isOpen={showDrivePickerModal}
          onClose={() => setShowDrivePickerModal(false)}
          onImportCode={handleImportDriveCode}
          currentCodeToExport={currentResult?.query}
          currentMode="pyspark"
        />
      )}

      {showWorkspaceModal && (
        <WorkspaceToolsModal
          isOpen={showWorkspaceModal}
          onClose={() => setShowWorkspaceModal(false)}
          activeCode={currentResult?.query || ''}
        />
      )}

      {showJulesModal && (
        <JulesAgentModal
          isOpen={showJulesModal}
          onClose={() => setShowJulesModal(false)}
          currentCode={currentResult?.query || ''}
          currentMode="pyspark"
          onApplyPatch={handleApplyJulesPatch}
        />
      )}

      {showMcpModal && (
        <McpIntegrationModal
          isOpen={showMcpModal}
          onClose={() => setShowMcpModal(false)}
          activeCode={currentResult?.query}
        />
      )}
    </div>
  );
}
