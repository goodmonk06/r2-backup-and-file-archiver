/**
 * Domain Events for Backup System
 *
 * Events enable loosely-coupled integrations and audit trails.
 */

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly aggregateId: string;
  readonly metadata?: Record<string, any>;
}

export interface BackupStartedEvent extends DomainEvent {
  eventType: 'backup.started';
  jobId: string;
  jobName: string;
  source: string;
  bucket: string;
  triggeredBy: string;
}

export interface BackupCompletedEvent extends DomainEvent {
  eventType: 'backup.completed';
  jobId: string;
  jobName: string;
  historyId: string;
  totalFiles: number;
  uploadedFiles: number;
  totalBytes: bigint;
  duration: number;
  status: 'success' | 'partial' | 'failed';
}

export interface BackupFailedEvent extends DomainEvent {
  eventType: 'backup.failed';
  jobId: string;
  jobName: string;
  error: string;
  retryCount: number;
}

export interface RetentionExecutedEvent extends DomainEvent {
  eventType: 'retention.executed';
  policyId: string;
  policyName: string;
  deletedCount: number;
  freedBytes: bigint;
}

export interface NotificationSentEvent extends DomainEvent {
  eventType: 'notification.sent';
  notificationId: string;
  channel: string;
  success: boolean;
}

export type BackupEvent =
  | BackupStartedEvent
  | BackupCompletedEvent
  | BackupFailedEvent
  | RetentionExecutedEvent
  | NotificationSentEvent;

/**
 * Event Handler Interface
 */
export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

/**
 * Simple in-memory event bus
 */
export class EventBus {
  private handlers: Map<string, Set<IEventHandler>> = new Map();

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler as IEventHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler as IEventHandler);
      }
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler.handle(event))
    );

    await Promise.all(promises);
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Global event bus instance
export const eventBus = new EventBus();
