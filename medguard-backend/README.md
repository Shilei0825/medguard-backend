# MedGuard Backend

Production-ready backend API for the MedGuard SaaS platform - PHI Detection & Healthcare Compliance.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Render

## Features

### Tier 1 Feature Set

- ✅ **File Upload Scan** - Single file PHI detection
- ✅ **Folder Scan** - Batch file scanning with folder structure
- ✅ **Cloud Scan Support** - Google Drive, OneDrive, S3, SharePoint, Dropbox
- ✅ **PHI Detection** - Regex-based stub (ready for ML/LLM integration)
- ✅ **Risk Scoring** - Per-file and per-scan risk assessment
- ✅ **PHI Exposure Map** - Folder-level risk aggregation
- ✅ **Risk Timeline** - Historical risk trends
- ✅ **PHI Density** - Files with high PHI concentration
- ✅ **PHI Fingerprints** - Duplicate/proliferation detection
- ✅ **Vendor Risk Scoring** - Vendor behavior analytics
- ✅ **Alerts** - High-risk files, PHI spikes, vendor issues
- ✅ **Compliance Management** - HIPAA/GDPR/CCPA tracking
- ✅ **Access Events** - Audit logging and analytics
- ✅ **Redacted Files** - Track redacted file versions
- ✅ **Safe Datasets** - PHI-sanitized dataset references
- ✅ **Financial Risk Estimates** - Breach cost calculations
- ✅ **Reports** - Generate compliance and risk reports

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase project with tables created

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd medguard-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your Supabase credentials
```

### Configuration

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
PORT=8080
NODE_ENV=development
```

### Running Locally

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Basic health check
- `GET /api/health/db` - Health check with database test

### Scans
- `POST /api/scans/file` - Create single file scan
- `POST /api/scans/folder` - Create folder scan
- `GET /api/scans` - List scans for organization
- `GET /api/scans/:scanId` - Get scan details
- `GET /api/scans/files/:fileId` - Get file details
- `GET /api/scans/files/:fileId/duplicates` - Find duplicate files

### Dashboard
- `GET /api/dashboard/overview` - Dashboard overview
- `GET /api/dashboard/exposure-map` - PHI exposure map
- `GET /api/dashboard/risk-timeline` - Risk trend timeline
- `POST /api/dashboard/risk-simulation` - Simulate risk reduction
- `GET /api/dashboard/phi-density` - PHI density by folder

### Vendors
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create/update vendor
- `GET /api/vendors/:vendorId` - Get vendor details
- `POST /api/vendors/:vendorId/files` - Associate file with vendor
- `GET /api/vendors/analytics` - Vendor analytics

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `POST /api/alerts/:alertId/resolve` - Resolve alert
- `GET /api/alerts/counts` - Alert counts by severity

### Compliance
- `GET /api/compliance/snapshot` - Latest compliance snapshot
- `GET /api/compliance/items` - List compliance items
- `GET /api/compliance/tasks` - List compliance tasks
- `POST /api/compliance/tasks` - Create compliance task
- `GET /api/compliance/summary` - Compliance summary

### Redaction
- `GET /api/redacted-files` - List redacted files
- `POST /api/redacted-files` - Create redacted file record
- `GET /api/redacted-files/stats` - Redaction statistics

### Safe Datasets
- `GET /api/safe-datasets` - List safe datasets
- `POST /api/safe-datasets` - Create safe dataset record
- `GET /api/safe-datasets/stats` - Dataset statistics

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports/financial-risk` - Generate financial risk report
- `POST /api/reports/phi-inventory` - Generate PHI inventory report

### Analytics
- `GET /api/analytics/access-summary` - Access analytics summary
- `GET /api/analytics/anomalies` - Detect access anomalies
- `POST /api/analytics/events` - Log access event

## Project Structure

```
src/
├── config/
│   ├── env.ts              # Environment variable loader
│   └── supabaseClient.ts   # Supabase client configuration
├── types/
│   └── db.ts               # TypeScript interfaces for database
├── services/
│   ├── scanService.ts      # PHI scanning and detection
│   ├── dashboardService.ts # Dashboard analytics
│   ├── vendorService.ts    # Vendor management
│   ├── alertService.ts     # Alert management
│   ├── complianceService.ts# Compliance tracking
│   ├── redactionService.ts # Redaction management
│   ├── datasetService.ts   # Safe dataset management
│   ├── reportService.ts    # Report generation
│   └── analyticsService.ts # Access analytics
├── routes/
│   ├── healthRoutes.ts
│   ├── scanRoutes.ts
│   ├── dashboardRoutes.ts
│   ├── vendorRoutes.ts
│   ├── alertRoutes.ts
│   ├── complianceRoutes.ts
│   ├── redactionRoutes.ts
│   ├── datasetRoutes.ts
│   ├── reportRoutes.ts
│   └── analyticsRoutes.ts
└── server.ts               # Express app entry point
```

## PHI Detection

The current implementation uses regex patterns for PHI detection as a stub. This is marked with TODO comments for production integration:

### Supported PHI Types
- SSN (Social Security Numbers)
- MRN (Medical Record Numbers)
- DOB (Dates of Birth)
- Phone Numbers
- Email Addresses
- Diagnosis Codes (ICD-10)
- Medication Information
- Insurance IDs
- Credit Card Numbers
- Street Addresses
- Person Names

### Production Integration Points

The `scanService.ts` file contains placeholders for integrating production PHI detection:

```typescript
// TODO: Replace with production PHI detection:
// - AWS Comprehend Medical
// - Google Healthcare NLP
// - Fine-tuned NER models
// - LLM-assisted detection
```

## Deployment on Render

1. Create a new Web Service on Render
2. Connect your repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: Add your Supabase credentials

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Service role key for admin operations |
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | Environment (development/production) |

## Database Tables Required

The following tables must exist in your Supabase project:

- `organizations`
- `users`
- `org_settings`
- `scans`
- `scanned_files`
- `phi_findings`
- `phi_fingerprints`
- `file_fingerprints`
- `folder_risks`
- `risk_snapshots`
- `vendors`
- `vendor_files`
- `alerts`
- `compliance_items`
- `compliance_snapshots`
- `compliance_tasks`
- `access_events`
- `redacted_files`
- `safe_datasets`
- `reports`

## License

Proprietary - MedGuard Inc.
