/**
 * Job boundary for durable background work. No hand-rolled production queue is
 * provided here: select a mature Redis-backed worker implementation during the
 * worker deployment phase and keep application code behind this contract.
 */
export type JobName =
  | "email.send"
  | "certificate.generate"
  | "media.process"
  | "notification.send"
  | "payment.reconcile"
  | "ai.ingest";

export type JobEnvelope<T = unknown> = {
  idempotencyKey: string;
  name: JobName;
  payload: T;
  requestedAt: string;
};

export interface JobQueue {
  enqueue<T>(job: JobEnvelope<T>): Promise<{ jobId: string }>;
}

export interface JobHandler<T = unknown> {
  readonly name: JobName;
  handle(job: JobEnvelope<T>): Promise<void>;
}
