// ============================================================
// VideoPreview.tsx – HTML5 Browser Video Preview Component
// Features custom playback, mute, seek controls, and resource cleanup.
// ============================================================

import React, { useState, useRef, useEffect } from 'react';

interface Props {
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  onReplace?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function VideoPreview({
  previewUrl,
  fileName,
  fileSizeBytes,
  onReplace,
  onRemove,
  disabled = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [previewUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.warn('Playback error:', e);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-card)',
        overflow: 'hidden',
      }}
    >
      {/* Video Container */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
        <video
          ref={videoRef}
          src={previewUrl}
          muted={isMuted}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Overlay Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          disabled={disabled}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: isPlaying ? 'rgba(0,0,0,0.4)' : 'rgba(34,197,94,0.85)',
            border: 'none',
            borderRadius: '50%',
            width: 54,
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            color: '#fff',
            cursor: 'pointer',
            opacity: isPlaying ? 0.3 : 1,
            transition: 'opacity 0.2s ease, background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = isPlaying ? '0.3' : '1'; }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Video Controls & Scrub Bar */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
        {/* Timeline Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={disabled}
            style={{ flex: 1, cursor: 'pointer' }}
            aria-label="Video scrubber"
          />
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls & Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={togglePlay}
              disabled={disabled}
              className="btn btn--secondary btn--sm"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              disabled={disabled}
              className="btn btn--secondary btn--sm"
            >
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 4 }}>
              <strong>{fileName}</strong> ({sizeMb} MB)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {onReplace && (
              <button
                type="button"
                onClick={onReplace}
                disabled={disabled}
                className="btn btn--secondary btn--sm"
              >
                🔄 Replace
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="btn btn--danger btn--sm"
              >
                ✕ Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
