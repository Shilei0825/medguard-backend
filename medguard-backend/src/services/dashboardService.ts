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

async getOverview(orgId: string): Promise<DashboardOverview> {
  // Always return a complete object, even when DB is empty or errors happen
  const empty: DashboardOverview = {
    totalScans: 0,
    totalFiles: 0,
    totalPhiCount: 0,
    highRiskFilesCount: 0,
    overallRiskScore: 0,
    overallRiskLevel: "LOW",
    recentAlerts: [],
    recentScans: []
  };

  try {
    // 1) Total scans count
    const { count: totalScans, error: scanCountError } = await supabase
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (scanCountError) {
      console.error("getOverview scan count error:", scanCountError);
      // Don't throw; keep going with defaults
    }

    // 2) Total files count
    const { count: totalFiles, error: fileCountError } = await supabase
      .from("scanned_files")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (fileCountError) {
      console.error("getOverview file count error:", fileCountError);
    }

    // 3) Total PHI count (sum phi_count across scanned_files)
    // If you have a phi_count column already, this is easiest.
    // If not, you can count rows in phi_findings instead.
    let totalPhiCount = 0;
    const { data: phiRows, error: phiSumError } = await supabase
      .from("scanned_files")
      .select("phi_count")
      .eq("org_id", orgId)
      .limit(5000); // protect against huge orgs

    if (phiSumError) {
      console.error("getOverview phi sum error:", phiSumError);
    } else if (phiRows) {
      totalPhiCount = phiRows.reduce((acc, r: any) => acc + (Number(r.phi_count) || 0), 0);
    }

    // 4) High risk files count (define “high-risk” based on your risk_level values)
    // If your values include HIGH/CRITICAL, count those.
    const { count: highRiskFilesCount, error: highRiskError } = await supabase
      .from("scanned_files")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("risk_level", ["HIGH", "CRITICAL"]);

    if (highRiskError) {
      console.error("getOverview high risk file count error:", highRiskError);
    }

    // 5) Overall risk score/level from most recent scan (fallback to 0/LOW)
    const { data: latestScan, error: latestScanError } = await supabase
      .from("scans")
      .select("overall_risk_score, overall_risk_level, started_at")
      .eq("org_id", orgId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestScanError) {
      console.error("getOverview latest scan error:", latestScanError);
    }

    const overallRiskScore = Number(latestScan?.overall_risk_score) || 0;
    const overallRiskLevel = (latestScan?.overall_risk_level as any) || "LOW";

    // 6) Recent alerts
    const { data: recentAlerts, error: alertsError } = await supabase
      .from("alerts")
      .select("id, severity, title, alert_type, is_resolved, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (alertsError) {
      console.error("getOverview recent alerts error:", alertsError);
    }

    // 7) Recent scans list
    const { data: recentScans, error: scansError } = await supabase
      .from("scans")
      .select("id, scan_type, source_label, status, overall_risk_score, overall_risk_level, started_at, completed_at")
      .eq("org_id", orgId)
      .order("started_at", { ascending: false })
      .limit(10);

    if (scansError) {
      console.error("getOverview recent scans error:", scansError);
    }

    // ✅ Return complete object (never null/undefined)
    return {
      totalScans: totalScans ?? 0,
      totalFiles: totalFiles ?? 0,
      totalPhiCount,
      highRiskFilesCount: highRiskFilesCount ?? 0,
      overallRiskScore,
      overallRiskLevel,
      recentAlerts: recentAlerts ?? [],
      recentScans: recentScans ?? []
    };
  } catch (e) {
    console.error("getOverview unexpected error:", e);
    return empty;
  }
}

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
