import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabaseClient';
import {
  Scan,
  ScannedFile,
  PhiFinding,
  FolderRisk,
  FileScanRequest,
  FolderScanRequest,
  ScanInsert,
  ScannedFileInsert,
  PhiFindingInsert,
  FolderRiskInsert,
  PhiType,
  PhiSeverity,
  RiskLevel,
  SourceType,
} from '../types/db';
import { alertService } from './alertService';

// ============================================================================
// PHI Detection Patterns (Stub Implementation)
// ============================================================================

interface PhiPattern {
  type: PhiType;
  pattern: RegExp;
  severity: PhiSeverity;
  description: string;
}

/**
 * PHI detection patterns for demo/stub scanning.
 * In production, this would be replaced with:
 * - ML-based NER models
 * - LLM-assisted detection
 * - Specialized medical NLP pipelines
 */
const PHI_PATTERNS: PhiPattern[] = [
  {
    type: 'SSN',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    severity: 'CRITICAL',
    description: 'Social Security Number',
  },
  {
    type: 'MRN',
    pattern: /\b(MRN|Medical Record)[\s:#]*\d{6,10}\b/gi,
    severity: 'HIGH',
    description: 'Medical Record Number',
  },
  {
    type: 'DOB',
    pattern: /\b(DOB|Date of Birth|Born)[\s:]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    severity: 'HIGH',
    description: 'Date of Birth',
  },
  {
    type: 'PHONE',
    pattern: /\b(\+1[\s-]?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g,
    severity: 'MEDIUM',
    description: 'Phone Number',
  },
  {
    type: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'MEDIUM',
    description: 'Email Address',
  },
  {
    type: 'DIAGNOSIS',
    pattern: /\b(diagnosis|diagnosed with|ICD-?10?)[\s:]+[A-Z]\d{2}(\.\d{1,2})?\b/gi,
    severity: 'CRITICAL',
    description: 'Medical Diagnosis Code',
  },
  {
    type: 'MEDICATION',
    pattern: /\b(prescribed|medication|taking|rx)[\s:]+\w+\s+\d+\s*(mg|ml|mcg)\b/gi,
    severity: 'HIGH',
    description: 'Medication Information',
  },
  {
    type: 'INSURANCE_ID',
    pattern: /\b(member|insurance|policy)[\s#:]*[A-Z]{2,3}\d{8,12}\b/gi,
    severity: 'HIGH',
    description: 'Insurance ID',
  },
  {
    type: 'CREDIT_CARD',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    severity: 'CRITICAL',
    description: 'Credit Card Number',
  },
  {
    type: 'ADDRESS',
    pattern: /\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi,
    severity: 'MEDIUM',
    description: 'Street Address',
  },
  {
    type: 'NAME',
    pattern: /\b(patient|name|mr\.|mrs\.|ms\.|dr\.)[\s:]+[A-Z][a-z]+\s+[A-Z][a-z]+\b/gi,
    severity: 'HIGH',
    description: 'Person Name',
  },
];

// ============================================================================
// PHI Scanning Logic
// ============================================================================

interface PhiScanResult {
  riskScore: number;
  riskLevel: RiskLevel;
  phiCount: number;
  findings: Array<{
    phiType: PhiType;
    severity: PhiSeverity;
    occurrences: number;
    sampleSnippet: string | null;
    lineNumber: number | null;
    confidenceScore: number;
  }>;
}

/**
 * Scan file content for PHI patterns.
 * This is a stub implementation using regex patterns.
 * 
 * TODO: Replace with production PHI detection:
 * - Integrate with cloud NLP services (AWS Comprehend Medical, Google Healthcare NLP)
 * - Use fine-tuned NER models for medical entity extraction
 * - Add context-aware detection to reduce false positives
 * - Implement confidence scoring based on surrounding context
 */
function scanContentForPhi(content: string | null | undefined, fileName: string): PhiScanResult {
  const findings: PhiScanResult['findings'] = [];
  let totalPhiCount = 0;
  let maxSeverityScore = 0;

  // If no content provided, generate mock findings based on filename
  const textToScan = content || generateMockContent(fileName);

  for (const pattern of PHI_PATTERNS) {
    const matches = textToScan.match(pattern.pattern);
    if (matches && matches.length > 0) {
      const occurrences = matches.length;
      totalPhiCount += occurrences;

      // Create masked sample snippet
      const firstMatch = matches[0];
      const sampleSnippet = maskSensitiveData(firstMatch, pattern.type);

      // Find approximate line number
      const matchIndex = textToScan.indexOf(firstMatch);
      const lineNumber = matchIndex >= 0 
        ? textToScan.substring(0, matchIndex).split('\n').length 
        : null;

      findings.push({
        phiType: pattern.type,
        severity: pattern.severity,
        occurrences,
        sampleSnippet,
        lineNumber,
        confidenceScore: 0.85, // Stub confidence score
      });

      // Track max severity
      const severityScore = getSeverityScore(pattern.severity);
      if (severityScore > maxSeverityScore) {
        maxSeverityScore = severityScore;
      }
    }
  }

  // Calculate risk score (0-100)
  const riskScore = calculateRiskScore(totalPhiCount, findings);
  const riskLevel = getRiskLevelFromScore(riskScore);

  return {
    riskScore,
    riskLevel,
    phiCount: totalPhiCount,
    findings,
  };
}

/**
 * Generate mock content for files without actual content.
 * Used for demo purposes when only metadata is provided.
 */
function generateMockContent(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('patient') || lowerName.includes('medical')) {
    return `
      Patient: John Smith
      DOB: 03/15/1985
      MRN: 123456789
      SSN: 123-45-6789
      Diagnosis: ICD-10 J06.9
      Medication: prescribed Amoxicillin 500 mg
      Address: 123 Main Street
      Phone: (555) 123-4567
      Email: john.smith@email.com
    `;
  }
  
  if (lowerName.includes('billing') || lowerName.includes('invoice')) {
    return `
      Insurance ID: ABC12345678
      Member ID: XYZ987654321
      Credit Card: 4111111111111111
      Address: 456 Oak Avenue
      Phone: 555-987-6543
    `;
  }
  
  // Default minimal content
  return `Document: ${fileName}\nCreated for scanning demo.`;
}

/**
 * Mask sensitive data for sample snippets.
 * Shows pattern type but hides actual values.
 */
function maskSensitiveData(value: string, _phiType: PhiType): string {
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
}

function getSeverityScore(severity: PhiSeverity): number {
  switch (severity) {
    case 'CRITICAL': return 100;
    case 'HIGH': return 75;
    case 'MEDIUM': return 50;
    case 'LOW': return 25;
    default: return 0;
  }
}

function calculateRiskScore(phiCount: number, findings: PhiScanResult['findings']): number {
  if (phiCount === 0) return 0;

  // Weighted scoring based on severity and count
  let weightedSum = 0;
  let totalWeight = 0;

  for (const finding of findings) {
    const severityWeight = getSeverityScore(finding.severity) / 100;
    const countWeight = Math.min(finding.occurrences / 10, 1); // Cap at 10 occurrences
    weightedSum += severityWeight * (1 + countWeight);
    totalWeight += 1;
  }

  const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  
  // Add bonus for high PHI count
  const countBonus = Math.min(phiCount * 2, 20);
  
  return Math.min(Math.round(baseScore + countBonus), 100);
}

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// Scan Service
// ============================================================================

export const scanService = {
  /**
   * Create and execute a single file scan.
   */
  async createFileScan(request: FileScanRequest): Promise<{
    scan: Scan;
    file: ScannedFile;
    phiFindings: PhiFinding[];
  }> {
    const scanId = uuidv4();
    const fileId = uuidv4();
    const now = new Date().toISOString();

    // Create scan record
    const scanInsert: ScanInsert = {
      org_id: request.orgId,
      user_id: request.userId || null,
      scan_type: 'file',
      source_type: null,
      source_label: request.sourceLabel,
      root_path: null,
      status: 'running',
      overall_risk_score: null,
      overall_risk_level: null,
      total_files: 1,
      total_phi_count: 0,
      started_at: now,
      completed_at: null,
      error_message: null,
    };

    const { data: scanData, error: scanError } = await supabase
      .from('scans')
      .insert({ id: scanId, ...scanInsert })
      .select()
      .single();

    if (scanError) throw new Error(`Failed to create scan: ${scanError.message}`);

    // Create scanned file record
    const fileInsert: ScannedFileInsert = {
      scan_id: scanId,
      org_id: request.orgId,
      file_name: request.file.fileName,
      file_path: request.file.filePath || null,
      file_size_bytes: request.file.sizeBytes || null,
      mime_type: request.file.mimeType || null,
      risk_score: null,
      risk_level: null,
      phi_count: 0,
      checksum: null,
    };

    const { data: fileData, error: fileError } = await supabase
      .from('scanned_files')
      .insert({ id: fileId, ...fileInsert })
      .select()
      .single();

    if (fileError) throw new Error(`Failed to create scanned file: ${fileError.message}`);

    // Scan content for PHI
    const phiResult = scanContentForPhi(request.file.content, request.file.fileName);

    // Insert PHI findings
    const phiFindingInserts: PhiFindingInsert[] = phiResult.findings.map(f => ({
      file_id: fileId,
      scan_id: scanId,
      org_id: request.orgId,
      phi_type: f.phiType,
      severity: f.severity,
      occurrences: f.occurrences,
      sample_snippet: f.sampleSnippet,
      line_number: f.lineNumber,
      char_offset: null,
      confidence_score: f.confidenceScore,
    }));

    let phiFindings: PhiFinding[] = [];
    if (phiFindingInserts.length > 0) {
      const { data: findingsData, error: findingsError } = await supabase
        .from('phi_findings')
        .insert(phiFindingInserts)
        .select();

      if (findingsError) throw new Error(`Failed to insert PHI findings: ${findingsError.message}`);
      phiFindings = findingsData || [];
    }

    // Update scanned file with risk info
    const { data: updatedFile, error: updateFileError } = await supabase
      .from('scanned_files')
      .update({
        risk_score: phiResult.riskScore,
        risk_level: phiResult.riskLevel,
        phi_count: phiResult.phiCount,
      })
      .eq('id', fileId)
      .select()
      .single();

    if (updateFileError) throw new Error(`Failed to update file: ${updateFileError.message}`);

    // Update scan with results
    const { data: updatedScan, error: updateScanError } = await supabase
      .from('scans')
      .update({
        status: 'completed',
        overall_risk_score: phiResult.riskScore,
        overall_risk_level: phiResult.riskLevel,
        total_phi_count: phiResult.phiCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)
      .select()
      .single();

    if (updateScanError) throw new Error(`Failed to update scan: ${updateScanError.message}`);

    // Create alert for high-risk files
    if (phiResult.riskLevel === 'HIGH' || phiResult.riskLevel === 'CRITICAL') {
      await alertService.createAlert({
        org_id: request.orgId,
        alert_type: 'HIGH_FILE_RISK',
        severity: phiResult.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: `High-risk file detected: ${request.file.fileName}`,
        description: `File contains ${phiResult.phiCount} PHI instances with risk score ${phiResult.riskScore}`,
        related_scan_id: scanId,
        related_file_id: fileId,
        related_vendor_id: null,
        is_resolved: false,
        resolved_at: null,
        resolved_by_user_id: null,
      });
    }

    return {
      scan: updatedScan as Scan,
      file: updatedFile as ScannedFile,
      phiFindings,
    };
  },

  /**
   * Create and execute a folder scan across multiple files.
   */
  async createFolderScan(request: FolderScanRequest): Promise<{
    scan: Scan;
    files: ScannedFile[];
    folderRisks: FolderRisk[];
    highRiskFiles: ScannedFile[];
  }> {
    const scanId = uuidv4();
    const now = new Date().toISOString();

    // Create scan record
    const scanInsert: ScanInsert = {
      org_id: request.orgId,
      user_id: request.userId || null,
      scan_type: 'folder',
      source_type: request.sourceType,
      source_label: request.sourceLabel,
      root_path: request.rootPath,
      status: 'running',
      overall_risk_score: null,
      overall_risk_level: null,
      total_files: request.files.length,
      total_phi_count: 0,
      started_at: now,
      completed_at: null,
      error_message: null,
    };

    const { data: scanData, error: scanError } = await supabase
      .from('scans')
      .insert({ id: scanId, ...scanInsert })
      .select()
      .single();

    if (scanError) throw new Error(`Failed to create scan: ${scanError.message}`);

    const scannedFiles: ScannedFile[] = [];
    const allPhiFindings: PhiFinding[] = [];
    let totalPhiCount = 0;
    let totalRiskScore = 0;
    let maxRiskLevel: RiskLevel = 'LOW';

    // Process each file
    for (const file of request.files) {
      const fileId = uuidv4();

      // Scan content
      const phiResult = scanContentForPhi(file.content, file.fileName);
      totalPhiCount += phiResult.phiCount;
      totalRiskScore += phiResult.riskScore;

      if (getSeverityScore(phiResult.riskLevel) > getSeverityScore(maxRiskLevel)) {
        maxRiskLevel = phiResult.riskLevel;
      }

      // Insert scanned file
      const fileInsert: ScannedFileInsert = {
        scan_id: scanId,
        org_id: request.orgId,
        file_name: file.fileName,
        file_path: file.filePath || null,
        file_size_bytes: file.sizeBytes || null,
        mime_type: file.mimeType || null,
        risk_score: phiResult.riskScore,
        risk_level: phiResult.riskLevel,
        phi_count: phiResult.phiCount,
        checksum: null,
      };

      const { data: fileData, error: fileError } = await supabase
        .from('scanned_files')
        .insert({ id: fileId, ...fileInsert })
        .select()
        .single();

      if (fileError) throw new Error(`Failed to create scanned file: ${fileError.message}`);
      scannedFiles.push(fileData as ScannedFile);

      // Insert PHI findings
      if (phiResult.findings.length > 0) {
        const findingInserts: PhiFindingInsert[] = phiResult.findings.map(f => ({
          file_id: fileId,
          scan_id: scanId,
          org_id: request.orgId,
          phi_type: f.phiType,
          severity: f.severity,
          occurrences: f.occurrences,
          sample_snippet: f.sampleSnippet,
          line_number: f.lineNumber,
          char_offset: null,
          confidence_score: f.confidenceScore,
        }));

        const { data: findingsData, error: findingsError } = await supabase
          .from('phi_findings')
          .insert(findingInserts)
          .select();

        if (findingsError) throw new Error(`Failed to insert findings: ${findingsError.message}`);
        allPhiFindings.push(...(findingsData || []));
      }

      // Create alert for high-risk files
      if (phiResult.riskLevel === 'HIGH' || phiResult.riskLevel === 'CRITICAL') {
        await alertService.createAlert({
          org_id: request.orgId,
          alert_type: 'HIGH_FILE_RISK',
          severity: phiResult.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `High-risk file detected: ${file.fileName}`,
          description: `File contains ${phiResult.phiCount} PHI instances with risk score ${phiResult.riskScore}`,
          related_scan_id: scanId,
          related_file_id: fileId,
          related_vendor_id: null,
          is_resolved: false,
          resolved_at: null,
          resolved_by_user_id: null,
        });
      }
    }

    // Compute folder-level aggregates
    const folderAggregates = computeFolderAggregates(scannedFiles, request.rootPath);
    const folderRisks: FolderRisk[] = [];

    for (const agg of folderAggregates) {
      const folderInsert: FolderRiskInsert = {
        scan_id: scanId,
        org_id: request.orgId,
        folder_path: agg.folderPath,
        total_files: agg.totalFiles,
        total_phi_count: agg.totalPhiCount,
        avg_risk_score: agg.avgRiskScore,
        max_risk_level: agg.maxRiskLevel,
      };

      const { data: folderData, error: folderError } = await supabase
        .from('folder_risks')
        .insert(folderInsert)
        .select()
        .single();

      if (folderError) throw new Error(`Failed to insert folder risk: ${folderError.message}`);
      folderRisks.push(folderData as FolderRisk);
    }

    // Calculate overall scan metrics
    const avgRiskScore = scannedFiles.length > 0 
      ? Math.round(totalRiskScore / scannedFiles.length) 
      : 0;

    // Update scan with results
    const { data: updatedScan, error: updateScanError } = await supabase
      .from('scans')
      .update({
        status: 'completed',
        overall_risk_score: avgRiskScore,
        overall_risk_level: maxRiskLevel,
        total_phi_count: totalPhiCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)
      .select()
      .single();

    if (updateScanError) throw new Error(`Failed to update scan: ${updateScanError.message}`);

    // Get high-risk files
    const highRiskFiles = scannedFiles.filter(
      f => f.risk_level === 'HIGH' || f.risk_level === 'CRITICAL'
    );

    return {
      scan: updatedScan as Scan,
      files: scannedFiles,
      folderRisks,
      highRiskFiles,
    };
  },

  /**
   * Get scan details by ID.
   */
  async getScanById(scanId: string): Promise<{
    scan: Scan;
    files: ScannedFile[];
    phiSummary: Array<{ phi_type: PhiType; total_count: number }>;
    folderRisks: FolderRisk[];
  } | null> {
    // Get scan
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanError || !scan) return null;

    // Get files
    const { data: files, error: filesError } = await supabase
      .from('scanned_files')
      .select('*')
      .eq('scan_id', scanId)
      .order('risk_score', { ascending: false });

    if (filesError) throw new Error(`Failed to get files: ${filesError.message}`);

    // Get PHI summary
    const { data: phiFindings, error: phiError } = await supabase
      .from('phi_findings')
      .select('phi_type, occurrences')
      .eq('scan_id', scanId);

    if (phiError) throw new Error(`Failed to get PHI findings: ${phiError.message}`);

    // Aggregate PHI by type
    const phiSummaryMap = new Map<PhiType, number>();
    for (const finding of phiFindings || []) {
      const current = phiSummaryMap.get(finding.phi_type as PhiType) || 0;
      phiSummaryMap.set(finding.phi_type as PhiType, current + finding.occurrences);
    }

    const phiSummary = Array.from(phiSummaryMap.entries())
      .map(([phi_type, total_count]) => ({ phi_type, total_count }))
      .sort((a, b) => b.total_count - a.total_count);

    // Get folder risks
    const { data: folderRisks, error: folderError } = await supabase
      .from('folder_risks')
      .select('*')
      .eq('scan_id', scanId)
      .order('avg_risk_score', { ascending: false });

    if (folderError) throw new Error(`Failed to get folder risks: ${folderError.message}`);

    return {
      scan: scan as Scan,
      files: (files || []) as ScannedFile[],
      phiSummary,
      folderRisks: (folderRisks || []) as FolderRisk[],
    };
  },

  /**
   * List scans for an organization.
   */
  async listScans(
    orgId: string,
    options: { limit?: number; status?: string } = {}
  ): Promise<Scan[]> {
    let query = supabase
      .from('scans')
      .select('*')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list scans: ${error.message}`);

    return (data || []) as Scan[];
  },

  /**
   * Get file by ID with PHI findings.
   */
  async getFileById(fileId: string): Promise<{
    file: ScannedFile;
    phiFindings: PhiFinding[];
  } | null> {
    const { data: file, error: fileError } = await supabase
      .from('scanned_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) return null;

    const { data: findings, error: findingsError } = await supabase
      .from('phi_findings')
      .select('*')
      .eq('file_id', fileId)
      .order('severity', { ascending: false });

    if (findingsError) throw new Error(`Failed to get findings: ${findingsError.message}`);

    return {
      file: file as ScannedFile,
      phiFindings: (findings || []) as PhiFinding[],
    };
  },

  /**
   * Find duplicate files based on PHI fingerprints.
   */
  async findDuplicateFiles(fileId: string): Promise<ScannedFile[]> {
    // Get fingerprints for this file
    const { data: fileFingerprints, error: fpError } = await supabase
      .from('file_fingerprints')
      .select('fingerprint_id')
      .eq('file_id', fileId);

    if (fpError || !fileFingerprints || fileFingerprints.length === 0) {
      return [];
    }

    const fingerprintIds = fileFingerprints.map(f => f.fingerprint_id);

    // Find other files with same fingerprints
    const { data: matchingFingerprints, error: matchError } = await supabase
      .from('file_fingerprints')
      .select('file_id')
      .in('fingerprint_id', fingerprintIds)
      .neq('file_id', fileId);

    if (matchError || !matchingFingerprints) {
      return [];
    }

    const matchingFileIds = [...new Set(matchingFingerprints.map(f => f.file_id))];

    if (matchingFileIds.length === 0) return [];

    // Get file details
    const { data: files, error: filesError } = await supabase
      .from('scanned_files')
      .select('*')
      .in('id', matchingFileIds);

    if (filesError) throw new Error(`Failed to get duplicate files: ${filesError.message}`);

    return (files || []) as ScannedFile[];
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

interface FolderAggregate {
  folderPath: string;
  totalFiles: number;
  totalPhiCount: number;
  avgRiskScore: number;
  maxRiskLevel: RiskLevel;
}

function computeFolderAggregates(files: ScannedFile[], rootPath: string): FolderAggregate[] {
  const folderMap = new Map<string, {
    files: ScannedFile[];
    totalPhiCount: number;
    totalRiskScore: number;
    maxRiskLevel: RiskLevel;
  }>();

  for (const file of files) {
    const filePath = file.file_path || file.file_name;
    const folderPath = getParentFolder(filePath, rootPath);

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, {
        files: [],
        totalPhiCount: 0,
        totalRiskScore: 0,
        maxRiskLevel: 'LOW',
      });
    }

    const agg = folderMap.get(folderPath)!;
    agg.files.push(file);
    agg.totalPhiCount += file.phi_count;
    agg.totalRiskScore += file.risk_score || 0;

    if (file.risk_level && getSeverityScore(file.risk_level) > getSeverityScore(agg.maxRiskLevel)) {
      agg.maxRiskLevel = file.risk_level;
    }
  }

  return Array.from(folderMap.entries()).map(([folderPath, agg]) => ({
    folderPath,
    totalFiles: agg.files.length,
    totalPhiCount: agg.totalPhiCount,
    avgRiskScore: agg.files.length > 0 
      ? Math.round(agg.totalRiskScore / agg.files.length) 
      : 0,
    maxRiskLevel: agg.maxRiskLevel,
  }));
}

function getParentFolder(filePath: string, rootPath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return rootPath || '/';
  parts.pop(); // Remove filename
  return parts.join('/') || rootPath || '/';
}

export default scanService;
