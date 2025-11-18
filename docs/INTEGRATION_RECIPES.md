# Integration Recipes

Common patterns for integrating R2 Backup with other services in your ecosystem.

## Table of Contents

1. [Notification Integrations](#notification-integrations)
2. [Monitoring & Metrics](#monitoring--metrics)
3. [CI/CD Integration](#cicd-integration)
4. [Event-Driven Workflows](#event-driven-workflows)
5. [Multi-Tenancy](#multi-tenancy)
6. [Authentication](#authentication)

---

## Notification Integrations

### Slack Notifications

Create a Slack webhook notification for backup failures:

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-id-here",
    "name": "Slack Alerts",
    "type": "webhook",
    "enabled": true,
    "triggerOn": ["failure", "warning"],
    "config": {
      "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }'
```

**Slack Message Format**:

The webhook adapter sends JSON that needs transformation. Use Slack's Block Kit:

```typescript
// Custom Slack adapter implementation
class SlackNotificationAdapter implements INotificationAdapter {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const slackMessage = {
      text: payload.title,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: payload.title,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: payload.message,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Severity: *${payload.severity}* | ${payload.timestamp.toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });

    return { success: response.ok };
  }
}
```

### Email Notifications (via SendGrid)

```typescript
import { INotificationAdapter, NotificationPayload } from './INotificationAdapter';
import sgMail from '@sendgrid/mail';

class SendGridAdapter implements INotificationAdapter {
  readonly name = 'sendgrid';
  readonly type = 'email';

  constructor(private apiKey: string, private from: string) {
    sgMail.setApiKey(apiKey);
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const msg = {
      to: payload.metadata?.to || 'ops@company.com',
      from: this.from,
      subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
      text: payload.message,
      html: `
        <h2>${payload.title}</h2>
        <p>${payload.message}</p>
        <hr>
        <p><small>Event: ${payload.event} | Time: ${payload.timestamp.toISOString()}</small></p>
      `,
    };

    try {
      await sgMail.send(msg);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
```

---

## Monitoring & Metrics

### Prometheus Integration

**Custom Metrics Adapter**:

```typescript
import { IMetricsAdapter, MetricLabels } from './IMetricsAdapter';
import client from 'prom-client';

class PrometheusAdapter implements IMetricsAdapter {
  readonly name = 'prometheus';
  private registry: client.Registry;
  private counters = new Map<string, client.Counter>();
  private gauges = new Map<string, client.Gauge>();
  private histograms = new Map<string, client.Histogram>();

  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });
  }

  recordCounter(name: string, value: number, labels?: MetricLabels): void {
    if (!this.counters.has(name)) {
      this.counters.set(
        name,
        new client.Counter({
          name: `r2_backup_${name}`,
          help: `Counter for ${name}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }

    this.counters.get(name)!.inc(labels as any, value);
  }

  recordGauge(name: string, value: number, labels?: MetricLabels): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(
        name,
        new client.Gauge({
          name: `r2_backup_${name}`,
          help: `Gauge for ${name}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }

    this.gauges.get(name)!.set(labels as any, value);
  }

  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(
        name,
        new client.Histogram({
          name: `r2_backup_${name}`,
          help: `Histogram for ${name}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }

    this.histograms.get(name)!.observe(labels as any, value);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

**Expose Metrics Endpoint**:

```typescript
// In src/api/app.ts
import { prometheusAdapter } from './lib/adapters/PrometheusAdapter';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheusAdapter.getContentType());
  res.end(await prometheusAdapter.getMetrics());
});
```

### Grafana Dashboard

**Sample Prometheus Queries**:

```promql
# Backup success rate (last 24h)
rate(r2_backup_backups_completed{status="success"}[24h])
  / rate(r2_backup_backups_total[24h])

# Average backup duration
histogram_quantile(0.95, rate(r2_backup_duration_ms_bucket[5m]))

# Storage growth
delta(r2_backup_storage_bytes[1d])

# Failed backups alert
rate(r2_backup_backups_completed{status="failed"}[5m]) > 0.1
```

---

## CI/CD Integration

### GitHub Actions

**Backup on Deploy**:

```yaml
name: Backup Before Deploy

on:
  push:
    branches: [main]

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Pre-Deploy Backup
        run: |
          curl -X POST https://backup.company.com/api/jobs/production-db/run \
            -H "Authorization: Bearer ${{ secrets.BACKUP_API_TOKEN }}" \
            -H "Content-Type: application/json"

      - name: Wait for Backup Completion
        run: |
          # Poll backup status
          for i in {1..30}; do
            STATUS=$(curl -s https://backup.company.com/api/jobs/production-db/history?limit=1 \
              -H "Authorization: Bearer ${{ secrets.BACKUP_API_TOKEN }}" \
              | jq -r '.[0].status')

            if [ "$STATUS" == "success" ]; then
              echo "Backup completed successfully"
              exit 0
            elif [ "$STATUS" == "failed" ]; then
              echo "Backup failed"
              exit 1
            fi

            echo "Waiting for backup... ($i/30)"
            sleep 10
          done

          echo "Backup timed out"
          exit 1

      - name: Deploy Application
        run: |
          # Your deployment steps here
```

### GitLab CI

```yaml
backup:
  stage: pre-deploy
  script:
    - |
      curl -X POST $BACKUP_URL/api/jobs/production-backup/run \
        -H "Authorization: Bearer $BACKUP_TOKEN"
  only:
    - main

deploy:
  stage: deploy
  dependencies:
    - backup
  script:
    - echo "Deploying..."
```

---

## Event-Driven Workflows

### Subscribe to Backup Events

**Webhook Receiver Example**:

```typescript
// Receive backup completion webhooks
app.post('/webhooks/backup-completed', async (req, res) => {
  const event = req.body;

  switch (event.status) {
    case 'success':
      // Update deployment dashboard
      await updateDashboard(event.jobName, 'backed_up');

      // Trigger dependent workflows
      if (event.jobName === 'database-backup') {
        await triggerReplication();
      }
      break;

    case 'failed':
      // Create incident in PagerDuty
      await createIncident({
        title: `Backup Failed: ${event.jobName}`,
        details: event.errors.join(', '),
        urgency: 'high',
      });
      break;
  }

  res.sendStatus(200);
});
```

### Event Bus Integration

**Custom Event Handler**:

```typescript
import { eventBus, BackupCompletedEvent } from './lib/events/BackupEvents';

// Analytics tracking
eventBus.subscribe('backup.completed', {
  async handle(event: BackupCompletedEvent) {
    await analytics.track('backup_completed', {
      jobId: event.jobId,
      duration: event.duration,
      filesUploaded: event.uploadedFiles,
      status: event.status,
    });
  },
});

// Cascade backups
eventBus.subscribe('backup.completed', {
  async handle(event: BackupCompletedEvent) {
    if (event.jobName === 'api-server' && event.status === 'success') {
      // Trigger dependent backup
      await jobService.runBackup('api-logs');
    }
  },
});
```

---

## Multi-Tenancy

### Tenant Isolation

**Database Schema**:

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  apiKey    String   @unique
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())

  jobs      BackupJob[]
  templates BackupTemplate[]
}

// Add to existing models
model BackupJob {
  // ... existing fields
  tenantId  String?
  tenant    Tenant? @relation(fields: [tenantId], references: [id])
}
```

**Middleware for Tenant Context**:

```typescript
app.use(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { apiKey: String(apiKey) },
  });

  if (!tenant || !tenant.enabled) {
    return res.status(403).json({ error: 'Invalid or disabled tenant' });
  }

  req.tenant = tenant;
  next();
});
```

**Tenant-Scoped Queries**:

```typescript
class JobService {
  async getAllJobs(tenantId?: string): Promise<BackupJob[]> {
    return prisma.backupJob.findMany({
      where: tenantId ? { tenantId } : {},
      // ...
    });
  }
}
```

---

## Authentication

### JWT Authentication

```typescript
import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Protect routes
app.use('/api/jobs', authMiddleware);
```

### API Key Authentication

```typescript
class ApiKeyAuth {
  async validateApiKey(key: string): Promise<boolean> {
    const hash = createHash('sha256').update(key).digest('hex');
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hash },
    });

    return apiKey?.enabled || false;
  }
}

const apiKeyMiddleware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !(await validateApiKey(String(apiKey)))) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};
```

---

## Advanced Patterns

### Backup Chaining

Trigger sequential backups based on dependencies:

```typescript
const backupChains = {
  'full-system': ['database', 'files', 'configs', 'logs'],
};

async function runBackupChain(chainName: string) {
  const jobs = backupChains[chainName];

  for (const jobName of jobs) {
    const result = await jobService.runBackup(jobName);

    if (result.status === 'failed') {
      throw new Error(`Chain failed at ${jobName}`);
    }
  }
}
```

### Blue-Green Backup Strategy

```typescript
// Backup to two buckets alternately
const getBucketForDate = (date: Date): string => {
  const day = date.getDate();
  return day % 2 === 0 ? 'backup-bucket-a' : 'backup-bucket-b';
};

// Before running backup
job.bucket = getBucketForDate(new Date());
await jobService.runBackup(job.name);
```

### Backup Verification

```typescript
// After backup completes
eventBus.subscribe('backup.completed', {
  async handle(event: BackupCompletedEvent) {
    if (event.status === 'success') {
      // Schedule verification job
      await queueVerification(event.jobId, event.historyId);
    }
  },
});

async function verifyBackup(historyId: string) {
  const history = await prisma.backupHistory.findUnique({
    where: { id: historyId },
  });

  // Download random sample and verify checksums
  const checksums = JSON.parse(history.checksums);
  const sampleFiles = Object.keys(checksums).slice(0, 5);

  for (const file of sampleFiles) {
    const downloaded = await storageAdapter.download({
      bucket: history.bucket,
      key: file,
    });

    const hash = calculateHash(downloaded);

    if (hash !== checksums[file]) {
      throw new Error(`Verification failed for ${file}`);
    }
  }

  await prisma.backupHistory.update({
    where: { id: historyId },
    data: { verificationStatus: 'verified' },
  });
}
```

---

## Troubleshooting Integrations

### Debug Webhooks

```bash
# Test webhook locally with ngrok
ngrok http 3000

# Configure webhook with ngrok URL
curl -X POST http://localhost:3000/api/notifications \
  -d '{ "config": { "url": "https://your-ngrok-url.ngrok.io/webhook" } }'

# Trigger backup and monitor ngrok dashboard
```

### Monitor Integration Health

```typescript
// Health check endpoint with dependency status
app.get('/health/integrations', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkR2Connection(),
    checkWebhooks(),
  ]);

  const healthy = checks.every((c) => c.healthy);

  res.status(healthy ? 200 : 503).json({
    healthy,
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

---

## Next Steps

- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design details
- See [API.md](./API.md) for complete API reference
- Check [Phase 3 Overview](./PHASE3_OVERVIEW.md) for future integrations planned
