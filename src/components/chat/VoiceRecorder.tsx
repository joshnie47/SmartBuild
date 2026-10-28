import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Trash2,
  Square,
  Play,
  Pause,
  Send,
  Loader2,
} from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';

interface VoiceRecorderProps {
  onSendVoice: (file: File, durationSec: number) => void;
  onError?: (error: string) => void;
  onModeChange?: (mode: 'idle' | 'recording' | 'preview') => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  onSendVoice,
  onError,
  onModeChange,
  disabled = false,
}: VoiceRecorderProps) {
  const { t } = useLocale();

  const [mode, setModeState] = useState<'idle' | 'recording' | 'preview'>('idle');

  const setMode = useCallback(
    (newMode: 'idle' | 'recording' | 'preview') => {
      setModeState(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([30, 45, 60, 40, 75, 50, 35, 65, 80, 50]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordSecondsRef = useRef(0);
  const mimeTypeConfigRef = useRef<{ mimeType: string; ext: string }>({
    mimeType: 'audio/webm',
    ext: 'webm',
  });

  // Pick supported MIME type for browser
  const getSupportedConfig = useCallback((): { mimeType: string; ext: string } => {
    if (typeof MediaRecorder === 'undefined') {
      return { mimeType: 'audio/webm', ext: 'webm' };
    }
    const candidates = [
      { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
      { mimeType: 'audio/webm', ext: 'webm' },
      { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mimeType: 'audio/mp4', ext: 'mp4' },
      { mimeType: 'audio/aac', ext: 'aac' },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    }
    return { mimeType: '', ext: 'webm' };
  }, []);

  // Cleanup helper
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Cleanup preview audio
  const cleanupPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setPreviewPlaying(false);
    setPreviewCurrentTime(0);
  }, [audioUrl]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [cleanupStream, audioUrl]);

  // Start live audio visualizer
  const startVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 12 frequencies
        const levels: number[] = [];
        const step = Math.max(1, Math.floor(bufferLength / 12));
        for (let i = 0; i < 12; i++) {
          const val = dataArray[i * step] || 0;
          // Scale 15% to 100%
          levels.push(Math.max(15, Math.min(100, Math.round((val / 255) * 100))));
        }
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    } catch (e) {
      console.warn('[VoiceRecorder] Audio visualizer setup failed, using fallback animation:', e);
    }
  };

  // Start Recording
  const startRecording = async () => {
    if (disabled) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError?.(t('micAccessDenied') || 'Microphone access is not supported in this browser.');
      return;
    }

    cleanupPreview();
    cleanupStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const config = getSupportedConfig();
      mimeTypeConfigRef.current = config;

      const recorderOptions: MediaRecorderOptions = {};
      if (config.mimeType) {
        recorderOptions.mimeType = config.mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = mimeTypeConfigRef.current.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(100); // 100ms timeslices for smooth chunking
      setMode('recording');
      setRecordSeconds(0);
      recordSecondsRef.current = 0;

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          recordSecondsRef.current = next;
          return next;
        });
      }, 1000);

      // Start visualizer
      startVisualizer(stream);
    } catch (err: unknown) {
      console.error('[VoiceRecorder] getUserMedia error:', err);
      cleanupStream();
      setMode('idle');
      const errorMsg =
        err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ? t('micAccessDenied') || 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Unable to start microphone recording.';
      onError?.(errorMsg);
    }
  };

  // Cancel / Discard Recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupStream();
    cleanupPreview();
    setMode('idle');
    setRecordSeconds(0);
  };

  // Stop Recording and go to Preview
  const stopAndPreview = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    setMode('preview');
  };

  // Immediate send from recording or preview
  const handleSend = () => {
    const duration = recordSecondsRef.current || recordSeconds;

    if (mode === 'recording') {
      // If still recording, stop and generate file on stop
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const rec = mediaRecorderRef.current;
        rec.onstop = () => {
          const finalMime = mimeTypeConfigRef.current.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: finalMime });
          const ext = mimeTypeConfigRef.current.ext || 'webm';
          const file = new File([blob], `voice-message-${Date.now()}.${ext}`, {
            type: finalMime,
          });
          cleanupStream();
          cleanupPreview();
          setMode('idle');
          setRecordSeconds(0);
          onSendVoice(file, duration);
        };
        try {
          rec.stop();
        } catch {}
      }
      return;
    }

    if (mode === 'preview' && audioBlob) {
      const finalMime = mimeTypeConfigRef.current.mimeType || audioBlob.type || 'audio/webm';
      const ext = mimeTypeConfigRef.current.ext || 'webm';
      const file = new File([audioBlob], `voice-message-${Date.now()}.${ext}`, {
        type: finalMime,
      });
      cleanupStream();
      cleanupPreview();
      setMode('idle');
      setRecordSeconds(0);
      onSendVoice(file, duration);
    }
  };

  // Preview Audio Controller
  const togglePreviewPlay = () => {
    if (!audioUrl) return;

    if (!previewAudioRef.current) {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;

      audio.ontimeupdate = () => {
        setPreviewCurrentTime(audio.currentTime);
      };
      audio.onended = () => {
        setPreviewPlaying(false);
        setPreviewCurrentTime(0);
      };
      audio.onerror = () => {
        setPreviewPlaying(false);
      };
    }

    if (previewPlaying) {
      previewAudioRef.current.pause();
      setPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setPreviewPlaying(true);
      }).catch(() => {
        setPreviewPlaying(false);
      });
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Render Idle Mode: Microphone Button ────────────────────────────────────
  if (mode === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        title={t('recordVoice') || 'Record voice message'}
        aria-label={t('recordVoice') || 'Record voice message'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-500 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
      >
        <Mic className="h-5 w-5" />
      </button>
    );
  }

  // ── Render Live Recording Mode (WhatsApp recording bar) ────────────────────
  if (mode === 'recording') {
    return (
      <div className="flex flex-1 items-center gap-2 sm:gap-3 rounded-xl bg-gray-900/90 px-3 py-2 text-white shadow-lg backdrop-blur-xs animate-fade-in ring-1 ring-white/10">
        {/* Pulsing Red Recording Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-xs sm:text-sm font-semibold tracking-wide text-red-400">
            {formatSeconds(recordSeconds)}
          </span>
        </div>

        {/* Live sound wave frequency bars */}
        <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden px-1 sm:px-2 h-7">
          {audioLevels.map((lvl, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
              style={{
                height: `${lvl}%`,
                minHeight: '4px',
              }}
            />
          ))}
        </div>

        {/* Actions: Cancel (Trash) */}
        <button
          type="button"
          onClick={cancelRecording}
          title={t('cancelRecording') || 'Discard recording'}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Pause/Stop to Preview button */}
        <button
          type="button"
          onClick={stopAndPreview}
          title={t('stopRecording') || 'Stop and preview'}
          className="rounded-full p-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>

        {/* Direct Send button */}
        <button
          type="button"
          onClick={handleSend}
          title={t('sendVoiceMessage') || 'Send voice message'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-md active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Render Preview Mode ───────────────────────────────────────────────────
  return (
    <div className="flex flex-1 items-center gap-2 sm:gap-3 rounded-xl bg-gray-900/90 px-3 py-2 text-white shadow-lg backdrop-blur-xs animate-fade-in ring-1 ring-white/10">
      {/* Play / Pause Preview */}
      <button
        type="button"
        onClick={togglePreviewPlay}
        title={previewPlaying ? 'Pause preview' : 'Play preview'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-all"
      >
        {previewPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current translate-x-0.5" />
        )}
      </button>

      {/* Progress & Duration */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs font-mono text-gray-300 mb-1">
          <span>{formatSeconds(previewCurrentTime)}</span>
          <span className="text-gray-400">{formatSeconds(recordSeconds)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-emerald-400 transition-all duration-100"
            style={{
              width: `${recordSeconds > 0 ? (previewCurrentTime / recordSeconds) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Discard / Trash */}
      <button
        type="button"
        onClick={cancelRecording}
        title={t('cancelRecording') || 'Discard recording'}
        className="rounded-full p-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Send Voice Message */}
      <button
        type="button"
        onClick={handleSend}
        title={t('sendVoiceMessage') || 'Send voice message'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-md active:scale-95"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
