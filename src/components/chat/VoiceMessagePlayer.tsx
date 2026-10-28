import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, Loader2, Download, AlertCircle, Mic } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  downloadUrl?: string;
  isMine: boolean;
  messageId: string;
}

// Global event bus so only one voice message plays at a time
const AUDIO_PLAY_EVENT = 'smartbuild:voice-play';

export function VoiceMessagePlayer({
  audioUrl,
  downloadUrl,
  isMine,
  messageId,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);

  // Generate deterministic bar heights based on messageId
  const waveformBars = useMemo(() => {
    const barsCount = 30;
    const heights: number[] = [];
    let hash = 0;
    for (let i = 0; i < messageId.length; i++) {
      hash = (hash << 5) - hash + messageId.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < barsCount; i++) {
      const pseudo = Math.abs(Math.sin((hash + i * 13) * 0.1));
      // Height between 20% and 95%
      const h = Math.round(20 + pseudo * 75);
      heights.push(h);
    }
    return heights;
  }, [messageId]);

  // Handle single-playback coordinator
  useEffect(() => {
    const handleOtherPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ playingId: string }>;
      if (customEvent.detail?.playingId !== messageId && isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };

    window.addEventListener(AUDIO_PLAY_EVENT, handleOtherPlay);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handleOtherPlay);
    };
  }, [messageId, isPlaying]);

  // Sync playback rate when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (
        (!duration || !Number.isFinite(duration)) &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      window.dispatchEvent(
        new CustomEvent(AUDIO_PLAY_EVENT, { detail: { playingId: messageId } })
      );
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audio) {
        audio.currentTime = 0;
      }
    };

    const onWaiting = () => {
      setIsLoading(true);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError('Unable to play audio');
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [messageId, duration]);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;
    setError(null);

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        setIsLoading(true);
        audioRef.current.playbackRate = playbackSpeed;
        await audioRef.current.play();
        setIsLoading(false);
      } catch (err) {
        console.error('[VoicePlayer] Playback failed:', err);
        setIsLoading(false);
        setIsPlaying(false);
        setError('Playback failed');
      }
    }
  }, [isPlaying, playbackSpeed]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      if (!audioRef.current) return;
      const targetDuration = duration || audioRef.current.duration;
      if (Number.isFinite(targetDuration) && targetDuration > 0) {
        const newTime = Math.max(0, Math.min(targetDuration * ratio, targetDuration));
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    [duration]
  );

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(x / rect.width, 1));
    seekToRatio(ratio);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaybackSpeed((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  const formatSeconds = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="py-1">
      {/* Hidden native audio tag */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        playsInline
      />

      <div className="flex items-center gap-3 select-none">
        {/* Left Play / Pause Button with Mic Badge */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoading && !isPlaying}
            aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              isMine
                ? 'bg-amber-400 text-navy-900 hover:bg-amber-300 focus:ring-amber-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-400'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current translate-x-0.5" />
            )}
          </button>

          {/* WhatsApp Style Microphone Indicator Badge */}
          <div
            className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ${
              isMine
                ? 'bg-navy-800 text-amber-300 ring-navy-600'
                : 'bg-emerald-100 text-emerald-700 ring-white'
            }`}
            title="Voice message"
          >
            <Mic className="h-2.5 w-2.5" />
          </div>
        </div>

        {/* Right side: Waveform track + time & speed indicators */}
        <div className="flex-1 min-w-[170px] sm:min-w-[210px] space-y-1.5">
          {/* Interactive Waveform */}
          <div
            onClick={handleWaveformClick}
            className="group relative flex h-7 items-center gap-[2.5px] cursor-pointer py-1"
            title="Click to seek"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                seekToRatio(Math.min(1, (currentTime + 2) / (duration || 1)));
              } else if (e.key === 'ArrowLeft') {
                seekToRatio(Math.max(0, (currentTime - 2) / (duration || 1)));
              } else if (e.key === ' ') {
                e.preventDefault();
                togglePlay();
              }
            }}
          >
            {waveformBars.map((height, idx) => {
              const barProgress = (idx / (waveformBars.length - 1)) * 100;
              const isPlayed = barProgress <= progressPercent;

              return (
                <div
                  key={idx}
                  className={`w-[3px] rounded-full transition-all duration-150 ${
                    isMine
                      ? isPlayed
                        ? 'bg-amber-300'
                        : 'bg-navy-400/60 group-hover:bg-navy-400'
                      : isPlayed
                        ? 'bg-emerald-600'
                        : 'bg-gray-300 group-hover:bg-gray-400'
                  }`}
                  style={{
                    height: `${height}%`,
                  }}
                />
              );
            })}
          </div>

          {/* Bottom row: Time elapsed/duration + Speed pill & optional download */}
          <div
            className={`flex items-center justify-between text-[11px] font-medium leading-none ${
              isMine ? 'text-navy-200' : 'text-gray-500'
            }`}
          >
            <span>
              {isPlaying
                ? formatSeconds(currentTime)
                : formatSeconds(duration || currentTime)}
            </span>

            <div className="flex items-center gap-1.5">
              {/* WhatsApp-style Playback Speed Pill */}
              <button
                type="button"
                onClick={cycleSpeed}
                title="Change playback speed"
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight transition-colors ${
                  isMine
                    ? playbackSpeed !== 1
                      ? 'bg-amber-400 text-navy-900 font-extrabold'
                      : 'bg-navy-500/80 text-navy-100 hover:bg-navy-500'
                    : playbackSpeed !== 1
                      ? 'bg-emerald-600 text-white font-extrabold'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {playbackSpeed}x
              </button>

              {/* Download button */}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download="voice-message.webm"
                  onClick={(e) => e.stopPropagation()}
                  title="Download voice note"
                  className={`rounded p-0.5 transition-colors ${
                    isMine
                      ? 'hover:text-white'
                      : 'hover:text-navy-800'
                  }`}
                >
                  <Download className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-red-300">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="underline ml-1 font-semibold text-white"
            >
              Download
            </a>
          )}
        </div>
      )}
    </div>
  );
}
