#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { getEnvConfig } from './config/env.js';
import { loadBackupConfig, getJobByName, getEnabledJobs } from './config-loader/backupConfigLoader.js';
import { BackupRunner, LogLevel } from './backup/backupRunner.js';
import { scheduleMultipleJobs } from './scheduler/index.js';

const program = new Command();

program
  .name('r2-backup')
  .description('Cloudflare R2バックアップツール')
  .version('0.1.0');

/**
 * バックアップ実行コマンド
 */
program
  .command('run')
  .description('バックアップジョブを実行')
  .option('-j, --job <name>', 'ジョブ名を指定')
  .option('-c, --config <path>', '設定ファイルのパス')
  .option('-v, --verbose', '詳細ログを表示')
  .action(async (options) => {
    try {
      // 環境変数を読み込み
      const envConfig = getEnvConfig();

      // 設定ファイルのパスを決定
      const configPath = options.config || envConfig.backupConfigPath;
      const absoluteConfigPath = path.resolve(configPath);

      console.log(`Loading config from: ${absoluteConfigPath}`);

      // バックアップ設定を読み込み
      const backupConfig = loadBackupConfig(absoluteConfigPath);

      // ログレベルの設定
      const logLevel = options.verbose ? LogLevel.DEBUG : LogLevel.INFO;
      const runner = new BackupRunner(logLevel);

      if (options.job) {
        // 特定のジョブを実行
        const job = getJobByName(backupConfig, options.job);
        if (!job) {
          console.error(`Error: Job '${options.job}' not found in config`);
          process.exit(1);
        }

        if (!job.enabled) {
          console.warn(`Warning: Job '${options.job}' is disabled`);
        }

        const result = await runner.runBackup(job);

        if (result.errors.length > 0) {
          console.error('\nErrors occurred during backup:');
          result.errors.forEach((err) => console.error(`  - ${err}`));
          process.exit(1);
        }
      } else {
        // 全ての有効なジョブを実行
        const enabledJobs = getEnabledJobs(backupConfig);

        if (enabledJobs.length === 0) {
          console.warn('No enabled jobs found in config');
          process.exit(0);
        }

        console.log(`Running ${enabledJobs.length} enabled job(s)...\n`);

        let hasErrors = false;
        for (const job of enabledJobs) {
          console.log(`\n${'='.repeat(60)}`);
          const result = await runner.runBackup(job);

          if (result.errors.length > 0) {
            hasErrors = true;
          }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log('All jobs completed');

        if (hasErrors) {
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * ジョブ一覧表示コマンド
 */
program
  .command('list')
  .description('設定されているジョブの一覧を表示')
  .option('-c, --config <path>', '設定ファイルのパス')
  .action(async (options) => {
    try {
      const envConfig = getEnvConfig();
      const configPath = options.config || envConfig.backupConfigPath;
      const absoluteConfigPath = path.resolve(configPath);

      const backupConfig = loadBackupConfig(absoluteConfigPath);

      console.log(`\nBackup Jobs (${backupConfig.jobs.length} total):\n`);

      backupConfig.jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.name}`);
        console.log(`   Status: ${job.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`   Source: ${job.source}`);
        console.log(`   Destination: ${job.bucket}/${job.prefix}`);
        console.log(`   Schedule: ${job.schedule}`);
        if (job.exclude && job.exclude.length > 0) {
          console.log(`   Exclude: ${job.exclude.join(', ')}`);
        }
        console.log('');
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * スケジューラー起動コマンド（将来拡張用）
 */
program
  .command('schedule')
  .description('スケジューラーを起動して定期バックアップを実行')
  .option('-c, --config <path>', '設定ファイルのパス')
  .action(async (options) => {
    try {
      const envConfig = getEnvConfig();
      const configPath = options.config || envConfig.backupConfigPath;
      const absoluteConfigPath = path.resolve(configPath);

      const backupConfig = loadBackupConfig(absoluteConfigPath);
      const enabledJobs = getEnabledJobs(backupConfig);

      if (enabledJobs.length === 0) {
        console.warn('No enabled jobs found in config');
        process.exit(0);
      }

      console.log(`Scheduling ${enabledJobs.length} job(s)...\n`);

      const scheduler = scheduleMultipleJobs(enabledJobs);
      scheduler.startAll();

      console.log('Scheduler started. Press Ctrl+C to stop.\n');

      // プロセスが終了しないように待機
      process.on('SIGINT', () => {
        console.log('\nStopping scheduler...');
        scheduler.stopAll();
        process.exit(0);
      });

      // 無限ループで待機
      await new Promise(() => {});
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// コマンドライン引数をパース
program.parse();
