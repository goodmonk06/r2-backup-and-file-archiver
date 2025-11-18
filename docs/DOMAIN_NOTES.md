# Domain Model Notes

Deep dive into the R2 Backup domain model, business rules, and design decisions.

## Table of Contents

1. [Domain Overview](#domain-overview)
2. [Core Entities](#core-entities)
3. [Domain Relationships](#domain-relationships)
4. [Business Rules](#business-rules)
5. [Design Patterns](#design-patterns)
6. [Extension Points](#extension-points)

---

## Domain Overview

### Bounded Context

R2 Backup operates within the **Backup & Archive Management** bounded context, handling:

- **Backup Configuration**: Job definitions, schedules, and templates
- **Backup Execution**: Running backups, tracking progress, handling failures
- **Storage Management**: File upload, retention, cleanup
- **Notification & Alerting**: Multi-channel notifications for backup events
- **Metrics & Analytics**: Performance tracking, success rates, storage usage

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **Backup Job** | A configured backup task with source, destination, and schedule |
| **Backup History** | A single execution record of a backup job |
| **Template** | A reusable backup configuration with parameterized variables |
| **Retention Policy** | Rules defining how long backups are kept and when they're deleted |
| **Notification** | Alert configuration for backup events (success, failure, warning) |
| **Tag** | Categorical label for organizing and filtering backup jobs |
| **Soft Delete** | Logical deletion using `deletedAt` timestamp instead of physical removal |
| **Vertical Slice** | End-to-end feature implementation (API → Service → Repository → DB) |

---

## Core Entities

### 1. BackupJob

**Aggregate Root** for backup configuration.

```prisma
model BackupJob {
  id                String   @id @default(cuid())
  name              String   @unique
  description       String?
  source            String        // Source path or identifier
  bucket            String        // R2 bucket name
  prefix            String        // Object key prefix
  schedule          String        // Cron expression
  exclude           String[]      // File patterns to exclude
  enabled           Boolean  @default(true)
  priority          Int      @default(5)      // 1 (low) - 10 (high)
  retryAttempts     Int      @default(3)
  retryDelayMs      Int      @default(60000)  // 1 minute
  templateId        String?
  retentionPolicyId String?
  tags              String[] @default([])
  metadata          Json?         // Extensible custom data
  deletedAt         DateTime?     // Soft delete timestamp
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Business Rules**:
- `name` must be unique across all jobs
- `schedule` must be valid cron expression
- `priority` range: 1-10 (enforced at service layer)
- Soft-deleted jobs are hidden from normal queries
- Cannot delete job with active backup executions
- Template changes don't affect already-created jobs

**Invariants**:
- Source path must exist and be readable (validated before first run)
- Bucket must exist in R2 (or auto-created if configured)
- If `templateId` is set, template must exist
- Retry attempts ≥ 0, retry delay ≥ 1000ms

---

### 2. BackupHistory

**Entity** representing a single backup execution.

```prisma
model BackupHistory {
  id                 String    @id @default(cuid())
  jobId              String
  status             String    // 'pending', 'running', 'success', 'failed'
  startedAt          DateTime
  completedAt        DateTime?
  totalFiles         Int       @default(0)
  uploadedFiles      Int       @default(0)
  failedFiles        Int       @default(0)
  totalBytes         BigInt    @default(0)
  uploadedBytes      BigInt    @default(0)
  errors             String[]  @default([])
  warnings           String[]  @default([])
  verificationStatus String?   // 'pending', 'verified', 'failed'
  checksums          Json?     // { "file/path": "sha256hash" }
  triggeredBy        String?   // 'schedule', 'manual', 'api', 'event'
  retryCount         Int       @default(0)
  metadata           Json?
}
```

**Lifecycle States**:

```
pending → running → success
                 ↘ failed → running (retry) → success/failed
```

**Business Rules**:
- Cannot modify history after `completedAt` is set
- `uploadedFiles` ≤ `totalFiles`
- `uploadedBytes` ≤ `totalBytes`
- Checksums calculated using SHA-256
- Verification runs asynchronously after successful backup
- Retention policies only apply to completed backups

**Event Emissions**:
- `BackupStartedEvent` when status → 'running'
- `BackupCompletedEvent` when status → 'success'
- `BackupFailedEvent` when status → 'failed'
- `BackupProgressEvent` during upload (every N files)

---

### 3. BackupTemplate

**Value Object** with identity for reusable configurations.

```prisma
model BackupTemplate {
  id            String   @id @default(cuid())
  name          String   @unique
  description   String?
  source        String      // Can contain ${VARIABLES}
  bucket        String
  prefix        String      // Can contain ${VARIABLES}
  schedule      String
  exclude       String[]
  priority      Int      @default(5)
  retryAttempts Int      @default(3)
  retryDelayMs  Int      @default(60000)
  tags          String[]
  variables     Json?       // { "VAR_NAME": { "description": "...", "default": "..." } }
  metadata      Json?
  isPublic      Boolean  @default(false)
  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Variable Substitution Example**:

Template:
```json
{
  "name": "project-template",
  "source": "/projects/${PROJECT_NAME}",
  "prefix": "backups/${PROJECT_NAME}/${ENV}",
  "variables": {
    "PROJECT_NAME": { "description": "Project name", "required": true },
    "ENV": { "description": "Environment", "default": "production" }
  }
}
```

Instantiation:
```typescript
templateService.instantiateJob('project-template', {
  PROJECT_NAME: 'my-app',
  ENV: 'staging'
});
```

Result:
```json
{
  "source": "/projects/my-app",
  "prefix": "backups/my-app/staging"
}
```

**Business Rules**:
- Template variables use `${VAR_NAME}` syntax
- Cannot delete template if jobs reference it
- Public templates visible to all tenants (in multi-tenant setup)
- Private templates only visible to creator

---

### 4. RetentionPolicy

**Policy Object** defining automated cleanup rules.

```prisma
model RetentionPolicy {
  id            String   @id @default(cuid())
  name          String   @unique
  description   String?
  keepLast      Int?        // Keep last N backups
  keepDays      Int?        // Keep backups from last N days
  keepWeeks     Int?        // Keep one backup per week for N weeks
  keepMonths    Int?        // Keep one backup per month for N months
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Retention Strategies**:

1. **Keep Last N**: Retain most recent N backups, delete older ones
2. **Keep Days**: Retain all backups from last N days
3. **Keep Weeks**: Retain one backup per week for N weeks (typically Sunday)
4. **Keep Months**: Retain one backup per month for N months (typically 1st of month)

**Combined Example**:

```json
{
  "name": "production-retention",
  "keepLast": 5,      // Always keep last 5
  "keepDays": 7,      // Keep all from last week
  "keepWeeks": 4,     // Keep one per week for last month
  "keepMonths": 12    // Keep one per month for last year
}
```

**Execution Logic**:
1. Categorize backups into buckets (last-5, daily, weekly, monthly)
2. Union all protected backups
3. Delete backups not in protected set
4. Log deletion in `RetentionExecution`

**Business Rules**:
- At least one retention criterion must be specified
- Policies run on schedule (e.g., daily at 2 AM)
- Cannot delete backups currently being verified
- Failed backups can be deleted immediately (configurable)

---

### 5. BackupNotification

**Entity** for alert configuration.

```prisma
model BackupNotification {
  id         String   @id @default(cuid())
  jobId      String?     // null = global notifications
  name       String
  type       String      // 'webhook', 'email', 'slack', 'discord'
  enabled    Boolean  @default(true)
  triggerOn  String[]    // ['failure', 'success', 'warning', 'start']
  config     Json        // Adapter-specific configuration
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Trigger Events**:

| Event | Description |
|-------|-------------|
| `start` | Backup job started |
| `success` | Backup completed successfully |
| `failure` | Backup failed after all retries |
| `warning` | Backup succeeded with warnings |
| `retry` | Backup failed, retry scheduled |

**Notification Types**:

1. **Webhook**: HTTP POST to configured URL
2. **Email**: SMTP or SendGrid/Mailgun integration
3. **Slack**: Slack incoming webhook with Block Kit formatting
4. **Discord**: Discord webhook integration
5. **PagerDuty**: Incident creation for critical failures

**Configuration Examples**:

Webhook:
```json
{
  "type": "webhook",
  "config": {
    "url": "https://hooks.example.com/backup",
    "method": "POST",
    "headers": { "Authorization": "Bearer token" },
    "timeout": 5000
  }
}
```

Email:
```json
{
  "type": "email",
  "config": {
    "to": ["ops@company.com"],
    "from": "backups@company.com",
    "subject": "[Backup Alert] ${JOB_NAME} - ${STATUS}"
  }
}
```

**Business Rules**:
- Global notifications (jobId = null) trigger for all jobs
- Job-specific notifications override globals
- Failed notification delivery doesn't fail backup
- Notification history retained for audit (90 days default)

---

### 6. BackupStats

**Aggregate** for metrics and analytics.

```prisma
model BackupStats {
  id              String   @id @default(cuid())
  date            DateTime     // Day being measured
  totalBackups    Int      @default(0)
  successBackups  Int      @default(0)
  failedBackups   Int      @default(0)
  totalBytes      BigInt   @default(0)
  avgDurationMs   Int      @default(0)
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([date])
}
```

**Aggregation Strategy**:
- Stats calculated daily via scheduled job
- Metrics collected from `BackupHistory` for previous day
- Used for dashboards, reports, and trend analysis

**Calculated Metrics**:
- Success rate: `successBackups / totalBackups`
- Failure rate: `failedBackups / totalBackups`
- Average backup size: `totalBytes / totalBackups`
- Storage growth rate: `delta(totalBytes) over time`

---

## Domain Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│ BackupTemplate  │
│  - variables    │
└────────┬────────┘
         │ 1
         │
         │ *
┌────────▼────────┐         ┌──────────────────┐
│   BackupJob     │────────▶│ RetentionPolicy  │
│  - source       │ *     1 │  - keepLast      │
│  - schedule     │         │  - keepDays      │
└────────┬────────┘         └──────────────────┘
         │ 1
         │
         │ *
┌────────▼────────┐
│ BackupHistory   │
│  - status       │
│  - checksums    │
└─────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ BackupNotif.    │────────▶│ NotificationHist │
│  - triggerOn    │ 1     * │  - sentAt        │
│  - config       │         │  - success       │
└─────────────────┘         └──────────────────┘

┌─────────────────┐
│  BackupStats    │
│  - date (PK)    │
│  - metrics      │
└─────────────────┘

┌─────────────────┐
│   BackupTag     │
│  - name (PK)    │
└─────────────────┘
```

### Key Relationships

1. **BackupJob → BackupTemplate** (Many-to-One, Optional)
   - Jobs can be created from templates
   - Template deletion blocked if jobs reference it
   - Jobs maintain independence after creation

2. **BackupJob → RetentionPolicy** (Many-to-One, Optional)
   - Jobs can have automated retention rules
   - Policy changes affect future cleanup executions
   - Jobs without policy keep backups indefinitely

3. **BackupJob → BackupHistory** (One-to-Many)
   - Each execution creates one history record
   - Cascade delete: deleting job deletes history (configurable)
   - History queryable independent of job status

4. **BackupJob → BackupNotification** (One-to-Many)
   - Jobs can have multiple notification channels
   - Notifications fire based on `triggerOn` events
   - Global notifications (jobId = null) apply to all jobs

5. **BackupNotification → NotificationHistory** (One-to-Many)
   - Audit trail of sent notifications
   - Includes delivery status and errors
   - Used for debugging and compliance

---

## Business Rules

### Job Execution Rules

1. **Scheduling**
   - Jobs execute based on cron schedule
   - Manual triggers always allowed (if enabled)
   - Priority determines execution order when queued

2. **Concurrency**
   - Same job cannot run concurrently (mutex lock)
   - Different jobs can run in parallel
   - Configurable global concurrency limit

3. **Retry Logic**
   - Failed backups retry up to `retryAttempts` times
   - Exponential backoff: `retryDelayMs * (2 ^ retryCount)`
   - Transient errors (network) trigger retry
   - Permanent errors (auth failure) don't retry

4. **File Exclusion**
   - Exclude patterns use glob syntax
   - Patterns evaluated against relative paths
   - Common excludes: `**/.git`, `**/node_modules`, `**/*.log`

### Retention Rules

1. **Execution Timing**
   - Retention runs after backup completion
   - Can also run on independent schedule (e.g., daily)
   - Never deletes backups less than 24 hours old (safety)

2. **Deletion Order**
   - Calculate protected set (union of all keep rules)
   - Order deletable backups by age (oldest first)
   - Delete in batches with rate limiting

3. **Verification Integration**
   - Cannot delete backups with `verificationStatus = 'pending'`
   - Failed verification marks backup for review
   - Manual approval required to delete failed verification

### Notification Rules

1. **Delivery Guarantees**
   - At-least-once delivery (may duplicate on retry)
   - Notification failures don't fail backup
   - Retry notification delivery 3 times

2. **Throttling**
   - Max 1 notification per minute per job per channel
   - Prevents spam on rapid failure loops
   - Configurable per notification

3. **Templating**
   - Notification messages support variables: `${JOB_NAME}`, `${STATUS}`, `${ERROR_COUNT}`
   - Rendered at send time with current values

---

## Design Patterns

### 1. Adapter Pattern

**Problem**: Need to support multiple storage backends, notification channels, and metrics systems without tight coupling.

**Solution**: Define interfaces for each integration point:

```typescript
interface IStorageAdapter {
  upload(options: UploadOptions): Promise<UploadResult>;
  download(options: DownloadOptions): Promise<Buffer>;
  delete(options: DeleteOptions): Promise<void>;
  list(options: ListOptions): Promise<ListResult>;
}

interface INotificationAdapter {
  send(payload: NotificationPayload): Promise<NotificationResult>;
  test(): Promise<NotificationResult>;
}

interface IMetricsAdapter {
  recordCounter(name: string, value: number): void;
  recordGauge(name: string, value: number): void;
}
```

**Benefits**:
- Swap implementations without code changes
- Test with mock adapters
- Extend with new providers easily

### 2. Repository Pattern

**Problem**: Decouple business logic from data access concerns.

**Solution**: Repository layer abstracts Prisma operations:

```typescript
class JobRepository {
  async findById(id: string): Promise<BackupJob | null> {
    return prisma.backupJob.findUnique({ where: { id } });
  }

  async findActive(): Promise<BackupJob[]> {
    return prisma.backupJob.findMany({
      where: { enabled: true, deletedAt: null }
    });
  }
}
```

**Benefits**:
- Business logic independent of ORM
- Easier to test with in-memory repositories
- Can optimize queries in one place

### 3. Event-Driven Architecture

**Problem**: Decouple backup execution from side effects (notifications, metrics, analytics).

**Solution**: Publish domain events from services:

```typescript
class BackupService {
  async runBackup(jobId: string) {
    eventBus.publish(new BackupStartedEvent({ jobId }));

    try {
      // ... execute backup
      eventBus.publish(new BackupCompletedEvent({ jobId, status: 'success' }));
    } catch (error) {
      eventBus.publish(new BackupFailedEvent({ jobId, error }));
    }
  }
}

// Separate handler for notifications
eventBus.subscribe('backup.completed', async (event) => {
  await notificationService.sendNotifications(event.jobId, event.status);
});
```

**Benefits**:
- Core backup logic stays focused
- Easy to add new behaviors (e.g., metrics, webhooks)
- Handlers can be async without blocking backup

### 4. Soft Delete Pattern

**Problem**: Need audit trail and ability to restore accidentally deleted jobs.

**Solution**: Use `deletedAt` timestamp instead of physical deletion:

```typescript
async softDelete(id: string): Promise<void> {
  await prisma.backupJob.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false }
  });
}

async restore(id: string): Promise<void> {
  await prisma.backupJob.update({
    where: { id },
    data: { deletedAt: null }
  });
}

// Queries automatically filter soft-deleted
async findAll(): Promise<BackupJob[]> {
  return prisma.backupJob.findMany({
    where: { deletedAt: null }
  });
}
```

**Benefits**:
- Accidental deletions recoverable
- Audit trail preserved
- Related history remains accessible

### 5. Template Method (Variable Substitution)

**Problem**: Need reusable configurations with customizable parameters.

**Solution**: Templates with `${VARIABLE}` placeholders:

```typescript
class TemplateService {
  async instantiateJob(
    templateName: string,
    variables: Record<string, string>
  ): Promise<BackupJob> {
    const template = await this.getTemplate(templateName);

    // Replace all variables
    let source = template.source;
    let prefix = template.prefix;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      source = source.replace(regex, value);
      prefix = prefix.replace(regex, value);
    });

    return jobService.create({ ...template, source, prefix });
  }
}
```

**Benefits**:
- DRY: one template → many jobs
- Self-service job creation
- Enforced standards via templates

---

## Extension Points

### 1. Custom Storage Adapters

Implement `IStorageAdapter` to support:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- MinIO
- Local filesystem (for testing)

**Example**:
```typescript
class S3StorageAdapter implements IStorageAdapter {
  readonly name = 's3';

  async upload(options: UploadOptions): Promise<UploadResult> {
    // AWS S3 specific implementation
  }
}

// Register adapter
storageRegistry.register(new S3StorageAdapter());
```

### 2. Custom Notification Channels

Implement `INotificationAdapter` for:
- Slack
- Discord
- Microsoft Teams
- PagerDuty
- Telegram
- SMS (via Twilio)

**Example**:
```typescript
class SlackAdapter implements INotificationAdapter {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Transform to Slack Block Kit format
    // Send to webhook
  }
}
```

### 3. Custom Metrics Backends

Implement `IMetricsAdapter` for:
- Prometheus
- Datadog
- New Relic
- CloudWatch
- Grafana Cloud

**Example**:
```typescript
class PrometheusAdapter implements IMetricsAdapter {
  recordCounter(name: string, value: number, labels?: MetricLabels): void {
    this.counters.get(name)?.inc(labels, value);
  }
}
```

### 4. Event Handlers

Subscribe to domain events for custom logic:

```typescript
// Cascade backups
eventBus.subscribe('backup.completed', async (event) => {
  if (event.jobName === 'database' && event.status === 'success') {
    await jobService.runBackup('database-logs');
  }
});

// Custom analytics
eventBus.subscribe('backup.completed', async (event) => {
  await analytics.track('backup_completed', {
    jobId: event.jobId,
    duration: event.duration,
    filesUploaded: event.uploadedFiles
  });
});
```

### 5. Validation Hooks

Add custom validation rules:

```typescript
class JobService {
  private validators: JobValidator[] = [
    new ScheduleValidator(),
    new SourcePathValidator(),
    new BucketExistsValidator(),
  ];

  async create(data: CreateJobInput): Promise<BackupJob> {
    for (const validator of this.validators) {
      await validator.validate(data);
    }
    // ... create job
  }
}

// Custom validator
class BucketExistsValidator implements JobValidator {
  async validate(data: CreateJobInput): Promise<void> {
    const exists = await storageAdapter.exists({ bucket: data.bucket });
    if (!exists) {
      throw new ValidationError(`Bucket ${data.bucket} does not exist`);
    }
  }
}
```

---

## Anti-Patterns to Avoid

### 1. ❌ Direct Database Access from API Layer

**Bad**:
```typescript
// In API route
app.post('/jobs', async (req, res) => {
  const job = await prisma.backupJob.create({ data: req.body });
  res.json(job);
});
```

**Good**:
```typescript
// API delegates to service
app.post('/jobs', async (req, res) => {
  const job = await jobService.create(req.body);
  res.json(job);
});

// Service contains business logic
class JobService {
  async create(data: CreateJobInput): Promise<BackupJob> {
    this.validateSchedule(data.schedule);
    const job = await jobRepository.create(data);
    eventBus.publish(new JobCreatedEvent({ jobId: job.id }));
    return job;
  }
}
```

### 2. ❌ Notification Logic in Backup Service

**Bad**:
```typescript
class BackupService {
  async runBackup(jobId: string) {
    // ... backup logic

    // Tight coupling to notifications
    if (status === 'failed') {
      await slackNotifier.send(`Backup ${jobId} failed`);
      await emailNotifier.send(`Backup ${jobId} failed`);
    }
  }
}
```

**Good**:
```typescript
class BackupService {
  async runBackup(jobId: string) {
    // ... backup logic

    // Publish event, let handlers decide what to do
    eventBus.publish(new BackupFailedEvent({ jobId, error }));
  }
}

// Separate notification handler
eventBus.subscribe('backup.failed', async (event) => {
  await notificationService.sendNotifications(event.jobId, 'failure');
});
```

### 3. ❌ Storing Large Files in Database

**Bad**:
```typescript
model BackupHistory {
  id       String @id
  fileData Bytes  // ❌ Storing actual file content
}
```

**Good**:
```typescript
model BackupHistory {
  id          String @id
  storageKey  String  // ✅ Reference to R2 object
  checksums   Json    // ✅ Metadata only
}
```

### 4. ❌ Synchronous Long-Running Operations

**Bad**:
```typescript
app.post('/jobs/:id/run', async (req, res) => {
  await backupService.runBackup(req.params.id); // Blocks for minutes
  res.json({ status: 'completed' });
});
```

**Good**:
```typescript
app.post('/jobs/:id/run', async (req, res) => {
  const historyId = await backupService.startBackup(req.params.id);
  res.status(202).json({
    status: 'started',
    historyId,
    statusUrl: `/api/history/${historyId}`
  });
});
```

---

## Future Domain Enhancements

1. **Backup Encryption**
   - Client-side encryption before upload
   - Key management integration (AWS KMS, HashiCorp Vault)
   - Encrypted metadata in database

2. **Incremental Backups**
   - Track file changes using checksums
   - Only upload modified files
   - Reconstruct full backup from incrementals

3. **Backup Verification**
   - Automated integrity checks
   - Random sample downloads and checksum validation
   - Compliance reporting

4. **Multi-Tenancy**
   - Tenant isolation at database level
   - Per-tenant storage quotas
   - Tenant-specific templates and policies

5. **Cost Optimization**
   - Storage class management (hot, cold, archive)
   - Compression before upload
   - Deduplication across backups

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [INTEGRATION_RECIPES.md](./INTEGRATION_RECIPES.md) - Integration patterns and examples
- [API.md](./API.md) - REST API reference
- [Prisma Schema](../prisma/schema.prisma) - Database schema definition
