import { INITIAL_DATASETS } from '../data/datasets';
import { CatalystPlan, ColumnSchema, DagEdge, DagNode, QueryMode, QueryResult, SparkDataset } from '../types/spark';

export class SparkExecutionEngine {
  private datasets: SparkDataset[];

  constructor(datasets: SparkDataset[] = INITIAL_DATASETS) {
    this.datasets = datasets;
  }

  public getDatasets(): SparkDataset[] {
    return this.datasets;
  }

  public getDatasetByName(name: string): SparkDataset | undefined {
    return this.datasets.find(d => d.name.toLowerCase() === name.toLowerCase());
  }

  public executeQuery(codeOrQuery: string, mode: QueryMode): QueryResult {
    const startTime = performance.now();
    const executionId = 'exec-' + Math.random().toString(36).substring(2, 9);

    try {
      if (mode === 'sql') {
        return this.executeSql(codeOrQuery, startTime, executionId);
      } else {
        return this.executePySpark(codeOrQuery, startTime, executionId);
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      return {
        executionId,
        query: codeOrQuery,
        mode,
        status: 'ERROR',
        executionTimeMs: duration,
        schema: [],
        data: [],
        totalRows: 0,
        shuffleReadMb: 0,
        shuffleWriteMb: 0,
        catalystPlan: this.buildMockCatalystPlan('unknown', [], false),
        errorMessage: err.message || 'Error executing Spark code.'
      };
    }
  }

  private executeSql(sql: string, startTime: number, executionId: string): QueryResult {
    const normalized = sql.trim();
    let targetDataset = this.datasets[0];
    
    // Simple parser for table name
    const fromMatch = normalized.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (fromMatch && fromMatch[1]) {
      const found = this.getDatasetByName(fromMatch[1]);
      if (found) targetDataset = found;
    }

    let rows = [...targetDataset.sampleData];
    let schema = [...targetDataset.schema];
    let shuffleReadMb = 0.45;
    let shuffleWriteMb = 0.42;

    // Filter handling
    const whereMatch = normalized.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);
    if (whereMatch) {
      const cond = whereMatch[1].trim();
      if (cond.includes('=')) {
        const [col, val] = cond.split('=').map(s => s.trim().replace(/['"]/g, ''));
        if (col && val) {
          rows = rows.filter(r => String(r[col]).toLowerCase() === val.toLowerCase() || String(r[col]) === val);
        }
      } else if (cond.includes('>')) {
        const [col, val] = cond.split('>').map(s => s.trim().replace(/['"]/g, ''));
        if (col && val && !isNaN(Number(val))) {
          rows = rows.filter(r => Number(r[col]) > Number(val));
        }
      }
    }

    // Group By & Aggregation handling
    const groupByMatch = normalized.match(/GROUP\s+BY\s+([a-zA-Z0-9_,\s]+)/i);
    if (groupByMatch) {
      shuffleReadMb = 2.85;
      shuffleWriteMb = 2.40;
      const groupCols = groupByMatch[1].split(',').map(s => s.trim());
      
      const groups: Record<string, { groupValues: Record<string, any>; items: any[] }> = {};
      
      rows.forEach(row => {
        const key = groupCols.map(c => row[c]).join('::');
        if (!groups[key]) {
          const groupValues: Record<string, any> = {};
          groupCols.forEach(c => { groupValues[c] = row[c]; });
          groups[key] = { groupValues, items: [] };
        }
        groups[key].items.push(row);
      });

      // Aggregate calculation
      const aggregatedRows: any[] = [];
      Object.values(groups).forEach(g => {
        const count = g.items.length;
        const totalPrice = g.items.reduce((sum, item) => sum + (Number(item.price || item.latency_ms || item.temperature_c || 1) * Number(item.quantity || 1)), 0);
        const avgVal = (totalPrice / count).toFixed(2);
        
        const newRow: Record<string, any> = { ...g.groupValues };
        newRow['record_count'] = count * 12500; // scaled up to match Spark big dataset scale
        newRow['total_sum'] = Math.round(totalPrice * 18000);
        newRow['avg_value'] = Number(avgVal);

        aggregatedRows.push(newRow);
      });

      rows = aggregatedRows;

      schema = [
        ...groupCols.map(c => ({ name: c, type: targetDataset.schema.find(s => s.name === c)?.type || 'StringType', nullable: false } as ColumnSchema)),
        { name: 'record_count', type: 'LongType', nullable: false },
        { name: 'total_sum', type: 'DoubleType', nullable: false },
        { name: 'avg_value', type: 'DoubleType', nullable: false }
      ];
    }

    // Order By handling
    const orderByMatch = normalized.match(/ORDER\s+BY\s+([a-zA-Z0-9_]+)(\s+DESC|\s+ASC)?/i);
    if (orderByMatch) {
      const orderCol = orderByMatch[1].trim();
      const isDesc = orderByMatch[2] ? orderByMatch[2].trim().toUpperCase() === 'DESC' : false;
      
      rows.sort((a, b) => {
        const valA = a[orderCol];
        const valB = b[orderCol];
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    }

    // Limit handling
    const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      rows = rows.slice(0, limitVal);
    }

    const duration = Math.round(performance.now() - startTime + Math.random() * 85 + 40);

    const catalystPlan = this.buildMockCatalystPlan(targetDataset.name, schema, groupByMatch !== null);

    return {
      executionId,
      query: sql,
      mode: 'sql',
      status: 'SUCCESS',
      executionTimeMs: duration,
      schema,
      data: rows,
      totalRows: rows.length,
      shuffleReadMb,
      shuffleWriteMb,
      catalystPlan
    };
  }

  private executePySpark(code: string, startTime: number, executionId: string): QueryResult {
    let targetDataset = this.datasets[0];

    // Detect dataset from read statement
    this.datasets.forEach(d => {
      if (code.includes(d.name)) targetDataset = d;
    });

    let rows = [...targetDataset.sampleData];
    let schema = [...targetDataset.schema];
    let shuffleReadMb = 0.85;
    let shuffleWriteMb = 0.72;

    const hasGroupBy = code.includes('.groupBy(') || code.includes('.agg(');
    const hasFilter = code.includes('.filter(') || code.includes('.where(');
    const hasSort = code.includes('.orderBy(') || code.includes('.sort(');

    if (hasGroupBy) {
      shuffleReadMb = 4.12;
      shuffleWriteMb = 3.88;

      // Group by region or category or first string column
      const groupCol = schema.find(s => s.type === 'StringType')?.name || 'region';
      const groups: Record<string, any[]> = {};

      rows.forEach(r => {
        const k = String(r[groupCol] || 'Other');
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      });

      const aggRows: any[] = [];
      Object.entries(groups).forEach(([grpVal, items]) => {
        const total = items.reduce((sum, item) => sum + (Number(item.price || item.latency_ms || item.temperature_c || 10) * Number(item.quantity || 1)), 0);
        aggRows.push({
          [groupCol]: grpVal,
          total_metric: Math.round(total * 24000),
          avg_metric: Number((total / items.length).toFixed(2)),
          partition_count: items.length * 15000
        });
      });

      rows = aggRows;

      schema = [
        { name: groupCol, type: 'StringType', nullable: false },
        { name: 'total_metric', type: 'DoubleType', nullable: false },
        { name: 'avg_metric', type: 'DoubleType', nullable: false },
        { name: 'partition_count', type: 'LongType', nullable: false }
      ];
    }

    if (hasSort) {
      rows.sort((a, b) => (b.total_metric || b.price || 0) - (a.total_metric || a.price || 0));
    }

    const duration = Math.round(performance.now() - startTime + Math.random() * 110 + 60);
    const catalystPlan = this.buildMockCatalystPlan(targetDataset.name, schema, hasGroupBy);

    return {
      executionId,
      query: code,
      mode: 'pyspark',
      status: 'SUCCESS',
      executionTimeMs: duration,
      schema,
      data: rows,
      totalRows: rows.length,
      shuffleReadMb,
      shuffleWriteMb,
      catalystPlan
    };
  }

  private buildMockCatalystPlan(tableName: string, schema: ColumnSchema[], hasShuffle: boolean): CatalystPlan {
    const nodes: DagNode[] = [
      {
        id: 'node-1',
        label: `FileScan parquet default.${tableName}`,
        stageId: 0,
        type: 'FileScan',
        metrics: { recordsIn: 1250000, recordsOut: 1250000, timeMs: 45 },
        details: `Format: Parquet, Location: hdfs://namenode:8020/warehouse/${tableName}, PartitionFilters: [], PushedFilters: []`
      },
      {
        id: 'node-2',
        label: 'Filter (isnotnull)',
        stageId: 0,
        type: 'Filter',
        metrics: { recordsIn: 1250000, recordsOut: 1180000, timeMs: 12 },
        details: 'Condition: (isnotnull(id#0))'
      },
      {
        id: 'node-3',
        label: 'Project [Columns]',
        stageId: 0,
        type: 'Project',
        metrics: { recordsIn: 1180000, recordsOut: 1180000, timeMs: 8 },
        details: `Output: [${schema.slice(0, 3).map(s => s.name).join(', ')}]`
      }
    ];

    const edges: DagEdge[] = [
      { from: 'node-1', to: 'node-2' },
      { from: 'node-2', to: 'node-3' }
    ];

    if (hasShuffle) {
      nodes.push({
        id: 'node-4',
        label: 'HashAggregate (Partial)',
        stageId: 0,
        type: 'HashAggregate',
        metrics: { recordsIn: 1180000, recordsOut: 16, timeMs: 34 },
        details: 'Keys: [groupKey#1], Functions: [partial_sum(price#2)]'
      });

      nodes.push({
        id: 'node-5',
        label: 'Exchange hashpartitioning(200)',
        stageId: 0,
        type: 'ShuffleExchange',
        metrics: { recordsIn: 16, recordsOut: 16, shuffleWriteBytes: 4200000, shuffleReadBytes: 4200000, timeMs: 85 },
        details: 'Partitioning: hashpartitioning(200), Shuffle write: 4.2 MB'
      });

      nodes.push({
        id: 'node-6',
        label: 'HashAggregate (Final)',
        stageId: 1,
        type: 'HashAggregate',
        metrics: { recordsIn: 16, recordsOut: 16, timeMs: 18 },
        details: 'Keys: [groupKey#1], Functions: [sum(price#2)]'
      });

      edges.push({ from: 'node-3', to: 'node-4' });
      edges.push({ from: 'node-4', to: 'node-5', isShuffle: true });
      edges.push({ from: 'node-5', to: 'node-6' });
    }

    return {
      parsedLogicalPlan: `'Aggregate ['groupKey], ['groupKey, sum('price) AS total#10]\n+- 'UnresolvedRelation [${tableName}]`,
      analyzedLogicalPlan: `Aggregate [groupKey#1], [groupKey#1, sum(price#2) AS total#10]\n+- SubqueryAlias spark_catalog.default.${tableName}\n   +- Relation default.${tableName}`,
      optimizedLogicalPlan: `Aggregate [groupKey#1], [groupKey#1, sum(price#2) AS total#10]\n+- Project [groupKey#1, price#2]\n   +- Filter isnotnull(groupKey#1)\n      +- Relation default.${tableName}`,
      physicalPlan: `*(2) HashAggregate(keys=[groupKey#1], functions=[sum(price#2)])\n+- Exchange hashpartitioning(groupKey#1, 200), ENSURE_REQUIREMENTS\n   +- *(1) HashAggregate(keys=[groupKey#1], functions=[partial_sum(price#2)])\n      +- *(1) Project [groupKey#1, price#2]\n         +- *(1) Filter isnotnull(groupKey#1)\n            +- *(1) ColumnarScan parquet default.${tableName}`,
      nodes,
      edges
    };
  }
}
