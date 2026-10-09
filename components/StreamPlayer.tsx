'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

/** Build a URL through the media proxy (adds the app UA/origin headers). */
export function toProxyUrl(url: string, referer?: string): string {
  if (!url) return '';
  if (!/^https?:\/\//.test(url)) return url;
  let p = `/api/media-proxy?url=${encodeURIComponent(url)}`;
  if (referer) p += `&referer=${encodeURIComponent(referer)}`;
  return p;
}

interface StreamPlayerProps {
  url: string;
  referer?: string;
  onError?: (data?: unknown) => void;
  onReady?: () => void;
}

export default function StreamPlayer({ url, referer, onError, onReady }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const src = toProxyUrl(url, referer);

  // Keep the latest callbacks in refs so the effect does not re-run every render.
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;
    setErr('');

    let hls: Hls | undefined;

    const handleVideoError = (): void => onErrorRef.current?.();
    const handlePlaying = (): void => onReadyRef.current?.();

    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setErr(`HLS error: ${data.type} / ${data.details}`);
          onErrorRef.current?.(data);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('error', handleVideoError);
    } else {
      setErr('Browser does not support HLS.');
      onErrorRef.current?.();
    }

    video.addEventListener('playing', handlePlaying);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleVideoError);
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <div className="player-wrap">
      <video ref={videoRef} className="player" controls autoPlay muted playsInline />
      {err && <pre className="error">{err}</pre>}
    </div>
  );
}
