export type {
  AuditEvent,
  FlushResult,
  QueueStatus,
  TelemetryConfig,
} from "./types";
export {
  flushQueue,
  getQueueStatus,
  initTelemetry,
  logApiError,
  logApiIntent,
  logNavigation,
  logScreenAccess,
} from "./telemetryClient";
