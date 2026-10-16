// ============================================================
// Eprodux / EcoTwin – Video Upload & CV Pipeline Service Adapter
// Connects to CV/Twin backend when available, or executes a
// deterministic, transparent mock pipeline in Demo Mode.
// ============================================================

import type {
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
export async function uploadAndAnalyzeVideo(
  file: File,
  onProgress?: VideoUploadProgressCallback,
  signal?: AbortSignal,
): Promise<VideoAnalysisResult> {
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // If live mode is enabled, attempt real backend contract first
  if (!IS_DEMO) {
    try {
      return await submitVideoToBackend(file, onProgress, signal);
    } catch (backendErr: any) {
      if (signal?.aborted) throw new Error('Analysis cancelled by user.');
      console.warn('[videoService] Live backend video upload failed, falling back to demo mode:', backendErr);
      // Fall through to simulated pipeline with clear warning
    }
  }

  // Execute demo pipeline with realistic async progress steps
  return await simulateVideoAnalysis(file, onProgress, signal);
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
): Promise<VideoAnalysisResult> {
  onProgress?.(10, 'Connecting to CV pipeline endpoint...');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', 'user_upload');

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

  if (!jobId) {
    // If backend returns immediate result
    if (initialResponse.observations) {
      return initialResponse as VideoAnalysisResult;
    }
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
        ...jobData.result,
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
 * Extracts metadata, simulates YOLO frame detection across the 4 canonical rooms,
 * and yields grounded occupancy timelines.
 */
async function simulateVideoAnalysis(
  file: File,
  onProgress?: VideoUploadProgressCallback,
  signal?: AbortSignal,
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

  // Derive pseudo-realistic observations based on canonical rooms
  const now = new Date().toISOString();
  const durationSec = 120; // 2 minutes simulated footage

  const observations: Record<string, VideoRoomObservation> = {
    seminar_hall: {
      roomId: 'seminar_hall',
      roomName: 'Seminar Hall',
      peakOccupancy: 0,
      averageOccupancy: 0,
      currentOccupancy: 0,
      lightingState: 'ON',
      lightingProvenance: 'simulated',
      anomalies: ['Unoccupied room with lighting left active for > 2 hours'],
      confidence: 0.94,
      freshnessIso: now,
    },
    classroom: {
      roomId: 'classroom',
      roomName: 'Classroom',
      peakOccupancy: 24,
      averageOccupancy: 18,
      currentOccupancy: 19,
      lightingState: 'ON',
      lightingProvenance: 'simulated',
      anomalies: [],
      confidence: 0.96,
      freshnessIso: now,
    },
    lab: {
      roomId: 'lab',
      roomName: 'Laboratory',
      peakOccupancy: 12,
      averageOccupancy: 8,
      currentOccupancy: 6,
      lightingState: 'ON',
      lightingProvenance: 'manual',
      anomalies: [],
      confidence: 0.91,
      freshnessIso: now,
    },
    office: {
      roomId: 'office',
      roomName: 'Office',
      peakOccupancy: 4,
      averageOccupancy: 2,
      currentOccupancy: 2,
      lightingState: 'OFF',
      lightingProvenance: 'simulated',
      anomalies: [],
      confidence: 0.89,
      freshnessIso: now,
    },
  };

  const timeline: VideoAnalysisEvent[] = [
    { timestampSeconds: 10, timecode: '00:10', roomId: 'classroom', occupancy: 12, confidence: 0.95 },
    { timestampSeconds: 30, timecode: '00:30', roomId: 'classroom', occupancy: 21, confidence: 0.97 },
    { timestampSeconds: 60, timecode: '01:00', roomId: 'classroom', occupancy: 24, confidence: 0.96 },
    { timestampSeconds: 90, timecode: '01:30', roomId: 'classroom', occupancy: 19, confidence: 0.96 },
    { timestampSeconds: 15, timecode: '00:15', roomId: 'lab', occupancy: 5, confidence: 0.91 },
    { timestampSeconds: 45, timecode: '00:45', roomId: 'lab', occupancy: 12, confidence: 0.93 },
    { timestampSeconds: 75, timecode: '01:15', roomId: 'lab', occupancy: 8, confidence: 0.90 },
    { timestampSeconds: 105, timecode: '01:45', roomId: 'lab', occupancy: 6, confidence: 0.92 },
    { timestampSeconds: 20, timecode: '00:20', roomId: 'seminar_hall', occupancy: 0, confidence: 0.98 },
    { timestampSeconds: 80, timecode: '01:20', roomId: 'seminar_hall', occupancy: 0, confidence: 0.98 },
  ];

  return {
    jobId: `cv-demo-${Date.now().toString(36)}`,
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
      'Computer vision detection completed across 4 monitored zones. Seminar Hall is flagged for 100% idle lighting waste (0 occupants observed with lighting ON).',
    warnings: [
      'DEMO DATA: Live CV backend not detected. Results simulated deterministically based on standard university benchmark scenario.',
      'Lighting state is manually supplied / simulated and was not derived from computer vision inference.',
    ],
  };
}
