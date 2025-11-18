import cron from 'node-cron';
import { BackupJob } from '../config-loader/backupConfigLoader.js';
import { BackupRunner } from '../backup/backupRunner.js';

/**
 * スケジュールされたジョブの情報
 */
export interface ScheduledJob {
  job: BackupJob;
  cronTask: cron.ScheduledTask;
}

/**
 * バックアップスケジューラー
 * 将来の拡張のために用意されたモジュール
 */
export class BackupScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private runner: BackupRunner;

  constructor() {
    this.runner = new BackupRunner();
  }

  /**
   * ジョブをスケジュールに追加
   */
  scheduleJob(job: BackupJob): void {
    // スケジュール形式の検証
    if (!cron.validate(job.schedule)) {
      throw new Error(`Invalid cron schedule for job '${job.name}': ${job.schedule}`);
    }

    // 既にスケジュールされている場合は削除
    this.unscheduleJob(job.name);

    // cronタスクを作成
    const cronTask = cron.schedule(
      job.schedule,
      async () => {
        console.log(`[Scheduler] Running scheduled backup: ${job.name}`);
        try {
          await this.runner.runBackup(job);
        } catch (error) {
          console.error(`[Scheduler] Failed to run backup '${job.name}':`, error);
        }
      },
      {
        scheduled: false, // 手動で開始
      }
    );

    this.scheduledJobs.set(job.name, { job, cronTask });
    console.log(`[Scheduler] Scheduled job '${job.name}' with schedule: ${job.schedule}`);
  }

  /**
   * ジョブをスケジュールから削除
   */
  unscheduleJob(jobName: string): void {
    const scheduled = this.scheduledJobs.get(jobName);
    if (scheduled) {
      scheduled.cronTask.stop();
      this.scheduledJobs.delete(jobName);
      console.log(`[Scheduler] Unscheduled job '${jobName}'`);
    }
  }

  /**
   * 全てのスケジュールされたジョブを開始
   */
  startAll(): void {
    for (const [name, scheduled] of this.scheduledJobs) {
      scheduled.cronTask.start();
      console.log(`[Scheduler] Started job '${name}'`);
    }
  }

  /**
   * 全てのスケジュールされたジョブを停止
   */
  stopAll(): void {
    for (const [name, scheduled] of this.scheduledJobs) {
      scheduled.cronTask.stop();
      console.log(`[Scheduler] Stopped job '${name}'`);
    }
  }

  /**
   * スケジュールされたジョブの一覧を取得
   */
  getScheduledJobs(): BackupJob[] {
    return Array.from(this.scheduledJobs.values()).map((s) => s.job);
  }
}

/**
 * 複数のジョブをスケジューラーに登録
 * 将来の拡張用ヘルパー関数
 */
export function scheduleMultipleJobs(jobs: BackupJob[]): BackupScheduler {
  const scheduler = new BackupScheduler();

  for (const job of jobs) {
    if (job.enabled) {
      scheduler.scheduleJob(job);
    }
  }

  return scheduler;
}
