export type AuditEventType =
  | "SCREEN_ACCESS"
  | "NAVIGATION"
  | "API_INTENT"
  | "API_ERROR";

export interface AuditEvent {
  type: AuditEventType;
  screenId: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryConfig {
  apiBaseUrl: string;
  batchSize?: number;
  retryIntervalMs?: number;
  maxRetries?: number;
  getKeycloakToken?: () =>
    | {
        sub: string;
        email?: string;
        name?: string;
      }
    | null;
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

export interface QueueStatus {
  pendingCount: number;
  apiStatus: "online" | "offline" | "unknown";
  lastFlushAt?: string;
  sessionEventsSent: number;
}
