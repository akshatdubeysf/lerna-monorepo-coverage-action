export interface ReportJson {
  total: CoverageSummary;
  [key: string]: CoverageSummary;
}

export interface CoverageSummary {
  lines: Coverage;
  statements: Coverage;
  functions: Coverage;
  branches: Coverage;
}

export interface Coverage {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}
