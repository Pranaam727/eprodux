// ============================================================
// Eprodux / EcoTwin – Video Upload & CV Pipeline Service Adapter
// Connects to CV/Twin backend when available, or executes a
// deterministic, transparent mock pipeline in Demo Mode.
// ============================================================

import type {
  RoomId,
  VideoAnalysisResult,
  VideoRoomObservation,
  VideoAnalysisEvent,
} from '../types';
import { IS_DEMO } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB
export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
export const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.avi'];

export interface VideoUploadProgressCallback {
  (percentage: number, statusText: string): void;
}

/**
 * Validate video file type and size before any network submission.
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.includes(extension);
  const hasValidMime = SUPPORTED_VIDEO_FORMATS.includes(file.type) || hasValidExt;

  if (!hasValidMime) {
    return {
      valid: false,
      error: `Unsupported format "${extension || file.type}". Supported formats are MP4, MOV, and AVI.`,
    };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (MAX_VIDEO_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File is too large (${sizeMb} MB). Maximum allowed size is ${maxMb} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Helper to safely generate and track browser preview Object URLs
 */
export function createVideoPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeVideoPreviewUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[videoService] Failed to revoke object URL:', err);
    }
  }
}

/**
 * Initiates video analysis against either the backend CV adapter or demo simulator.
 */
/**
 * Fetch recorded CV events from backend, strictly ordered chronologically.
 */
