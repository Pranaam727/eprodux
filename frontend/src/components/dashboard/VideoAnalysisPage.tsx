// ============================================================
// VideoAnalysisPage.tsx — Computer Vision Video Inference Hub
// Video Upload, Preview, Inference Status, Room Detections & Event Log
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoAnalysisResult, VideoAnalysisStatus, RoomId } from '../../types';
import {
  validateVideoFile,
  createVideoPreviewUrl,
  revokeVideoPreviewUrl,
  uploadAndAnalyzeVideo,
  SUPPORTED_EXTENSIONS,
} from '../../services/videoService';
import { VideoPreview } from '../VideoPreview';

interface Props {
  latestResult: VideoAnalysisResult | null;
  onAnalysisSuccess: (result: VideoAnalysisResult) => void;
  onInspectIn3D: (roomId: RoomId) => void;
}

export function VideoAnalysisPage({ latestResult, onAnalysisSuccess, onInspectIn3D }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoAnalysisStatus>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState<RoomId | 'all'>('all');
  const [filterRoomId, setFilterRoomId] = useState<RoomId | 'all'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanupPreview = useCallback(() => {
    if (previewUrl) {
      revokeVideoPreviewUrl(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      cleanupPreview();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupPreview]);

  const handleFileSelect = (selectedFile: File) => {
    setErrorMessage(null);
    const validation = validateVideoFile(selectedFile);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid video file.');
      return;
    }

    // Auto-detect room from filename if matching
    const nameLower = selectedFile.name.toLowerCase();
    if (nameLower.includes('classroom')) setTargetRoomId('classroom');
    else if (nameLower.includes('seminar')) setTargetRoomId('seminar_hall');
    else if (nameLower.includes('lab')) setTargetRoomId('lab');
    else if (nameLower.includes('office')) setTargetRoomId('office');

    cleanupPreview();
    const url = createVideoPreviewUrl(selectedFile);
    setFile(selectedFile);
    setPreviewUrl(url);
    setStatus('selected');
    setProgressPct(0);
    setStatusMessage('');
  };

  const handleStartAnalysis = async () => {
    if (!file) return;

    setStatus('uploading');
    setProgressPct(5);
    setStatusMessage('Connecting to Python CV pipeline...');
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await uploadAndAnalyzeVideo(
        file,
        (pct, msg) => {
          setProgressPct(pct);
          setStatusMessage(msg);
          if (pct >= 50 && pct < 100) {
            setStatus('processing');
          }
        },
        controller.signal,
        targetRoomId,
      );

      setStatus('completed');
      setProgressPct(100);
      onAnalysisSuccess(result);
    } catch (err: any) {
      if (err.message && err.message.includes('cancelled')) {
        setStatus('cancelled');
        setStatusMessage('Analysis cancelled by user.');
      } else {
        setStatus('failed');
        setErrorMessage(err.message || 'Video analysis encountered an error.');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const isWorking = status === 'uploading' || status === 'processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── HEADER INTRO ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Computer Vision Video Analysis</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Ingest university footage to detect zone occupancy, evaluate vacancy, and correlate with digital twin states.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge--green">YOLOv8 + ByteTrack</span>
          <span className="badge badge--blue">Zero Face Storage</span>
        </div>
      </div>

      {/* ── UPLOAD & PREVIEW GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 1.2fr', gap: 20 }}>
        {/* Upload Box */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            STEP 1: SELECT FOOTAGE FILE
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--alert-critical-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--alert-critical)',
                fontSize: '0.74rem',
                marginBottom: 12,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <div
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (!isWorking && e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isWorking) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !isWorking && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'rgba(168, 180, 204, 0.4)'}`,
              borderRadius: 'var(--radius-lg)',
              background: isDragOver ? 'rgba(163, 217, 0, 0.08)' : 'var(--color-card)',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              marginBottom: 16,
              transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_EXTENSIONS.join(',')}
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
            <div style={{ fontSize: '2.4rem', marginBottom: 8, color: 'var(--color-accent)', filter: 'drop-shadow(0 0 12px rgba(0, 184, 217, 0.4))' }}>
              📹
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4, color: 'var(--color-text)' }}>
              {file ? file.name : 'Drag & drop campus video file'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'or click to browse local files'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              Supports MP4, MOV, AVI · Max 150 MB
            </div>
          </div>

          {/* Target Monitored Zone Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Target Monitored Zone:
            </label>
            <select
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value as any)}
              disabled={isWorking}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: '0.80rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">Floor 3 Multi-Zone Stream (All 4 Monitored Zones)</option>
              <option value="classroom">📚 Classroom (Room 302)</option>
              <option value="seminar_hall">🎭 Seminar Hall (Room 301)</option>
              <option value="lab">🔬 Laboratory (Room 303)</option>
              <option value="office">💼 Faculty Office (Room 304)</option>
            </select>
          </div>

          {/* Progress Indicator */}
          {isWorking && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                  {status === 'uploading' ? 'Uploading to processing queue...' : 'Processing YOLOv8 inference...'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{progressPct}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-surface)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                {statusMessage}
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
            {file && (
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isWorking}
                className="btn btn--primary w-full"
                style={{ justifyContent: 'center' }}
              >
                {isWorking ? 'Processing Frames...' : '🚀 Analyze Video'}
              </button>
            )}
            {file && (
              <button
                type="button"
                onClick={() => {
                  cleanupPreview();
                  setFile(null);
                  setStatus('idle');
                }}
                disabled={isWorking}
                className="btn btn--secondary"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Video Player Preview Box */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            STEP 2: FOOTAGE PREVIEW
          </div>

          {previewUrl && file ? (
            <VideoPreview
              previewUrl={previewUrl}
              fileName={file.name}
              fileSizeBytes={file.size}
              onReplace={() => fileInputRef.current?.click()}
              onRemove={() => {
                cleanupPreview();
                setFile(null);
                setStatus('idle');
              }}
              disabled={isWorking}
            />
          ) : (
            <div
              style={{
                height: 280,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-card)',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎬</div>
              <div style={{ fontSize: '0.85rem' }}>No video loaded for playback</div>
              <div style={{ fontSize: '0.72rem', marginTop: 4 }}>
                Select a video file on the left to preview here
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ANALYSIS FINDINGS BREAKDOWN (If Available) ── */}
      {latestResult && (
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge badge--green">✓ ANALYSIS COMPLETED</span>
              {latestResult.isDemo && <span className="badge badge--demo">⚗️ DEMO DATA</span>}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Job: {latestResult.jobId} · Processed {latestResult.totalFrames} frames @ {latestResult.fps} FPS
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Analyzed: {latestResult.fileName}
            </span>
          </div>

          {/* Synthesis Banner */}
          <div
            style={{
              padding: 12,
              background: 'rgba(34, 197, 94, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-accent)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            <strong style={{ color: 'var(--accent-green)' }}>CV Pipeline Output: </strong>
            {latestResult.summary}
          </div>

          {/* 4 Rooms Occupancy Summary */}
          <div className="section-title" style={{ marginBottom: 12 }}>
            ZONE OCCUPANCY FINDINGS
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            {Object.values(latestResult.observations).map((obs) => (
              <div
                key={obs.roomId}
                className="card card--compact"
                style={{
                  background: 'var(--bg-surface)',
                  border: obs.anomalies.length > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{obs.roomName}</span>
                  <span className="badge badge--green">{Math.round(obs.confidence * 100)}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0' }}>
                  <div>
                    <span className="text-xs text-muted">CURRENT</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{obs.currentOccupancy ?? 'UNKNOWN'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted">PEAK</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{obs.peakOccupancy}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted">AVERAGE</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{obs.averageOccupancy}</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Lighting: <strong>{obs.lightingState}</strong> (source: {obs.lightingProvenance})
                </div>

                <button
                  type="button"
                  onClick={() => onInspectIn3D(obs.roomId)}
                  className="btn btn--secondary btn--sm w-full"
                  style={{ justifyContent: 'center' }}
                >
                  🔍 View in 3D Digital Twin
                </button>
              </div>
            ))}
          </div>

          {/* Timeline Events Log */}
          {(() => {
            const filteredTimeline = (latestResult.timeline || [])
              .filter((evt) => filterRoomId === 'all' || evt.roomId === filterRoomId)
              .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

            const roomCounts: Record<string, number> = {
              all: latestResult.timeline.length,
              classroom: latestResult.timeline.filter((e) => e.roomId === 'classroom').length,
              seminar_hall: latestResult.timeline.filter((e) => e.roomId === 'seminar_hall').length,
              lab: latestResult.timeline.filter((e) => e.roomId === 'lab').length,
              office: latestResult.timeline.filter((e) => e.roomId === 'office').length,
            };

            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="section-title" style={{ marginBottom: 2 }}>
                      CHRONOLOGICAL CV DETECTION EVENTS ({filteredTimeline.length})
                    </div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                      Strictly sequenced chronologically with frame-by-frame tracking & confidence scores
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['all', 'classroom', 'seminar_hall', 'lab', 'office'] as const).map((r) => {
                      const count = roomCounts[r] || 0;
                      const label = r === 'all' ? 'All Zones' : r === 'classroom' ? 'Classroom' : r === 'seminar_hall' ? 'Seminar' : r === 'lab' ? 'Lab' : 'Office';
                      const isActive = filterRoomId === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setFilterRoomId(r)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.70rem',
                            fontWeight: isActive ? 700 : 500,
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: isActive ? 'var(--color-card-elevated)' : 'transparent',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: 260,
                    overflowY: 'auto',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left', position: 'sticky', top: 0, background: 'var(--color-card-elevated)', zIndex: 10 }}>
                        <th style={{ padding: '8px 12px' }}>TIMECODE</th>
                        <th style={{ padding: '8px 12px' }}>ZONE ID</th>
                        <th style={{ padding: '8px 12px' }}>DETECTED OCCUPANCY</th>
                        <th style={{ padding: '8px 12px' }}>TRACKING / ACTIVITY</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>CONFIDENCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTimeline.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No detection events found for this filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredTimeline.map((evt, idx) => {
                          const icon =
                            evt.roomId === 'classroom'
                              ? '📚'
                              : evt.roomId === 'seminar_hall'
                              ? '🎭'
                              : evt.roomId === 'lab'
                              ? '🔬'
                              : '💼';
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{evt.timecode}</span>
                                {evt.frameNumber && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                                    (F#{evt.frameNumber})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>
                                <span style={{ marginRight: 6 }}>{icon}</span>
                                {evt.roomId.replace('_', ' ')}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                <span style={{ color: evt.occupancy === 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                                  {evt.occupancy} {evt.occupancy === 1 ? 'occupant' : 'occupants'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                                {evt.activity || 'Tracked Object'}
                              </td>
                              <td
                                style={{
                                  padding: '8px 12px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: evt.confidence >= 0.95 ? 'var(--color-primary)' : 'var(--color-accent)',
                                }}
                              >
                                {(evt.confidence * 100).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
