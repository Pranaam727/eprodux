// ============================================================
// VideoUploadModal.tsx — Video Upload & CV Pipeline Modal
// Supports Drag & Drop, HTML5 Video Preview, Async Processing,
// and Privacy-Respecting Lifecycle Management.
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoAnalysisResult, VideoAnalysisStatus } from '../types';
import {
  validateVideoFile,
  createVideoPreviewUrl,
  revokeVideoPreviewUrl,
  uploadAndAnalyzeVideo,
  SUPPORTED_EXTENSIONS,
} from '../services/videoService';
import { VideoPreview } from './VideoPreview';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (result: VideoAnalysisResult) => void;
}

export function VideoUploadModal({ isOpen, onClose, onAnalysisComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoAnalysisStatus>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up object URLs on unmount or reset
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

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setErrorMessage(null);
    const validation = validateVideoFile(selectedFile);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid video file.');
      return;
    }

    cleanupPreview();
    const url = createVideoPreviewUrl(selectedFile);
    setFile(selectedFile);
    setPreviewUrl(url);
    setStatus('selected');
    setProgressPct(0);
    setStatusMessage('');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status === 'uploading' || status === 'processing') return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (status !== 'uploading' && status !== 'processing') {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemove = () => {
    if (status === 'uploading' || status === 'processing') {
      handleCancel();
    }
    cleanupPreview();
    setFile(null);
    setStatus('idle');
    setErrorMessage(null);
    setProgressPct(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('cancelled');
    setStatusMessage('Analysis was cancelled.');
  };

  const handleStartAnalysis = async () => {
    if (!file) return;

    setStatus('uploading');
    setProgressPct(5);
    setStatusMessage('Initializing analysis pipeline...');
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
      );

      setStatus('completed');
      setProgressPct(100);
      onAnalysisComplete(result);
      onClose();
    } catch (err: any) {
      if (err.message && err.message.includes('cancelled')) {
        setStatus('cancelled');
        setStatusMessage('Analysis cancelled by user.');
      } else {
        setStatus('failed');
        setErrorMessage(err.message || 'Video analysis encountered an unexpected error.');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const isWorking = status === 'uploading' || status === 'processing';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          boxShadow: 'var(--shadow-popup)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-green-bg)',
                border: '1px solid var(--border-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}
            >
              📹
            </div>
            <div>
              <h2 id="upload-modal-title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                Upload University Footage
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Analyze occupancy and energy correlation with YOLOv8 & ByteTrack
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isWorking}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--alert-critical-bg)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--alert-critical)',
              fontSize: '0.78rem',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dropzone or Preview */}
        {!file || !previewUrl ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--accent-green)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 'var(--radius-lg)',
              background: isDragOver ? 'var(--accent-green-bg)' : 'rgba(17, 24, 39, 0.6)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: 16,
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
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>
              Drag & Drop your room video here
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              or click to browse your local filesystem
            </div>
            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span className="badge badge--gray">MP4</span>
              <span className="badge badge--gray">MOV</span>
              <span className="badge badge--gray">AVI</span>
              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                Up to 150 MB
              </span>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <VideoPreview
              previewUrl={previewUrl}
              fileName={file.name}
              fileSizeBytes={file.size}
              onReplace={() => fileInputRef.current?.click()}
              onRemove={handleRemove}
              disabled={isWorking}
            />
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
          </div>
        )}

        {/* Progress Bar & Status indicator */}
        {isWorking && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                {status === 'uploading' ? '📤 Uploading...' : '🧠 Analyzing Occupancy...'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {progressPct}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 8,
                background: 'var(--bg-surface)',
                borderRadius: 4,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            {statusMessage && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                {statusMessage}
              </div>
            )}
          </div>
        )}

        {/* Privacy Note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🔒</span>
          <div>
            <strong>Strict Privacy Pipeline:</strong> Recorded video supported · No face recognition · No raw frames stored by EcoTwin's CV pipeline. Only numerical headcounts are emitted.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={isWorking ? handleCancel : onClose}
            className="btn btn--secondary"
          >
            {isWorking ? 'Cancel Analysis' : 'Close'}
          </button>

          {file && (
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isWorking}
              className="btn btn--primary"
            >
              {isWorking ? (
                <>
                  <span className="status-dot status-dot--pulse status-dot--on" />
                  Processing...
                </>
              ) : (
                '🚀 Analyze Video'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
