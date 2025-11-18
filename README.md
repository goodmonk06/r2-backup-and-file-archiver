# r2-backup-and-file-archiver

重要ファイルを定期的にCloudflare R2へバックアップするサービス。
ハッシュベースの差分アップロードにより、変更されたファイルのみを効率的にバックアップします。

## 特徴

- **差分バックアップ**: ファイルハッシュを管理し、変更があったファイルのみアップロード
- **YAML設定**: 複数のバックアップジョブを簡単に定義・管理
- **スケジューラー**: cron形式で定期バックアップを設定可能
- **除外パターン**: 不要なファイルやディレクトリを除外
- **S3互換API**: Cloudflare R2のS3互換APIを使用

## Tech Stack

- Node.js v20+
- TypeScript
- AWS SDK for JavaScript v3 (S3互換)
- Commander.js (CLI)
- js-yaml (YAML設定)
- node-cron (スケジューラー)

## ディレクトリ構成

```
.
├── src/
│   ├── config/              # 環境設定とR2クライアント
│   │   ├── env.ts
│   │   └── r2Client.ts
│   ├── config-loader/       # YAML設定ファイルローダー
│   │   └── backupConfigLoader.ts
│   ├── backup/              # バックアップロジック
│   │   ├── fileScanner.ts
│   │   └── backupRunner.ts
│   ├── scheduler/           # スケジューラー（将来拡張用）
│   │   └── index.ts
│   └── cli.ts              # CLIエントリーポイント
├── config/
│   └── backup.example.yml  # バックアップ設定例
└── .env.example            # 環境変数設定例
```

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd r2-backup-and-file-archiver
npm install
```

### 2. Cloudflare R2の設定

#### 2.1 R2バケットの作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にログイン
2. 左メニューから「R2」を選択
3. 「Create bucket」をクリックしてバケットを作成

#### 2.2 R2 APIトークンの作成

1. R2ダッシュボードで「Manage R2 API Tokens」をクリック
2. 「Create API Token」をクリック
3. 必要な権限を設定:
   - **Permission**: Read & Write
   - **Bucket**: 必要に応じて特定のバケットを選択
4. 「Create API Token」をクリック
5. 表示される以下の情報をメモ:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID**

#### 2.3 R2エンドポイントURL

R2のエンドポイントURLは以下の形式です:
```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### 3. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、R2の情報を設定します:

```bash
cp .env.example .env
```

`.env`ファイルを編集:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-id-here
R2_SECRET_ACCESS_KEY=your-secret-access-key-here
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# バックアップ設定ファイルのパス
BACKUP_CONFIG_PATH=./config/backup.yml

# ログレベル（debug, info, warn, error）
LOG_LEVEL=info
```

### 4. バックアップ設定ファイルの作成

`config/backup.example.yml`をコピーして`config/backup.yml`を作成:

```bash
cp config/backup.example.yml config/backup.yml
```

`config/backup.yml`を編集して、バックアップジョブを定義:

```yaml
jobs:
  # プロジェクトファイルのバックアップ
  - name: project-backup
    source: ./data              # バックアップ元ディレクトリ
    bucket: my-bucket           # R2バケット名
    prefix: project/            # バケット内のプレフィックス
    schedule: "0 3 * * *"       # cron形式（毎日午前3時）
    exclude:                    # 除外パターン（オプション）
      - "*.tmp"
      - "*.log"
      - "node_modules/"
    enabled: true               # 有効/無効
```

#### cron形式のスケジュール

```
 ┌────────────── 分 (0 - 59)
 │ ┌──────────── 時 (0 - 23)
 │ │ ┌────────── 日 (1 - 31)
 │ │ │ ┌──────── 月 (1 - 12)
 │ │ │ │ ┌────── 曜日 (0 - 7) (0と7は日曜日)
 │ │ │ │ │
 * * * * *
```

例:
- `"0 3 * * *"` - 毎日午前3時
- `"0 */6 * * *"` - 6時間ごと
- `"0 2 * * 0"` - 毎週日曜日午前2時

### 5. ビルド

```bash
npm run build
```

## 使い方

### バックアップを実行

#### 特定のジョブを実行

```bash
npm run dev run --job project-backup
```

または、ビルド後:

```bash
npm start run --job project-backup
```

#### すべての有効なジョブを実行

```bash
npm run dev run
```

#### 詳細ログを表示

```bash
npm run dev run --job project-backup --verbose
```

### ジョブ一覧を表示

```bash
npm run dev list
```

### スケジューラーを起動（定期実行）

```bash
npm run dev schedule
```

スケジューラーを起動すると、設定されたスケジュールに従って自動的にバックアップが実行されます。
停止するには `Ctrl+C` を押してください。

## 機能詳細

### ハッシュ管理による差分バックアップ

- 各ファイルのMD5ハッシュを計算し、`.backup-cache/`に保存
- ファイルのハッシュ、サイズ、更新日時が変わっていない場合はアップロードをスキップ
- R2上のファイルのETagと比較して、既にアップロード済みかチェック

### 除外パターン

以下の形式の除外パターンをサポート:

- `*.ext` - 特定の拡張子
- `dirname/` - ディレクトリ
- `filename` - 特定のファイル名を含むパス

### ログ出力

各バックアップ実行後に以下の情報が表示されます:

- 総ファイル数
- アップロードされたファイル数
- スキップされたファイル数
- エラー数
- 実行時間

## トラブルシューティング

### 環境変数が見つからないエラー

```
Missing required environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID
```

→ `.env`ファイルが正しく設定されているか確認してください。

### 設定ファイルが見つからないエラー

```
Config file not found: ./config/backup.yml
```

→ `config/backup.yml`が存在するか確認してください。

### R2への接続エラー

- R2のアクセスキーとシークレットキーが正しいか確認
- エンドポイントURLが正しいか確認
- バケット名が存在するか確認
- APIトークンに適切な権限があるか確認

## 将来の拡張

- [ ] リストア機能
- [ ] バックアップの世代管理
- [ ] 圧縮機能
- [ ] 暗号化機能
- [ ] 通知機能（メール、Slack等）
- [ ] Webダッシュボード
- [ ] バックアップ履歴のデータベース管理

## License

MIT
