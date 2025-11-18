import {
  INotificationAdapter,
  NotificationPayload,
  NotificationResult,
} from './INotificationAdapter.js';

interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Webhook Notification Adapter
 * Sends notifications via HTTP webhooks
 */
export class WebhookNotificationAdapter implements INotificationAdapter {
  readonly name = 'webhook';
  readonly type = 'webhook';

  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = {
      method: 'POST',
      timeout: 5000,
      ...config,
    };
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const response = await fetch(this.config.url, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({
          event: payload.event,
          title: payload.title,
          message: payload.message,
          severity: payload.severity,
          timestamp: payload.timestamp.toISOString(),
          metadata: payload.metadata,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        messageId: response.headers.get('x-message-id') || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async test(): Promise<NotificationResult> {
    return this.send({
      event: 'test',
      title: 'Test Notification',
      message: 'This is a test notification from R2 Backup',
      severity: 'info',
      timestamp: new Date(),
    });
  }

  validateConfig(config: Record<string, any>): boolean {
    return typeof config.url === 'string' && config.url.startsWith('http');
  }
}
