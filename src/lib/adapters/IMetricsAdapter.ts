/**
 * Metrics Adapter Interface
 *
 * Abstracts metrics collection and monitoring systems
 * (Prometheus, Datadog, CloudWatch, etc.)
 */

export interface MetricLabels {
  [key: string]: string | number;
}

export interface IMetricsAdapter {
  /**
   * Adapter name for identification
   */
  readonly name: string;

  /**
   * Record a counter metric (monotonically increasing)
   */
  recordCounter(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Record a gauge metric (can go up or down)
   */
  recordGauge(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Record a histogram metric (distribution of values)
   */
  recordHistogram(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Start timing an operation
   */
  startTimer(name: string, labels?: MetricLabels): () => void;

  /**
   * Flush metrics (if buffered)
   */
  flush(): Promise<void>;
}
