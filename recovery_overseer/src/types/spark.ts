export type QueryMode = 'pyspark' | 'sql' | 'streaming';

export interface ColumnSchema {
  name: string;
  type: 'StringType' | 'LongType' | 'DoubleType' | 'TimestampType' | 'BooleanType' | 'IntegerType';
  nullable: boolean;
}

export interface SparkDataset {
  id: string;
  name: string;
  description: string;
  rowCount: number;
  sizeMb: number;
  partitionCount: number;
  schema: ColumnSchema[];
  sampleData: Record<string, any>[];
  storageLevel?: string;
}

export interface DagNode {
  id: string;
  label: string;
  stageId: number;
  type: 'FileScan' | 'Filter' | 'Project' | 'ShuffleExchange' | 'HashAggregate' | 'BroadcastExchange' | 'BroadcastHashJoin' | 'Sort' | 'Output';
  metrics: {
    recordsIn?: number;
    recordsOut?: number;
    shuffleReadBytes?: number;
    shuffleWriteBytes?: number;
    spillToDiskBytes?: number;
    timeMs?: number;
  };
  details?: string;
}

export interface DagEdge {
  from: string;
  to: string;
  isShuffle?: boolean;
}

export interface CatalystPlan {
  parsedLogicalPlan: string;
  analyzedLogicalPlan: string;
  optimizedLogicalPlan: string;
  physicalPlan: string;
  nodes: DagNode[];
  edges: DagEdge[];
}

export interface QueryResult {
  executionId: string;
  query: string;
  mode: QueryMode;
  status: 'SUCCESS' | 'ERROR' | 'RUNNING';
  executionTimeMs: number;
  schema: ColumnSchema[];
  data: Record<string, any>[];
  totalRows: number;
  shuffleReadMb: number;
  shuffleWriteMb: number;
  catalystPlan: CatalystPlan;
  errorMessage?: string;
  codeGenerated?: string;
}

export interface SparkJob {
  jobId: number;
  name: string;
  submittedTime: string;
  durationMs: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  stagesCount: number;
  completedStages: number;
  tasksCount: number;
  completedTasks: number;
}

export interface SparkStage {
  stageId: number;
  name: string;
  submittedTime: string;
  durationMs: number;
  status: 'ACTIVE' | 'COMPLETE' | 'FAILED';
  tasksTotal: number;
  tasksComplete: number;
  shuffleReadBytes: number;
  shuffleWriteBytes: number;
}

export interface SparkExecutor {
  id: string;
  hostPort: string;
  status: 'Active' | 'Dead';
  rddBlocks: number;
  memoryUsedMb: number;
  maxMemoryMb: number;
  cores: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalDurationMs: number;
  gcTimeMs: number;
}

export interface SparkStorageRDD {
  id: number;
  name: string;
  storageLevel: string;
  partitionsCount: number;
  cachedPartitions: number;
  sizeInMemoryMb: number;
  sizeOnDiskMb: number;
}

export interface ClusterConfig {
  masterUrl: string; // e.g. local[*], spark://master:7077
  sparkVersion: string;
  driverMemory: string;
  executorMemory: string;
  executorCores: number;
  numExecutors: number;
  dynamicAllocation: boolean;
  adaptiveQueryExecution: boolean;
  restApiEndpoint?: string;
}

export interface AiOptimizationResult {
  originalCode: string;
  optimizedCode: string;
  summary: string;
  antiPatternsDetected: string[];
  performanceGainEstimate: string;
  suggestions: {
    category: 'Memory' | 'Shuffle' | 'Partitioning' | 'Join Optimization' | 'Caching';
    title: string;
    description: string;
    codeSnippet?: string;
  }[];
}

export interface PipelineStep {
  id: string;
  type: 'Source' | 'Filter' | 'Select' | 'GroupBy' | 'Join' | 'Sort' | 'Sink';
  title: string;
  config: Record<string, any>;
}