export async function fetchCvOccupancyEvents(
  roomId?: RoomId,
  limit?: number,
): Promise<VideoAnalysisEvent[]> {
  try {
    const params = new URLSearchParams();
    if (roomId) params.append('room_id', roomId);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/events/cv${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map((item: any, idx: number) => ({
      timestampSeconds: item.timestamp ? new Date(item.timestamp).getTime() / 1000 : idx * 10,
      timecode: item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : `00:${idx * 10}`,
      roomId: item.zone_id as RoomId,
      occupancy: item.occupancy,
      currentOccupancy: item.occupancy,
      detectionCount: item.occupancy,
      uniqueTrackedPeople: item.occupancy,
      confidence: item.confidence ?? 0.95,
      activity: item.source || 'cv_detection',
    }));
  } catch (err) {
    console.warn('[videoService] Failed to fetch CV events from backend:', err);
    return [];
  }
}

/**
 * Initiates video analysis against either the backend CV adapter or demo simulator.
 */
export async function uploadAndAnalyzeVideo(
  file: File,
  onProgress?: VideoUploadProgressCallback,
  signal?: AbortSignal,
  targetRoomId: RoomId | 'all' = 'all',
): Promise<VideoAnalysisResult> {
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // If live mode is enabled, attempt real backend contract first
  if (!IS_DEMO) {
    try {
      return await submitVideoToBackend(file, onProgress, signal, targetRoomId);
    } catch (backendErr: any) {
      if (signal?.aborted) throw new Error('Analysis cancelled by user.');
      console.warn('[videoService] Live backend video upload failed, falling back to demo mode:', backendErr);
      // Fall through to simulated pipeline with clear warning
    }
  }

  // Execute demo pipeline with realistic async progress steps
  return await simulateVideoAnalysis(file, onProgress, signal, targetRoomId);
}

/**
 * Submits video file to the real backend API contract
 * Contract:
 *   POST /api/video/analyze (multipart/form-data with 'file')
 *   Returns job_id and status.
 */
async function submitVideoToBackend(
  file: File,
  onProgress?: VideoUploadProgressCallback,
  signal?: AbortSignal,
  targetRoomId: RoomId | 'all' = 'all',
): Promise<VideoAnalysisResult> {
  onProgress?.(10, 'Connecting to CV pipeline endpoint...');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', 'user_upload');
  if (targetRoomId && targetRoomId !== 'all') {
    formData.append('target_room_id', targetRoomId);
  }

  const res = await fetch(`${API_BASE_URL}/api/video/analyze`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    throw new Error(`CV Backend responded with HTTP ${res.status}: ${res.statusText}`);
  }

  const initialResponse = await res.json();
  const jobId = initialResponse.job_id || initialResponse.id;

  if (initialResponse.result) {
    return {
      ...initialResponse.result,
      isDemo: false,
    };
  }

  if (initialResponse.observations) {
    return {
      ...initialResponse,
      isDemo: false,
    };
  }

  if (!jobId) {
    throw new Error('Backend did not return a valid analysis job ID.');
  }

  // Poll for job completion
  let attempts = 0;
  const maxAttempts = 60; // 60 * 1.5s = 90s max

  while (attempts < maxAttempts) {
    if (signal?.aborted) throw new Error('Analysis cancelled by user.');
    await new Promise(r => setTimeout(r, 1500));
    attempts++;

    onProgress?.(
      Math.min(20 + Math.round((attempts / maxAttempts) * 75), 95),
      `Processing frames with YOLO & ByteTrack (${attempts * 2}s)...`,
    );

    const pollRes = await fetch(`${API_BASE_URL}/api/video/status/${jobId}`, { signal });
    if (!pollRes.ok) continue;

    const jobData = await pollRes.json();
    if (jobData.status === 'completed') {
      onProgress?.(100, 'Analysis complete!');
      return {
        ...(jobData.result || jobData),
        isDemo: false,
      };
    } else if (jobData.status === 'failed') {
      throw new Error(jobData.error || 'CV inference failed on server.');
    }
  }

  throw new Error('Video analysis timed out waiting for backend worker.');
}

/**
 * Deterministic, transparent mock pipeline simulating real CV inference:
 * Extracts metadata, simulates YOLO frame detection across canonical rooms,
 * and yields strictly sorted, chronological occupancy events with tracking deltas.
 */
async function simulateVideoAnalysis(
  file: File,
  onProgress?: VideoUploadProgressCallback,
  signal?: AbortSignal,
  targetRoomId: RoomId | 'all' = 'all',
): Promise<VideoAnalysisResult> {
  const delay = (ms: number) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Analysis cancelled by user.'));
    const t = setTimeout(() => {
      if (signal?.aborted) reject(new Error('Analysis cancelled by user.'));
      else resolve(null);
    }, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('Analysis cancelled by user.'));
    });
  });

  onProgress?.(15, 'Uploading video to sandbox...');
  await delay(600);

  onProgress?.(40, 'Extracting video stream & metadata...');
  await delay(700);

  onProgress?.(65, 'Running YOLOv8 person detection across zones...');
  await delay(900);

  onProgress?.(85, 'Correlating ByteTrack trajectories with digital twin...');
  await delay(800);

  onProgress?.(100, 'Finalizing zone observations & energy correlation...');
  await delay(400);

  const now = new Date().toISOString();
  const durationSec = 120; // 2 minutes simulated footage

  const observations: Record<string, VideoRoomObservation> = {
    seminar_hall: {
      roomId: 'seminar_hall',
      roomName: 'Seminar Hall',
      peakOccupancy: 0,
      averageOccupancy: 0,
      currentOccupancy: 0,
      detectionCount: 0,
      uniqueTrackedPeople: 0,
      lightingState: 'ON',
      lightingProvenance: 'simulated',
      anomalies: ['Unoccupied room with lighting left active for > 2 hours'],
      confidence: 0.985,
      freshnessIso: now,
    },
    classroom: {
      roomId: 'classroom',
      roomName: 'Classroom',
      peakOccupancy: 24,
      averageOccupancy: 18,
      currentOccupancy: 19,
      detectionCount: 20,
      uniqueTrackedPeople: 24,
      lightingState: 'ON',
      lightingProvenance: 'simulated',
      anomalies: [],
      confidence: 0.965,
      freshnessIso: now,
    },
    lab: {
      roomId: 'lab',
      roomName: 'Laboratory',
      peakOccupancy: 12,
      averageOccupancy: 8,
      currentOccupancy: 6,
      detectionCount: 7,
      uniqueTrackedPeople: 12,
      lightingState: 'ON',
      lightingProvenance: 'manual',
      anomalies: [],
      confidence: 0.925,
      freshnessIso: now,
    },
    office: {
      roomId: 'office',
      roomName: 'Office',
      peakOccupancy: 4,
      averageOccupancy: 2,
      currentOccupancy: 2,
      detectionCount: 2,
      uniqueTrackedPeople: 4,
      lightingState: 'OFF',
      lightingProvenance: 'simulated',
      anomalies: [],
      confidence: 0.895,
      freshnessIso: now,
    },
  };

  let rawTimeline: VideoAnalysisEvent[] = [];

  if (targetRoomId === 'classroom') {
    rawTimeline = [
      { timestampSeconds: 10, timecode: '00:10', roomId: 'classroom', occupancy: 8, currentOccupancy: 8, detectionCount: 8, uniqueTrackedPeople: 8, confidence: 0.952, delta: 8, activity: 'Doors Open · Arrivals', frameNumber: 300 },
      { timestampSeconds: 20, timecode: '00:20', roomId: 'classroom', occupancy: 12, currentOccupancy: 12, detectionCount: 13, uniqueTrackedPeople: 12, confidence: 0.958, delta: 4, activity: 'Entering (+4)', frameNumber: 600 },
      { timestampSeconds: 30, timecode: '00:30', roomId: 'classroom', occupancy: 16, currentOccupancy: 16, detectionCount: 16, uniqueTrackedPeople: 16, confidence: 0.968, delta: 4, activity: 'Entering (+4)', frameNumber: 900 },
      { timestampSeconds: 45, timecode: '00:45', roomId: 'classroom', occupancy: 19, currentOccupancy: 19, detectionCount: 18, uniqueTrackedPeople: 19, confidence: 0.964, delta: 3, activity: 'Entering (+3)', frameNumber: 1350 },
      { timestampSeconds: 60, timecode: '01:00', roomId: 'classroom', occupancy: 22, currentOccupancy: 22, detectionCount: 23, uniqueTrackedPeople: 22, confidence: 0.971, delta: 3, activity: 'Class Assembling', frameNumber: 1800 },
      { timestampSeconds: 75, timecode: '01:15', roomId: 'classroom', occupancy: 24, currentOccupancy: 24, detectionCount: 24, uniqueTrackedPeople: 24, confidence: 0.975, delta: 2, activity: 'Lecture In-Session (Peak 24)', frameNumber: 2250 },
      { timestampSeconds: 90, timecode: '01:30', roomId: 'classroom', occupancy: 24, currentOccupancy: 24, detectionCount: 23, uniqueTrackedPeople: 24, confidence: 0.969, delta: 0, activity: 'Steady Attendance', frameNumber: 2700 },
      { timestampSeconds: 105, timecode: '01:45', roomId: 'classroom', occupancy: 21, currentOccupancy: 21, detectionCount: 21, uniqueTrackedPeople: 24, confidence: 0.965, delta: -3, activity: 'Early Dismissal (-3)', frameNumber: 3150 },
      { timestampSeconds: 115, timecode: '01:55', roomId: 'classroom', occupancy: 19, currentOccupancy: 19, detectionCount: 20, uniqueTrackedPeople: 24, confidence: 0.961, delta: -2, activity: 'Break Transition (-2)', frameNumber: 3450 },
    ];
  } else if (targetRoomId === 'seminar_hall') {
    rawTimeline = [
      { timestampSeconds: 10, timecode: '00:10', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.985, delta: 0, activity: 'Vacant · Lights ON', frameNumber: 300 },
      { timestampSeconds: 30, timecode: '00:30', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.988, delta: 0, activity: 'Zero Motion Detected', frameNumber: 900 },
      { timestampSeconds: 60, timecode: '01:00', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.991, delta: 0, activity: 'Idle Energy Waste (>1h)', frameNumber: 1800 },
      { timestampSeconds: 90, timecode: '01:30', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.989, delta: 0, activity: 'Idle Energy Waste', frameNumber: 2700 },
      { timestampSeconds: 115, timecode: '01:55', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.992, delta: 0, activity: 'Unoccupied · Recommended Turn-Off', frameNumber: 3450 },
    ];
  } else if (targetRoomId === 'lab') {
    rawTimeline = [
      { timestampSeconds: 15, timecode: '00:15', roomId: 'lab', occupancy: 5, currentOccupancy: 5, detectionCount: 5, uniqueTrackedPeople: 5, confidence: 0.912, delta: 5, activity: 'Lab Prep Team', frameNumber: 450 },
      { timestampSeconds: 35, timecode: '00:35', roomId: 'lab', occupancy: 7, currentOccupancy: 7, detectionCount: 8, uniqueTrackedPeople: 7, confidence: 0.924, delta: 2, activity: 'Researchers Entering', frameNumber: 1050 },
      { timestampSeconds: 55, timecode: '00:55', roomId: 'lab', occupancy: 10, currentOccupancy: 10, detectionCount: 10, uniqueTrackedPeople: 10, confidence: 0.931, delta: 3, activity: 'Equipment Activated', frameNumber: 1650 },
      { timestampSeconds: 75, timecode: '01:15', roomId: 'lab', occupancy: 12, currentOccupancy: 12, detectionCount: 12, uniqueTrackedPeople: 12, confidence: 0.936, delta: 2, activity: 'Peak Experiment Session', frameNumber: 2250 },
      { timestampSeconds: 95, timecode: '01:35', roomId: 'lab', occupancy: 9, currentOccupancy: 9, detectionCount: 8, uniqueTrackedPeople: 12, confidence: 0.928, delta: -3, activity: 'Team Shift Rotation', frameNumber: 2850 },
      { timestampSeconds: 115, timecode: '01:55', roomId: 'lab', occupancy: 6, currentOccupancy: 6, detectionCount: 7, uniqueTrackedPeople: 12, confidence: 0.921, delta: -3, activity: 'Equipment Standby', frameNumber: 3450 },
    ];
  } else if (targetRoomId === 'office') {
    rawTimeline = [
      { timestampSeconds: 10, timecode: '00:10', roomId: 'office', occupancy: 1, currentOccupancy: 1, detectionCount: 1, uniqueTrackedPeople: 1, confidence: 0.892, delta: 1, activity: 'Faculty Arrival', frameNumber: 300 },
      { timestampSeconds: 40, timecode: '00:40', roomId: 'office', occupancy: 2, currentOccupancy: 2, detectionCount: 2, uniqueTrackedPeople: 2, confidence: 0.894, delta: 1, activity: 'Student Consultation', frameNumber: 1200 },
      { timestampSeconds: 75, timecode: '01:15', roomId: 'office', occupancy: 4, currentOccupancy: 4, detectionCount: 4, uniqueTrackedPeople: 4, confidence: 0.903, delta: 2, activity: 'Department Meeting', frameNumber: 2250 },
      { timestampSeconds: 110, timecode: '01:50', roomId: 'office', occupancy: 2, currentOccupancy: 2, detectionCount: 2, uniqueTrackedPeople: 4, confidence: 0.901, delta: -2, activity: 'Meeting Concluded', frameNumber: 3300 },
    ];
  } else {
    // Multi-zone floor surveillance footage (strictly chronological)
    rawTimeline = [
      { timestampSeconds: 10, timecode: '00:10', roomId: 'classroom', occupancy: 12, currentOccupancy: 12, detectionCount: 13, uniqueTrackedPeople: 12, confidence: 0.954, delta: 2, activity: 'Entering (+2)', frameNumber: 300 },
      { timestampSeconds: 15, timecode: '00:15', roomId: 'lab', occupancy: 5, currentOccupancy: 5, detectionCount: 5, uniqueTrackedPeople: 5, confidence: 0.912, delta: 1, activity: 'Active Research', frameNumber: 450 },
      { timestampSeconds: 20, timecode: '00:20', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.985, delta: 0, activity: 'Vacant (Lights ON)', frameNumber: 600 },
      { timestampSeconds: 30, timecode: '00:30', roomId: 'classroom', occupancy: 16, currentOccupancy: 16, detectionCount: 15, uniqueTrackedPeople: 16, confidence: 0.968, delta: 4, activity: 'Entering (+4)', frameNumber: 900 },
      { timestampSeconds: 40, timecode: '00:40', roomId: 'office', occupancy: 2, currentOccupancy: 2, detectionCount: 2, uniqueTrackedPeople: 2, confidence: 0.894, delta: 0, activity: 'Seated Desk Work', frameNumber: 1200 },
      { timestampSeconds: 45, timecode: '00:45', roomId: 'lab', occupancy: 9, currentOccupancy: 9, detectionCount: 10, uniqueTrackedPeople: 9, confidence: 0.928, delta: 4, activity: 'Entering (+4)', frameNumber: 1350 },
      { timestampSeconds: 60, timecode: '01:00', roomId: 'classroom', occupancy: 21, currentOccupancy: 21, detectionCount: 21, uniqueTrackedPeople: 21, confidence: 0.972, delta: 5, activity: 'Entering (+5)', frameNumber: 1800 },
      { timestampSeconds: 75, timecode: '01:15', roomId: 'lab', occupancy: 12, currentOccupancy: 12, detectionCount: 11, uniqueTrackedPeople: 12, confidence: 0.936, delta: 3, activity: 'Peak Lab Session', frameNumber: 2250 },
      { timestampSeconds: 80, timecode: '01:20', roomId: 'seminar_hall', occupancy: 0, currentOccupancy: 0, detectionCount: 0, uniqueTrackedPeople: 0, confidence: 0.988, delta: 0, activity: 'Vacant (Lights ON)', frameNumber: 2400 },
      { timestampSeconds: 90, timecode: '01:30', roomId: 'classroom', occupancy: 24, currentOccupancy: 24, detectionCount: 24, uniqueTrackedPeople: 24, confidence: 0.965, delta: 3, activity: 'Lecture In-Session (Peak)', frameNumber: 2700 },
      { timestampSeconds: 105, timecode: '01:45', roomId: 'lab', occupancy: 7, currentOccupancy: 7, detectionCount: 8, uniqueTrackedPeople: 12, confidence: 0.921, delta: -5, activity: 'Exiting (-5)', frameNumber: 3150 },
      { timestampSeconds: 110, timecode: '01:50', roomId: 'office', occupancy: 2, currentOccupancy: 2, detectionCount: 2, uniqueTrackedPeople: 3, confidence: 0.901, delta: 0, activity: 'Consultation', frameNumber: 3300 },
      { timestampSeconds: 115, timecode: '01:55', roomId: 'classroom', occupancy: 19, currentOccupancy: 19, detectionCount: 19, uniqueTrackedPeople: 24, confidence: 0.961, delta: -5, activity: 'Break Transition (-5)', frameNumber: 3450 },
    ];
  }

  // Strictly enforce chronological sorting by timestampSeconds
  const timeline = [...rawTimeline].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return {
    jobId: `cv-job-${Date.now().toString(36)}`,
    fileName: file.name,
    fileSizeBytes: file.size,
    durationSeconds: durationSec,
    fps: 30,
    totalFrames: 3600,
    status: 'completed',
    isDemo: true,
    processedAt: now,
    observations: observations as Record<any, VideoRoomObservation>,
    timeline,
    summary:
      targetRoomId === 'seminar_hall'
        ? 'Computer vision confirmed 0 occupants in Seminar Hall for the entire footage duration with 24 fixtures left active (100% idle waste).'
        : targetRoomId === 'classroom'
        ? 'YOLOv8 + ByteTrack detected regular class attendance starting with 8 arrivals, peaking at 24 occupants at 01:15, and exiting to 19.'
        : 'Computer vision detection completed across 4 monitored zones. Seminar Hall is flagged for 100% idle lighting waste (0 occupants observed with lighting ON).',
    warnings: [
      'DEMO DATA: Live CV backend not detected. Results simulated deterministically based on standard university benchmark scenario.',
      'Lighting state is manually supplied / simulated and was not derived from computer vision inference.',
    ],
  };
}
