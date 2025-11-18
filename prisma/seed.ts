import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.backupHistory.deleteMany();
  await prisma.backupJob.deleteMany();

  // Create demo backup jobs
  const projectBackup = await prisma.backupJob.create({
    data: {
      name: 'project-files',
      source: './demo-data/projects',
      bucket: 'my-company-backups',
      prefix: 'projects/',
      schedule: '0 2 * * *', // Daily at 2 AM
      exclude: ['*.tmp', '*.log', 'node_modules/'],
      enabled: true,
    },
  });

  const documentsBackup = await prisma.backupJob.create({
    data: {
      name: 'documents-backup',
      source: './demo-data/documents',
      bucket: 'my-company-backups',
      prefix: 'documents/',
      schedule: '0 3 * * *', // Daily at 3 AM
      exclude: ['.DS_Store', 'Thumbs.db'],
      enabled: true,
    },
  });

  const databaseBackup = await prisma.backupJob.create({
    data: {
      name: 'database-dumps',
      source: './demo-data/db-backups',
      bucket: 'my-company-backups',
      prefix: 'databases/',
      schedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
      exclude: [],
      enabled: true,
    },
  });

  const mediaBackup = await prisma.backupJob.create({
    data: {
      name: 'media-files',
      source: './demo-data/media',
      bucket: 'my-company-media',
      prefix: 'backups/',
      schedule: '0 1 * * *', // Daily at 1 AM
      exclude: ['*.cache'],
      enabled: false, // Disabled for demo
    },
  });

  console.log('✅ Created backup jobs:');
  console.log('  -', projectBackup.name);
  console.log('  -', documentsBackup.name);
  console.log('  -', databaseBackup.name);
  console.log('  -', mediaBackup.name);

  // Create some historical backup records
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await prisma.backupHistory.createMany({
    data: [
      {
        jobId: projectBackup.id,
        jobName: projectBackup.name,
        totalFiles: 150,
        uploadedFiles: 12,
        skippedFiles: 138,
        errors: [],
        startTime: new Date(yesterday.getTime()),
        endTime: new Date(yesterday.getTime() + 5 * 60 * 1000), // 5 minutes later
        duration: 5 * 60 * 1000,
        status: 'success',
      },
      {
        jobId: projectBackup.id,
        jobName: projectBackup.name,
        totalFiles: 148,
        uploadedFiles: 8,
        skippedFiles: 140,
        errors: [],
        startTime: new Date(twoDaysAgo.getTime()),
        endTime: new Date(twoDaysAgo.getTime() + 4 * 60 * 1000),
        duration: 4 * 60 * 1000,
        status: 'success',
      },
      {
        jobId: documentsBackup.id,
        jobName: documentsBackup.name,
        totalFiles: 89,
        uploadedFiles: 5,
        skippedFiles: 84,
        errors: [],
        startTime: new Date(yesterday.getTime() + 60 * 60 * 1000), // 1 hour after projects
        endTime: new Date(yesterday.getTime() + 63 * 60 * 1000),
        duration: 3 * 60 * 1000,
        status: 'success',
      },
      {
        jobId: databaseBackup.id,
        jobName: databaseBackup.name,
        totalFiles: 3,
        uploadedFiles: 3,
        skippedFiles: 0,
        errors: [],
        startTime: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000),
        endTime: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
        duration: 10 * 60 * 1000,
        status: 'success',
      },
    ],
  });

  console.log('✅ Created backup history records');
  console.log('🌱 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
