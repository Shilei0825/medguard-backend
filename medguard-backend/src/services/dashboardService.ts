import { supabase } from '../config/supabaseClient';
import {
  Scan,
  Alert,
  FolderRisk,
  RiskSnapshot,
  RiskLevel,
  RiskSimulationRequest,
  RiskSimulationResponse,
} from '../types/db';

interface DashboardOverview {
  totalScans: number;
  totalFiles: number;
  totalPhiCount: number;
  overallRiskScore: number | null;
  highRiskFileCount: number;
  criticalRiskFileCount: number;
  recentAlerts: Alert[];
  recentScans: Scan[];
}

interface ExposureMapFolder {
  folderPath: string;
  totalFiles: number;
  totalPhiCount: number;
  avgRiskScore: number;
  maxRiskLevel: RiskLevel | null;
}

interface RiskTimelinePoint {
  label: string;
  date: string;
  totalFiles: number;
  totalPhiCount: number;
  overallRiskScore: number | null;
  overallRiskLevel: RiskLevel | null;
}

export const dashboardService = {
  /**
   * Get comprehensive dashboard overview for an organization.
   */
  async getOverview(orgId: string): Promise<DashboardOverview> {
    // Get total scans count
    const { count: totalScans, error: scanCountError } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (scanCountError) throw new Error(`Failed to count scans: ${scanCountError.message}`);

    // Get total files count
    const { count: totalFiles, error: fileCountError } = await supabase
      .from('scanned_files')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (fileCountError) throw new Error(`Failed to count files: ${fileCountError.message}`);

    // Get total PHI count
    const { data: phiData, error: phiError } = await supabase
      .from('phi_findings')
      .select('occurrences')
      .eq('org_id', orgId);

    if (phiError) throw new Error(`Failed to get PHI count: ${phiError.message}`);

    const totalPhiCount = (phiData || []).reduce((sum, f) => sum + (f.occurrences || 0), 0);

    // Get high-risk and critical-risk file counts
    const { count: highRiskCount, error: highRiskError } = await supabase
      .from('scanned_files')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('risk_level', 'HIGH');

    if (highRiskError) throw new Error(`Failed to count high-risk files: ${highRiskError.message}`);

    const { count: criticalRiskCount, error: criticalError } = await supabase
      .from('scanned_files')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('risk_level', 'CRITICAL');

    if (criticalError) throw new Error(`Failed to count critical files: ${criticalError.message}`);

    // Get overall risk score from latest snapshot or recent scans
    let overallRiskScore: number | null = null;
    
    const { data: latestSnapshot } = await supabase
      .from('risk_snapshots')
      .select('overall_risk_score')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (latestSnapshot) {
      overallRiskScore = latestSnapshot.overall_risk_score;
    } else {
      // Fallback: calculate from recent scans
      const { data: recentScansForScore } = await supabase
        .from('scans')
        .select('overall_risk_score')
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .not('overall_risk_score', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (recentScansForScore && recentScansForScore.length > 0) {
        const sumScores = recentScansForScore.reduce((sum, s) => sum + (s.overall_risk_score || 0), 0);
        overallRiskScore = Math.round(sumScores / recentScansForScore.length);
      }
    }

    // Get recent alerts
    const { data: recentAlerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (alertsError) throw new Error(`Failed to get recent alerts: ${alertsError.message}`);

    // Get recent scans
    const { data: recentScans, error: scansError } = await supabase
      .from('scans')
      .select('*')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(5);

    if (scansError) throw new Error(`Failed to get recent scans: ${scansError.message}`);

    return {
      totalScans: totalScans || 0,
      totalFiles: totalFiles || 0,
      totalPhiCount,
      overallRiskScore,
      highRiskFileCount: highRiskCount || 0,
      criticalRiskFileCount: criticalRiskCount || 0,
      recentAlerts: (recentAlerts || []) as Alert[],
      recentScans: (recentScans || []) as Scan[],
    };
  },

  /**
   * Get exposure map showing folder-level risk aggregation.
   */
  async getExposureMap(
    orgId: string,
    scanId?: string
  ): Promise<{ folders: ExposureMapFolder[] }> {
    let query = supabase
      .from('folder_risks')
      .select('*')
      .eq('org_id', orgId)
      .order('avg_risk_score', { ascending: false });

    if (scanId) {
      query = query.eq('scan_id', scanId);
    } else {
      // Get from most recent scan if no scanId specified
      const { data: latestScan } = await supabase
        .from('scans')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (latestScan) {
        query = query.eq('scan_id', latestScan.id);
      }
    }

    const { data: folderRisks, error } = await query;
    if (error) throw new Error(`Failed to get exposure map: ${error.message}`);

    const folders: ExposureMapFolder[] = (folderRisks || []).map((fr: FolderRisk) => ({
      folderPath: fr.folder_path,
      totalFiles: fr.total_files,
      totalPhiCount: fr.total_phi_count,
      avgRiskScore: fr.avg_risk_score || 0,
      maxRiskLevel: fr.max_risk_level,
    }));

    return { folders };
  },

  /**
   * Get risk timeline showing historical risk trends.
   */
  async getRiskTimeline(
    orgId: string,
    options: { days?: number } = {}
  ): Promise<{ points: RiskTimelinePoint[] }> {
    const days = options.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try to get from risk_snapshots first
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('risk_snapshots')
      .select('*')
      .eq('org_id', orgId)
      .gte('snapshot_date', startDate.toISOString())
      .order('snapshot_date', { ascending: true });

    if (snapshotsError) throw new Error(`Failed to get snapshots: ${snapshotsError.message}`);

    if (snapshots && snapshots.length > 0) {
      const points: RiskTimelinePoint[] = snapshots.map((s: RiskSnapshot) => ({
        label: new Date(s.snapshot_date).toLocaleDateString(),
        date: s.snapshot_date,
        totalFiles: s.total_files,
        totalPhiCount: s.total_phi_count,
        overallRiskScore: s.overall_risk_score,
        overallRiskLevel: s.overall_risk_level,
      }));

      return { points };
    }

    // Fallback: aggregate from scans by date
    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: true });

    if (scansError) throw new Error(`Failed to get scans for timeline: ${scansError.message}`);

    // Group by date
    const dateMap = new Map<string, {
      totalFiles: number;
      totalPhiCount: number;
      riskScores: number[];
      maxRiskLevel: RiskLevel;
    }>();

    for (const scan of scans || []) {
      const dateKey = new Date(scan.completed_at).toISOString().split('T')[0];
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          totalFiles: 0,
          totalPhiCount: 0,
          riskScores: [],
          maxRiskLevel: 'LOW',
        });
      }

      const entry = dateMap.get(dateKey)!;
      entry.totalFiles += scan.total_files || 0;
      entry.totalPhiCount += scan.total_phi_count || 0;
      if (scan.overall_risk_score !== null) {
        entry.riskScores.push(scan.overall_risk_score);
      }
      
      const riskLevelOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (scan.overall_risk_level && 
          riskLevelOrder.indexOf(scan.overall_risk_level) > riskLevelOrder.indexOf(entry.maxRiskLevel)) {
        entry.maxRiskLevel = scan.overall_risk_level as RiskLevel;
      }
    }

    const points: RiskTimelinePoint[] = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        label: new Date(date).toLocaleDateString(),
        date,
        totalFiles: data.totalFiles,
        totalPhiCount: data.totalPhiCount,
        overallRiskScore: data.riskScores.length > 0
          ? Math.round(data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length)
          : null,
        overallRiskLevel: data.maxRiskLevel,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { points };
  },

  /**
   * Simulate risk reduction by removing specific files.
   */
  async simulateRiskReduction(request: RiskSimulationRequest): Promise<RiskSimulationResponse> {
    const { orgId, fileIdsToRemove } = request;

    // Get current totals
    const { data: allFiles, error: filesError } = await supabase
      .from('scanned_files')
      .select('id, phi_count, risk_score')
      .eq('org_id', orgId);

    if (filesError) throw new Error(`Failed to get files: ${filesError.message}`);

    let currentTotalPhiCount = 0;
    let currentTotalRiskScore = 0;
    let simulatedTotalPhiCount = 0;
    let simulatedTotalRiskScore = 0;
    let currentFileCount = 0;
    let simulatedFileCount = 0;

    for (const file of allFiles || []) {
      currentTotalPhiCount += file.phi_count || 0;
      currentTotalRiskScore += file.risk_score || 0;
      currentFileCount++;

      if (!fileIdsToRemove.includes(file.id)) {
        simulatedTotalPhiCount += file.phi_count || 0;
        simulatedTotalRiskScore += file.risk_score || 0;
        simulatedFileCount++;
      }
    }

    const currentAvgRisk = currentFileCount > 0 
      ? Math.round(currentTotalRiskScore / currentFileCount) 
      : 0;
    
    const simulatedAvgRisk = simulatedFileCount > 0 
      ? Math.round(simulatedTotalRiskScore / simulatedFileCount) 
      : 0;

    return {
      current: {
        totalPhiCount: currentTotalPhiCount,
        overallRiskScore: currentAvgRisk,
      },
      simulated: {
        totalPhiCount: simulatedTotalPhiCount,
        overallRiskScore: simulatedAvgRisk,
      },
      delta: {
        phiCountReduction: currentTotalPhiCount - simulatedTotalPhiCount,
        riskScoreReduction: currentAvgRisk - simulatedAvgRisk,
      },
    };
  },

  /**
   * Get PHI density by folder (files with high PHI concentration).
   */
  async getPhiDensity(orgId: string): Promise<Array<{
    folderPath: string;
    avgPhiPerFile: number;
    totalPhiCount: number;
    fileCount: number;
  }>> {
    const { data: folderRisks, error } = await supabase
      .from('folder_risks')
      .select('folder_path, total_files, total_phi_count')
      .eq('org_id', orgId)
      .gt('total_files', 0)
      .order('total_phi_count', { ascending: false })
      .limit(20);

    if (error) throw new Error(`Failed to get PHI density: ${error.message}`);

    return (folderRisks || []).map(fr => ({
      folderPath: fr.folder_path,
      avgPhiPerFile: fr.total_files > 0 
        ? Math.round((fr.total_phi_count / fr.total_files) * 10) / 10 
        : 0,
      totalPhiCount: fr.total_phi_count,
      fileCount: fr.total_files,
    }));
  },

  /**
   * Create a daily risk snapshot for the organization.
   * Should be called by a scheduled job.
   */
  async createRiskSnapshot(orgId: string): Promise<RiskSnapshot> {
    // Calculate current metrics
    const overview = await this.getOverview(orgId);

    const riskLevel: RiskLevel = 
      (overview.overallRiskScore || 0) >= 80 ? 'CRITICAL' :
      (overview.overallRiskScore || 0) >= 60 ? 'HIGH' :
      (overview.overallRiskScore || 0) >= 30 ? 'MEDIUM' : 'LOW';

    const snapshotData = {
      org_id: orgId,
      snapshot_date: new Date().toISOString().split('T')[0],
      total_files: overview.totalFiles,
      total_phi_count: overview.totalPhiCount,
      overall_risk_score: overview.overallRiskScore,
      overall_risk_level: riskLevel,
      high_risk_file_count: overview.highRiskFileCount,
      critical_risk_file_count: overview.criticalRiskFileCount,
    };

    const { data, error } = await supabase
      .from('risk_snapshots')
      .upsert(snapshotData, { 
        onConflict: 'org_id,snapshot_date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create risk snapshot: ${error.message}`);
    return data as RiskSnapshot;
  },
};

export default dashboardService;
