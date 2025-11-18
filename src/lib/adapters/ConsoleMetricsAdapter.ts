import { IMetricsAdapter, MetricLabels } from './IMetricsAdapter.js';

/**
 * Console Metrics Adapter
 * Logs metrics to console (useful for development)
 */
export class ConsoleMetricsAdapter implements IMetricsAdapter {
  readonly name = 'console';

  private formatLabels(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const pairs = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
    return `{${pairs.join(', ')}}`;
  }

  recordCounter(name: string, value: number, labels?: MetricLabels): void {
    console.log(`[METRIC] counter: ${name}${this.formatLabels(labels)} += ${value}`);
  }

  recordGauge(name: string, value: number, labels?: MetricLabels): void {
    console.log(`[METRIC] gauge: ${name}${this.formatLabels(labels)} = ${value}`);
  }

  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    console.log(`[METRIC] histogram: ${name}${this.formatLabels(labels)} observe ${value}`);
  }

  startTimer(name: string, labels?: MetricLabels): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(name, duration, labels);
    };
  }

  async flush(): Promise<void> {
    // Console doesn't need flushing
    return Promise.resolve();
  }
}
