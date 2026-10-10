'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface VideoPlayerProps {
  /** Stream URL — HLS (.m3u8) or any standard HTML5 source (MP4/WebM). */
  streamUrl: string;
  /** Poster image shown before playback starts. */
  posterThumbnail?: string;
  /** Optional referer header — forwarded through the media proxy. */
  referer?: string;
  /** Autoplay on mount. Requires `muted` for browser autoplay policies. */
  autoPlay?: boolean;
  /** Muted playback. Defaults to `autoPlay` so autoplay actually works. */
  muted?: boolean;
  /** Show native browser controls. */
  controls?: boolean;
  /** Fired when the video is paused. */
  onPause?: () => void;
  /** Fired when the video starts/resumes playing. */
  onPlay?: () => void;
  /** Fired when the video ends. */
  onEnded?: () => void;
  /** Fired on fatal playback errors (HLS failure, unsupported browser, ...). */
  onError?: (message: string) => void;
  className?: string;
  /** Accessible label for the <video> element. */
  title?: string;
}

/**
 * Lightweight video player built on native Hls.js (no Plyr) so the bundle stays
 * small on Vercel. Detects HLS by the `.m3u8` URL and falls back to the native
 * HTML5 player for other formats (or Safari's built-in HLS support).
 */
export default function VideoPlayer({
  streamUrl,
  posterThumbnail,
  referer,
  autoPlay = true,
  muted = true,
  controls = true,
  onPause,
  onPlay,
  onEnded,
  onError,
  className,
  title,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  // Keep the latest callbacks in refs so the media effect does not re-run on
  // every render (same pattern as the existing StreamPlayer).
  const onPauseRef = useRef(onPause);
  const onPlayRef = useRef(onPlay);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return undefined;
    setError('');

    const emitError = (message: string): void => {
      setError(message);
      onErrorRef.current?.(message);
    };

    let hls: Hls | undefined;
    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    // Route http(s) streams through the media proxy so the app UA/origin/referer
    // headers are attached (required by the upstream CDN).
    const src = /^https?:\/\//i.test(streamUrl)
      ? `/api/media-proxy?url=${encodeURIComponent(streamUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`
      : streamUrl;

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            emitError(`HLS error: ${data.type} / ${data.details}`);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari/WebKit — native HLS, no hls.js needed.
        video.src = src;
      } else {
        emitError('Browser does not support HLS playback.');
      }
    } else {
      // Standard HTML5 source (MP4/WebM, ...).
      video.src = src;
    }

    const handlePause = (): void => onPauseRef.current?.();
    const handlePlay = (): void => onPlayRef.current?.();
    const handleEnded = (): void => onEndedRef.current?.();
    const handleError = (): void => emitError('Video playback error.');
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    if (autoPlay) {
      // Autoplay policies require muted; if it's still blocked, the user can
      // press play via the native controls.
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      if (hls) hls.destroy();
    };
  }, [streamUrl, referer, autoPlay]);

  return (
    <div
      className={`relative aspect-[16/9] bg-panel border border-border rounded-[var(--radius)] ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-bg"
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="metadata"
        poster={posterThumbnail || undefined}
        title={title}
        aria-label={title || 'Video player'}
      />
      {error && (
        <p
          className="absolute inset-x-3 bottom-3 m-0 whitespace-pre-wrap break-words rounded-lg bg-[rgba(0,0,0,0.6)] px-3 py-2.5 text-[13px] text-[#fca5a5]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
