
export type ViewState = 'dashboard' | 'tokens' | 'builder' | 'documentation' | 'releases' | 'feedback' | 'settings';

export type TokenType = 'color' | 'typography' | 'spacing' | 'sizing' | 'radius' | 'shadow' | 'blur' | 'unknown';

export interface Token {
  id: string;
  name: string;
  value: string;
  type: TokenType;
  description?: string;
}

export interface TokenActivity {
  id: string;
  user: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'download';
  target: string;
  timestamp: string;
}

export interface ComponentItem {
  id: string;
  name: string;
  status: 'draft' | 'review' | 'stable' | 'deprecated';
  version: string;
  code: string;
  docs: string;
}

export interface DeploymentStatus {
  step: 'lint' | 'test' | 'build' | 'publish' | 'docs';
  status: 'pending' | 'running' | 'success' | 'failed';
}

export interface Integration {
  name: string;
  connected: boolean;
  icon: string;
  lastSync?: string;
}
