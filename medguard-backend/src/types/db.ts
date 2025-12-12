/**
 * Database types for MedGuard SaaS Platform
 * These interfaces correspond to tables in the Supabase public schema.
 */

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string | null;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analyst' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface OrgSettings {
  id: string;
  org_id: string;
  breach_cost_per_record: number; // Default HIPAA estimate ~$150-$400 per record
  default_scan_depth: string; // 'shallow' | 'deep'
  alert_thresholds: {
    high_risk_score?: number;
    phi_spike_percentage?: number;
  };
  retention_days: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Scan & File Types
// ============================================================================

export type ScanType = 'file' | 'folder' | 'cloud' | 'vendor_batch';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SourceType = 'local_folder' | 'google_drive' | 'onedrive' | 's3' | 'sharepoint' | 'dropbox';

export interface Scan {
  id: string;
  org_id: string | null;
  user_id: string | null;
  scan_type: ScanType;
  source_type: SourceType | null;
  source_label: string | null;
  root_path: string | null;
  status: ScanStatus;
  overall_risk_score: number | null;
  overall_risk_level: RiskLevel | null;
  total_files: number;
  total_phi_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ScannedFile {
  id: string;
  scan_id: string | null;
  org_id: string | null;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  phi_count: number;
  checksum: string | null;
  created_at: string;
}

// ============================================================================
// PHI Detection Types
// ============================================================================

export type PhiType = 
  | 'SSN'
  | 'MRN'           // Medical Record Number
  | 'DOB'           // Date of Birth
  | 'PHONE'
  | 'EMAIL'
  | 'ADDRESS'
  | 'NAME'
  | 'DIAGNOSIS'
  | 'MEDICATION'
  | 'INSURANCE_ID'
  | 'CREDIT_CARD'
  | 'DRIVER_LICENSE'
  | 'PASSPORT'
  | 'IP_ADDRESS'
  | 'BIOMETRIC'
  | 'OTHER';

export type PhiSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PhiFinding {
  id: string;
  file_id: string;
  scan_id: string | null;
  org_id: string | null;
  phi_type: PhiType;
  severity: PhiSeverity;
  occurrences: number;
  sample_snippet: string | null;  // Masked/truncated sample for review
  line_number: number | null;
  char_offset: number | null;
  confidence_score: number | null; // 0-1 confidence in detection
  created_at: string;
}

export interface PhiFingerprint {
  id: string;
  org_id: string | null;
  fingerprint_hash: string;       // Hash of PHI pattern for dedup
  phi_types: PhiType[];           // Types of PHI in this fingerprint
  representative_snippet: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
}

export interface FileFingerprint {
  id: string;
  file_id: string;
  fingerprint_id: string;
  similarity_score: number | null; // 0-1 similarity to fingerprint
  created_at: string;
}

// ============================================================================
// Risk Aggregation Types
// ============================================================================

export interface FolderRisk {
  id: string;
  scan_id: string | null;
  org_id: string | null;
  folder_path: string;
  total_files: number;
  total_phi_count: number;
  avg_risk_score: number | null;
  max_risk_level: RiskLevel | null;
  created_at: string;
}

export interface RiskSnapshot {
  id: string;
  org_id: string;
  snapshot_date: string;
  total_files: number;
  total_phi_count: number;
  overall_risk_score: number | null;
  overall_risk_level: RiskLevel | null;
  high_risk_file_count: number;
  critical_risk_file_count: number;
  created_at: string;
}

// ============================================================================
// Vendor Types
// ============================================================================

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNASSESSED';

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  contact_email: string | null;
  base_score: number | null;       // Initial assessment score (0-100)
  behavior_score: number | null;   // Computed from file behaviors (0-100)
  overall_score: number | null;    // Combined score (0-100)
  risk_tier: RiskTier;
  notes: string | null;
  last_assessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorFile {
  id: string;
  vendor_id: string;
  file_id: string;
  relationship_type: 'shared_with' | 'received_from' | 'processed_by';
  shared_at: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertType = 
  | 'HIGH_FILE_RISK'
  | 'PHI_SPIKE'
  | 'VENDOR_RISK'
  | 'ACCESS_ANOMALY'
  | 'COMPLIANCE_DUE'
  | 'NEW_PHI_TYPE'
  | 'DUPLICATE_PHI';

export interface Alert {
  id: string;
  org_id: string;
  alert_type: AlertType;
  severity: PhiSeverity;
  title: string;
  description: string | null;
  related_scan_id: string | null;
  related_file_id: string | null;
  related_vendor_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
}

// ============================================================================
// Compliance Types
// ============================================================================

export type ComplianceFramework = 'HIPAA' | 'GDPR' | 'CCPA' | 'SOC2' | 'HITRUST' | 'OTHER';
export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface ComplianceItem {
  id: string;
  org_id: string;
  framework: ComplianceFramework;
  requirement_code: string;        // e.g., "164.312(a)(1)"
  requirement_title: string;
  description: string | null;
  status: ComplianceStatus;
  evidence_notes: string | null;
  last_assessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceSnapshot {
  id: string;
  org_id: string;
  snapshot_date: string;
  framework: ComplianceFramework;
  total_requirements: number;
  compliant_count: number;
  partial_count: number;
  non_compliant_count: number;
  compliance_percentage: number;
  created_at: string;
}

export interface ComplianceTask {
  id: string;
  org_id: string;
  created_by_user_id: string | null;
  assigned_to_user_id: string | null;
  title: string;
  description: string | null;
  severity: PhiSeverity;
  status: TaskStatus;
  due_date: string | null;
  related_scan_id: string | null;
  related_file_id: string | null;
  related_alert_id: string | null;
  related_compliance_item_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Access & Audit Types
// ============================================================================

export type AccessEventType = 
  | 'VIEW'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'EDIT'
  | 'DELETE'
  | 'SCAN'
  | 'EXPORT';

export interface AccessEvent {
  id: string;
  org_id: string;
  user_id: string | null;
  file_id: string | null;
  event_type: AccessEventType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Output Types (Redaction, Datasets, Reports)
// ============================================================================

export type RedactionMethod = 'ai_redaction' | 'manual' | 'pattern_based' | 'llm_assisted';

export interface RedactedFile {
  id: string;
  org_id: string;
  original_file_id: string;
  redacted_file_url: string;
  method: RedactionMethod;
  phi_types_redacted: PhiType[];
  redaction_count: number;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export interface SafeDataset {
  id: string;
  org_id: string;
  name: string;
  source_description: string | null;
  file_count: number;
  record_count: number | null;
  storage_url: string | null;
  format: string | null;           // 'json' | 'csv' | 'parquet'
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportType = 
  | 'financial_risk'
  | 'compliance_audit'
  | 'phi_inventory'
  | 'vendor_assessment'
  | 'executive_summary'
  | 'custom';

export interface Report {
  id: string;
  org_id: string;
  report_type: ReportType;
  label: string;
  description: string | null;
  params: Record<string, unknown> | null;  // Generation parameters
  results: Record<string, unknown> | null; // Computed results
  storage_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface FileScanRequest {
  orgId: string;
  userId?: string | null;
  sourceLabel: string;
  file: {
    fileName: string;
    filePath?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
    content?: string | null;  // Raw text content for demo scanning
  };
}

export interface FolderScanRequest {
  orgId: string;
  userId?: string | null;
  sourceLabel: string;
  rootPath: string;
  sourceType: SourceType;
  files: Array<{
    fileName: string;
    filePath?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
    content?: string | null;
  }>;
}

export interface RiskSimulationRequest {
  orgId: string;
  fileIdsToRemove: string[];
}

export interface RiskSimulationResponse {
  current: {
    totalPhiCount: number;
    overallRiskScore: number;
  };
  simulated: {
    totalPhiCount: number;
    overallRiskScore: number;
  };
  delta: {
    phiCountReduction: number;
    riskScoreReduction: number;
  };
}

export interface FinancialRiskEstimate {
  totalPhiCount: number;
  breachCostPerRecord: number;
  estimatedExposureCost: number;
  riskLevel: RiskLevel;
  report: Report;
}

// ============================================================================
// Insert Types (for creating records)
// ============================================================================

export type ScanInsert = Omit<Scan, 'id' | 'created_at'>;
export type ScannedFileInsert = Omit<ScannedFile, 'id' | 'created_at'>;
export type PhiFindingInsert = Omit<PhiFinding, 'id' | 'created_at'>;
export type AlertInsert = Omit<Alert, 'id' | 'created_at'>;
export type FolderRiskInsert = Omit<FolderRisk, 'id' | 'created_at'>;
export type VendorInsert = Omit<Vendor, 'id' | 'created_at' | 'updated_at'>;
export type ComplianceTaskInsert = Omit<ComplianceTask, 'id' | 'created_at' | 'updated_at'>;
export type RedactedFileInsert = Omit<RedactedFile, 'id' | 'created_at'>;
export type SafeDatasetInsert = Omit<SafeDataset, 'id' | 'created_at' | 'updated_at'>;
export type ReportInsert = Omit<Report, 'id' | 'created_at'>;
export type AccessEventInsert = Omit<AccessEvent, 'id' | 'created_at'>;
