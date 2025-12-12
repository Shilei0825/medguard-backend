import { supabase } from '../config/supabaseClient';
import {
  AccessEvent,
  AccessEventInsert,
  AccessEventType,
} from '../types/db';

export const analyticsService = {
  /**
   * Log an access event.
   * Call this when relevant actions occur (viewing files, downloads, etc.)
   * 
   * Usage in controllers:
   * ```
   * await analyticsService.logAccessEvent(orgId, userId, fileId, 'VIEW', { source: 'api' });
   * ```
   */
  async logAccessEvent(
    orgId: string,
    userId: string | null,
    fileId: string | null,
    eventType: AccessEventType,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AccessEvent> {
    const insertData: AccessEventInsert = {
      org_id: orgId,
      user_id: userId,
      file_id: fileId,
      event_type: eventType,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      metadata: metadata || null,
    };

    const { data, error } = await supabase
      .from('access_events')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Failed to log access event: ${error.message}`);
    return data as AccessEvent;
  },

  /**
   * Get access summary analytics for an organization.
   */
  async getAccessSummary(
    orgId: string,
    options: {
      days?: number;
      limit?: number;
    } = {}
  ): Promise<{
    topFilesByViews: Array<{ fileId: string; fileName: string | null; viewCount: number }>;
    topUsersByAccess: Array<{ userId: string; eventCount: number }>;
    eventsByType: Record<AccessEventType, number>;
    totalEvents: number;
  }> {
    const days = options.days || 30;
    const limit = options.limit || 10;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all events in the period
    const { data: events, error } = await supabase
      .from('access_events')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString());

    if (error) throw new Error(`Failed to get access events: ${error.message}`);

    // Aggregate by file
    const fileViews = new Map<string, number>();
    const userAccess = new Map<string, number>();
    const eventsByType: Record<string, number> = {
      VIEW: 0,
      DOWNLOAD: 0,
      SHARE: 0,
      EDIT: 0,
      DELETE: 0,
      SCAN: 0,
      EXPORT: 0,
    };

    for (const event of events || []) {
      // Count by event type
      if (event.event_type in eventsByType) {
        eventsByType[event.event_type]++;
      }

      // Count file views
      if (event.file_id && event.event_type === 'VIEW') {
        fileViews.set(
          event.file_id,
          (fileViews.get(event.file_id) || 0) + 1
        );
      }

      // Count user access
      if (event.user_id) {
        userAccess.set(
          event.user_id,
          (userAccess.get(event.user_id) || 0) + 1
        );
      }
    }

    // Sort and limit file views
    const topFileIds = Array.from(fileViews.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Get file names for top files
    const topFilesByViews: Array<{ fileId: string; fileName: string | null; viewCount: number }> = [];
    
    if (topFileIds.length > 0) {
      const { data: files } = await supabase
        .from('scanned_files')
        .select('id, file_name')
        .in('id', topFileIds.map(f => f[0]));

      const fileNameMap = new Map((files || []).map(f => [f.id, f.file_name]));

      for (const [fileId, viewCount] of topFileIds) {
        topFilesByViews.push({
          fileId,
          fileName: fileNameMap.get(fileId) || null,
          viewCount,
        });
      }
    }

    // Sort and limit user access
    const topUsersByAccess = Array.from(userAccess.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, eventCount]) => ({ userId, eventCount }));

    return {
      topFilesByViews,
      topUsersByAccess,
      eventsByType: eventsByType as Record<AccessEventType, number>,
      totalEvents: events?.length || 0,
    };
  },

  /**
   * Get access events for a specific file.
   */
  async getFileAccessHistory(
    fileId: string,
    options: { limit?: number } = {}
  ): Promise<AccessEvent[]> {
    let query = supabase
      .from('access_events')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get file access history: ${error.message}`);

    return (data || []) as AccessEvent[];
  },

  /**
   * Get access events for a specific user.
   */
  async getUserAccessHistory(
    userId: string,
    orgId: string,
    options: { limit?: number; eventType?: AccessEventType } = {}
  ): Promise<AccessEvent[]> {
    let query = supabase
      .from('access_events')
      .select('*')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get user access history: ${error.message}`);

    return (data || []) as AccessEvent[];
  },

  /**
   * Detect access anomalies.
   * Returns files with unusually high access in recent period.
   */
  async detectAccessAnomalies(
    orgId: string,
    options: { 
      thresholdMultiplier?: number;
      recentHours?: number;
    } = {}
  ): Promise<Array<{
    fileId: string;
    recentAccessCount: number;
    averageAccessCount: number;
    anomalyScore: number;
  }>> {
    const thresholdMultiplier = options.thresholdMultiplier || 3;
    const recentHours = options.recentHours || 24;

    // Get recent access (last N hours)
    const recentStart = new Date();
    recentStart.setHours(recentStart.getHours() - recentHours);

    const { data: recentEvents, error: recentError } = await supabase
      .from('access_events')
      .select('file_id')
      .eq('org_id', orgId)
      .eq('event_type', 'VIEW')
      .not('file_id', 'is', null)
      .gte('created_at', recentStart.toISOString());

    if (recentError) throw new Error(`Failed to get recent events: ${recentError.message}`);

    // Get baseline access (last 30 days)
    const baselineStart = new Date();
    baselineStart.setDate(baselineStart.getDate() - 30);

    const { data: baselineEvents, error: baselineError } = await supabase
      .from('access_events')
      .select('file_id')
      .eq('org_id', orgId)
      .eq('event_type', 'VIEW')
      .not('file_id', 'is', null)
      .gte('created_at', baselineStart.toISOString());

    if (baselineError) throw new Error(`Failed to get baseline events: ${baselineError.message}`);

    // Count recent access by file
    const recentCounts = new Map<string, number>();
    for (const event of recentEvents || []) {
      if (event.file_id) {
        recentCounts.set(
          event.file_id,
          (recentCounts.get(event.file_id) || 0) + 1
        );
      }
    }

    // Calculate average daily access by file
    const baselineCounts = new Map<string, number>();
    for (const event of baselineEvents || []) {
      if (event.file_id) {
        baselineCounts.set(
          event.file_id,
          (baselineCounts.get(event.file_id) || 0) + 1
        );
      }
    }

    // Find anomalies
    const anomalies: Array<{
      fileId: string;
      recentAccessCount: number;
      averageAccessCount: number;
      anomalyScore: number;
    }> = [];

    // Average daily rate over 30 days, scaled to recent hours
    const hourScale = recentHours / (30 * 24);

    for (const [fileId, recentCount] of recentCounts) {
      const baselineCount = baselineCounts.get(fileId) || 0;
      const expectedCount = baselineCount * hourScale;
      const avgDailyCount = baselineCount / 30;

      if (expectedCount > 0 && recentCount > expectedCount * thresholdMultiplier) {
        anomalies.push({
          fileId,
          recentAccessCount: recentCount,
          averageAccessCount: Math.round(avgDailyCount * 100) / 100,
          anomalyScore: Math.round((recentCount / Math.max(expectedCount, 1)) * 100) / 100,
        });
      }
    }

    // Sort by anomaly score
    return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
  },

  /**
   * Delete old access events beyond retention period.
   */
  async deleteOldEvents(orgId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await supabase
      .from('access_events')
      .delete()
      .eq('org_id', orgId)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) throw new Error(`Failed to delete old events: ${error.message}`);
    return data?.length || 0;
  },
};

export default analyticsService;
