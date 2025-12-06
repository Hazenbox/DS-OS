import { Id } from "../../convex/_generated/dataModel";

export type ViewState = 'dashboard' | 'tokens' | 'builder' | 'documentation' | 'releases' | 'feedback' | 'settings' | 'projects';

export type TokenType = 'color' | 'typography' | 'spacing' | 'sizing' | 'radius' | 'shadow' | 'blur' | 'unknown';

// Legacy Token type for backward compatibility during migration
export interface Token {
  id: string;
  name: string;
  value: string;
  type: TokenType;
  description?: string;
  brand?: string;
}

// Convex Token type with proper ID
export interface ConvexToken {
  _id: Id<"tokens">;
  _creationTime: number;
  name: string;
  value: string;
  type: TokenType;
  description?: string;
  brand?: string;
}

export interface TokenActivity {
  id: string;
  user: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'download' | 'release';
  target: string;
  targetType: 'token' | 'component' | 'release' | 'system';
  timestamp: number;
}

// Convex Activity type
export interface ConvexActivity {
  _id: Id<"activity">;
  _creationTime: number;
  user: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'download' | 'release';
  target: string;
  targetType: 'token' | 'component' | 'release' | 'system';
}

// Legacy Component type for backward compatibility
export interface ComponentItem {
  id: string;
  name: string;
  status: 'draft' | 'review' | 'stable' | 'deprecated';
  version: string;
  code: string;
  docs: string;
}

// Convex Component type
export interface ConvexComponent {
  _id: Id<"components">;
  _creationTime: number;
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

// Convex Release type
export interface ConvexRelease {
  _id: Id<"releases">;
  _creationTime: number;
  version: string;
  status: 'draft' | 'in_progress' | 'published' | 'failed';
  changelog: string;
  publishedAt?: number;
  components: string[];
}

// Helper to convert Convex types to legacy types for backward compatibility
export function convexTokenToLegacy(token: ConvexToken): Token {
  return {
    id: token._id,
    name: token.name,
    value: token.value,
    type: token.type,
    description: token.description,
    brand: token.brand,
  };
}

export function convexComponentToLegacy(component: ConvexComponent): ComponentItem {
  return {
    id: component._id,
    name: component.name,
    status: component.status,
    version: component.version,
    code: component.code,
    docs: component.docs,
  };
}

export function convexActivityToLegacy(activity: ConvexActivity): TokenActivity {
  return {
    id: activity._id,
    user: activity.user,
    action: activity.action,
    target: activity.target,
    targetType: activity.targetType,
    timestamp: activity._creationTime,
  };
}
