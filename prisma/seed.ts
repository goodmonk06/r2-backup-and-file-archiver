import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Phase 3 Seeding: Creating comprehensive demo data...\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.notificationHistory.deleteMany();
  await prisma.backupNotification.deleteMany();
  await prisma.retentionExecution.deleteMany();
  await prisma.backupHistory.deleteMany();
  await prisma.backupJob.deleteMany();
  await prisma.retentionPolicy.deleteMany();
  await prisma.backupTemplate.deleteMany();
  await prisma.backupStats.deleteMany();
  await prisma.backupTag.deleteMany();

  // Create Templates
  console.log('\n📋 Creating backup templates...');
  const projectTemplate = await prisma.backupTemplate.create({
    data: {
      name: 'project-template',
      description: 'Standard template for project backups',
      source: './projects/${PROJECT_NAME}',
      bucket: 'company-backups',
      prefix: 'projects/${PROJECT_NAME}/',
      schedule: '0 2 * * *',
      exclude: ['*.tmp', '*.log', 'node_modules/', '.git/'],
      priority: 7,
      retryAttempts: 3,
      tags: ['project', 'daily'],
      variables: { PROJECT_NAME: 'string' },
      isPublic: true,
    },
  });

  const databaseTemplate = await prisma.backupTemplate.create({
    data: {
      name: 'database-template',
      description: 'Template for database dumps',
      source: './db-dumps/${DB_NAME}',
      bucket: 'company-backups',
      prefix: 'databases/${DB_NAME}/',
      schedule: '0 4 * * 0',
      exclude: [],
      priority: 10,
      retryAttempts: 5,
      tags: ['database', 'weekly'],
      variables: { DB_NAME: 'string' },
      isPublic: true,
    },
  });

  const mediaTemplate = await prisma.backupTemplate.create({
    data: {
      name: 'media-template',
      description: 'Template for media file backups',
      source: './media/${CATEGORY}',
      bucket: 'media-backups',
      prefix: '${CATEGORY}/',
      schedule: '0 1 * * *',
      exclude: ['*.cache', '*.tmp'],
      priority: 5,
      tags: ['media'],
      variables: { CATEGORY: 'string' },
      isPublic: false,
    },
  });

  console.log(`  ✅ ${projectTemplate.name}`);
  console.log(`  ✅ ${databaseTemplate.name}`);
  console.log(`  ✅ ${mediaTemplate.name}`);

  // Create Retention Policies
  console.log('\n🗑️  Creating retention policies...');
  const dailyPolicy = await prisma.retentionPolicy.create({
    data: {
      name: 'daily-7-days',
      description: 'Keep daily backups for 7 days',
      retentionDays: 7,
      retentionCount: null,
      deleteAfterDays: 7,
      enabled: true,
    },
  });

  const weeklyPolicy = await prisma.retentionPolicy.create({
    data: {
      name: 'weekly-4-weeks',
      description: 'Keep weekly backups for 4 weeks',
      retentionDays: 28,
      retentionCount: null,
      deleteAfterDays: 28,
      enabled: true,
    },
  });

  const keepLast10 = await prisma.retentionPolicy.create({
    data: {
      name: 'keep-last-10',
      description: 'Keep last 10 backups regardless of age',
      retentionDays: null,
      retentionCount: 10,
      deleteAfterDays: 90,
      enabled: true,
    },
  });

  console.log(`  ✅ ${dailyPolicy.name}`);
  console.log(`  ✅ ${weeklyPolicy.name}`);
  console.log(`  ✅ ${keepLast10.name}`);

  // Create Tags
  console.log('\n🏷️  Creating tags...');
  const tags = await prisma.backupTag.createMany({
    data: [
      { name: 'production', color: '#ef4444', description: 'Production systems' },
      { name: 'staging', color: '#f59e0b', description: 'Staging environments' },
      { name: 'development', color: '#3b82f6', description: 'Development' },
      { name: 'critical', color: '#dc2626', description: 'Mission critical data' },
      { name: 'compliance', color: '#9333ea', description: 'Compliance required' },
    ],
  });
  console.log(`  ✅ Created ${tags.count} tags`);

  // Create Jobs
  console.log('\n💼 Creating backup jobs...');
  const job1 = await prisma.backupJob.create({
    data: {
      name: 'api-server-backup',
      description: 'Daily backup of API server files',
      source: './data/api-server',
      bucket: 'company-backups',
      prefix: 'api-server/',
      schedule: '0 2 * * *',
      exclude: ['*.log', '*.tmp'],
      enabled: true,
      priority: 8,
      retentionPolicyId: dailyPolicy.id,
      tags: ['production', 'critical'],
    },
  });

  const job2 = await prisma.backupJob.create({
    data: {
      name: 'customer-data',
      description: 'Customer data backup with compliance requirements',
      source: './data/customers',
      bucket: 'compliance-backups',
      prefix: 'customers/',
      schedule: '0 3 * * *',
      exclude: [],
      enabled: true,
      priority: 10,
      retentionPolicyId: keepLast10.id,
      tags: ['production', 'critical', 'compliance'],
      templateId: projectTemplate.id,
    },
  });

  const job3 = await prisma.backupJob.create({
    data: {
      name: 'development-projects',
      description: 'Development project backups',
      source: './projects/dev',
      bucket: 'dev-backups',
      prefix: 'projects/',
      schedule: '0 1 * * *',
      exclude: ['node_modules/', '.git/', '*.tmp'],
      enabled: true,
      priority: 5,
      retentionPolicyId: dailyPolicy.id,
      tags: ['development'],
    },
  });

  const job4 = await prisma.backupJob.create({
    data: {
      name: 'weekly-database',
      description: 'Weekly database dumps',
      source: './db-dumps/postgres',
      bucket: 'company-backups',
      prefix: 'databases/',
      schedule: '0 4 * * 0',
      exclude: [],
      enabled: true,
      priority: 10,
      retentionPolicyId: weeklyPolicy.id,
      tags: ['production', 'critical'],
      templateId: databaseTemplate.id,
    },
  });

  const job5 = await prisma.backupJob.create({
    data: {
      name: 'staging-environment',
      description: 'Staging environment backup',
      source: './data/staging',
      bucket: 'company-backups',
      prefix: 'staging/',
      schedule: '0 6 * * *',
      exclude: ['*.cache'],
      enabled: false,
      priority: 3,
      tags: ['staging'],
    },
  });

  console.log(`  ✅ ${job1.name}`);
  console.log(`  ✅ ${job2.name}`);
  console.log(`  ✅ ${job3.name}`);
  console.log(`  ✅ ${job4.name}`);
  console.log(`  ✅ ${job5.name} (disabled)`);

  // Create Backup History
  console.log('\n📊 Creating backup history...');
  const now = new Date();
  const histories = [];

  // Last 7 days of successful backups for job1
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(2, 0, 0, 0);

    histories.push({
      jobId: job1.id,
      jobName: job1.name,
      totalFiles: 120 + i * 5,
      uploadedFiles: 8 + i,
      skippedFiles: 112,
      totalBytes: BigInt(1024 * 1024 * (500 + i * 10)),
      uploadedBytes: BigInt(1024 * 1024 * (50 + i)),
      errors: [],
      warnings: [],
      startTime: date,
      endTime: new Date(date.getTime() + 5 * 60 * 1000),
      duration: 5 * 60 * 1000,
      status: 'success',
      triggeredBy: 'scheduled',
      retryCount: 0,
    });
  }

  // Recent successful backup for job2
  histories.push({
    jobId: job2.id,
    jobName: job2.name,
    totalFiles: 458,
    uploadedFiles: 23,
    skippedFiles: 435,
    totalBytes: BigInt(1024 * 1024 * 2048),
    uploadedBytes: BigInt(1024 * 1024 * 123),
    errors: [],
    warnings: ['File permissions changed: users.dat'],
    startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
    duration: 15 * 60 * 1000,
    status: 'success',
    triggeredBy: 'scheduled',
    retryCount: 0,
  });

  // Failed backup for job3
  histories.push({
    jobId: job3.id,
    jobName: job3.name,
    totalFiles: 89,
    uploadedFiles: 42,
    skippedFiles: 0,
    totalBytes: BigInt(1024 * 1024 * 356),
    uploadedBytes: BigInt(1024 * 1024 * 178),
    errors: ['Connection timeout', 'Retry limit exceeded'],
    warnings: [],
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
    duration: 10 * 60 * 1000,
    status: 'partial',
    triggeredBy: 'manual',
    retryCount: 3,
  });

  await prisma.backupHistory.createMany({ data: histories });
  console.log(`  ✅ Created ${histories.length} backup history records`);

  // Create Notifications
  console.log('\n🔔 Creating notifications...');
  const webhook1 = await prisma.backupNotification.create({
    data: {
      jobId: job1.id,
      name: 'API Server Alerts',
      type: 'webhook',
      enabled: true,
      triggerOn: ['failure', 'warning'],
      config: {
        url: 'https://hooks.example.com/backup-alerts',
        method: 'POST',
      },
    },
  });

  const globalWebhook = await prisma.backupNotification.create({
    data: {
      jobId: null,
      name: 'Global Critical Alerts',
      type: 'webhook',
      enabled: true,
      triggerOn: ['failure'],
      config: {
        url: 'https://ops.example.com/critical-alerts',
        method: 'POST',
        headers: { 'X-Api-Key': 'demo-key' },
      },
    },
  });

  console.log(`  ✅ ${webhook1.name}`);
  console.log(`  ✅ ${globalWebhook.name}`);

  // Create Stats
  console.log('\n📈 Creating backup statistics...');
  const stats = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    stats.push({
      date,
      totalBackups: 4 + Math.floor(Math.random() * 3),
      successfulBackups: 3 + Math.floor(Math.random() * 2),
      failedBackups: Math.floor(Math.random() * 2),
      totalFilesUploaded: 150 + Math.floor(Math.random() * 50),
      totalBytesUploaded: BigInt(1024 * 1024 * (500 + Math.floor(Math.random() * 200))),
      totalBytesStored: BigInt(1024 * 1024 * 1024 * (10 + i)),
      averageDurationMs: 5 * 60 * 1000 + Math.floor(Math.random() * 3 * 60 * 1000),
      activeJobs: 4,
    });
  }

  await prisma.backupStats.createMany({ data: stats });
  console.log(`  ✅ Created ${stats.count} days of statistics`);

  // Create Retention Executions
  console.log('\n🧹 Creating retention execution records...');
  await prisma.retentionExecution.createMany({
    data: [
      {
        policyId: dailyPolicy.id,
        deletedCount: 12,
        archivedCount: 0,
        freedBytes: BigInt(1024 * 1024 * 567),
        status: 'success',
        errors: [],
        executedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        policyId: weeklyPolicy.id,
        deletedCount: 3,
        archivedCount: 0,
        freedBytes: BigInt(1024 * 1024 * 1024 * 2),
        status: 'success',
        errors: [],
        executedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log('  ✅ Created retention execution records');

  console.log('\n✅ Phase 3 seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log('  • 3 Backup Templates');
  console.log('  • 3 Retention Policies');
  console.log('  • 5 Tags');
  console.log('  • 5 Backup Jobs (4 enabled, 1 disabled)');
  console.log(`  • ${histories.length} Backup History Records`);
  console.log('  • 2 Notification Configurations');
  console.log('  • 30 Days of Statistics');
  console.log('  • 2 Retention Execution Records');
  console.log('\n🚀 Ready to explore at http://localhost:3000\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
