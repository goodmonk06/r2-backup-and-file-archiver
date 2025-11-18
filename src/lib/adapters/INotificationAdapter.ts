/**
 * Notification Adapter Interface
 *
 * Abstracts different notification channels (email, webhook, Slack, Discord, etc.)
 * allowing flexible alerting strategies.
 */

export interface NotificationPayload {
  event: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface INotificationAdapter {
  /**
   * Adapter name for identification
   */
  readonly name: string;

  /**
   * Adapter type (email, webhook, slack, etc.)
   */
  readonly type: string;

  /**
   * Send a notification
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Test the notification configuration
   */
  test(): Promise<NotificationResult>;

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, any>): boolean;
}
