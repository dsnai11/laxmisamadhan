import React, { useState, useRef, useEffect } from 'react';
import {
  MicrophoneIcon,
  SpeakerWaveIcon,
  StopIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import api from '@services/api';

// Check Web Speech API availability
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    (window as any).mozSpeechRecognition ||
    (window as any).msSpeechRecognition;
  return SpeechRecognition ? new SpeechRecognition() : null;
};

// Check MediaRecorder mime types
const getSupportedAudioMimeType = (): { mimeType: string; ext: string } => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', ext: 'webm' };
  }
  const types = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'mp4' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mime: 'audio/ogg', ext: 'ogg' },
    { mime: 'audio/wav', ext: 'wav' },
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t.mime)) {
      return { mimeType: t.mime, ext: t.ext };
    }
  }
  return { mimeType: 'audio/webm', ext: 'webm' };
};

// ==========================================
// 1. Voice Typing & Read Aloud Controls
// ==========================================
interface VoiceTypingControlProps {
  value: string;
  onChange: (newValue: string) => void;
  disabled?: boolean;
}

export function VoiceTypingControl({ value, onChange, disabled }: VoiceTypingControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lang, setLang] = useState<'en-IN' | 'hi-IN' | 'en-US'>('en-IN');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Initialize Speech Recognition
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = () => {
    if (disabled) return;
    const recognition = getSpeechRecognition();
    if (!recognition) {
      toast.error('Voice typing is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Stop text-to-speech if running
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            currentInterim += transcript;
          }
        }

        setInterimTranscript(currentInterim);

        if (finalChunk.trim()) {
          const prev = value ? value.trimEnd() + ' ' : '';
          onChange(prev + finalChunk.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access in your browser settings.');
          stopListening();
        } else if (event.error === 'no-speech') {
          // Handled quietly
        } else {
          toast.error(`Voice recognition error: ${event.error}`);
          stopListening();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      toast.error('Could not activate speech recognition.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Text-To-Speech (Read Aloud)
  const toggleSpeaking = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToRead = value.trim();
    if (!textToRead) {
      toast('Nothing to read aloud. Please type or speak some description first.', { icon: 'ℹ️' });
      return;
    }

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = lang;
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          💡 Voice typing & speech assistance
        </span>
        <div className="flex items-center gap-1.5">
          {/* Language selection */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            disabled={isListening || disabled}
            aria-label="Dictation Language"
            className="text-[11px] py-1 px-2 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (हिंदी)</option>
            <option value="en-US">English (US)</option>
          </select>

          {/* Voice Typing (STT) Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-2xs ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-2 ring-rose-400/50'
                : 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/80 border border-primary-200/80 dark:border-primary-800'
            }`}
            title={
              isSupported
                ? isListening
                  ? 'Click to stop dictation'
                  : 'Click to speak and type automatically'
                : 'Speech recognition requires Chrome, Edge or Safari'
            }
          >
            {isListening ? (
              <>
                <StopIcon className="w-3.5 h-3.5" />
                <span>Stop Typing</span>
              </>
            ) : (
              <>
                <MicrophoneIcon className="w-3.5 h-3.5" />
                <span>Voice Type</span>
              </>
            )}
          </button>

          {/* Text-to-Speech (TTS) Read Aloud Button */}
          <button
            type="button"
            onClick={toggleSpeaking}
            disabled={disabled || !value.trim()}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-2xs ${
              isSpeaking
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isSpeaking ? 'Stop reading aloud' : 'Listen to current description'}
          >
            {isSpeaking ? (
              <>
                <StopIcon className="w-3.5 h-3.5" />
                <span>Stop Voice</span>
              </>
            ) : (
              <>
                <SpeakerWaveIcon className="w-3.5 h-3.5" />
                <span>Listen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Listening Banner */}
      {isListening && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="font-semibold shrink-0">Listening...</span>
            <span className="truncate italic opacity-90">
              {interimTranscript || 'Speak into your microphone now'}
            </span>
          </div>
          <button
            type="button"
            onClick={stopListening}
            className="text-[11px] underline font-bold shrink-0 hover:text-rose-950 dark:hover:text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. Voice Message Recorder (Attach Audio File)
// ==========================================
interface VoiceMessageRecorderProps {
  onAudioReady: (file: File) => void;
  onAudioRemoved?: (fileName: string) => void;
  attachedVoiceFiles?: File[];
  disabled?: boolean;
}

export function VoiceMessageRecorder({
  onAudioReady,
  onAudioRemoved,
  attachedVoiceFiles = [],
  disabled,
}: VoiceMessageRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<{ mimeType: string; ext: string }>({
    mimeType: 'audio/webm',
    ext: 'webm',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    if (disabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const format = getSupportedAudioMimeType();
      setSelectedFormat(format);

      const recorder = new MediaRecorder(stream, {
        mimeType: format.mimeType,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: format.mimeType });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setPreviewUrl(url);

        // Turn off mic tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Slice data every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Microphone access denied. Please allow microphone permissions.');
      } else {
        toast.error('Could not access microphone.');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const attachRecordedVoice = () => {
    if (!recordedBlob) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `voice-message-${timestamp}.${selectedFormat.ext}`;

    const file = new File([recordedBlob], filename, {
      type: selectedFormat.mimeType,
      lastModified: Date.now(),
    });

    onAudioReady(file);
    toast.success('Voice message attached to ticket!');

    // Clean up temporary preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    setRecordingSeconds(0);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40 p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-bold shadow-2xs">
            🎙️
          </span>
          <div>
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Voice Message Note
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Record a voice audio clip explaining the issue directly.
            </div>
          </div>
        </div>

        {/* Action button if not recording & no preview */}
        {!isRecording && !recordedBlob && (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="btn-secondary btn-sm inline-flex items-center justify-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
          >
            <MicrophoneIcon className="w-3.5 h-3.5 text-rose-500" />
            <span>Record Voice Message</span>
          </button>
        )}
      </div>

      {/* Recording in progress */}
      {isRecording && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
            </span>
            <span className="text-xs font-semibold text-rose-900 dark:text-rose-100">
              Recording Voice Note:
            </span>
            <span className="font-mono text-sm font-bold text-rose-700 dark:text-rose-300">
              {formatSeconds(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              <StopIcon className="w-3.5 h-3.5" />
              <span>Done Recording</span>
            </button>
          </div>
        </div>
      )}

      {/* Preview of just-recorded voice note */}
      {previewUrl && !isRecording && (
        <div className="space-y-2 p-3 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
            <span className="font-semibold flex items-center gap-1.5">
              <span>🎧 Preview Your Recording ({formatSeconds(recordingSeconds)})</span>
            </span>
            <span className="text-[11px] text-gray-500">Ready to attach</span>
          </div>

          <audio controls src={previewUrl} className="w-full h-9" />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelRecording}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={attachRecordedVoice}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-2xs"
            >
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>Attach Voice Message</span>
            </button>
          </div>
        </div>
      )}

      {/* List of already attached voice notes */}
      {attachedVoiceFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            Attached Voice Messages ({attachedVoiceFiles.length}):
          </div>
          <div className="space-y-1">
            {attachedVoiceFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-700 shadow-2xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">🎙️</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                    {file.name}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </div>
                {onAudioRemoved && (
                  <button
                    type="button"
                    onClick={() => onAudioRemoved(file.name)}
                    className="text-xs text-danger-600 hover:underline shrink-0 ml-2 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. Audio Attachment Player (For Ticket Details)
// ==========================================
interface AudioAttachmentPlayerProps {
  ticketId: string;
  attachment: {
    id: string;
    originalName: string;
    mimeType: string;
    size?: number;
  };
}

export function AudioAttachmentPlayer({ ticketId, attachment }: AudioAttachmentPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const loadAndPlayAudio = async () => {
    if (audioUrl) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    setLoading(true);
    try {
      const blob = await api.downloadAttachment(ticketId, attachment.id);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setIsPlaying(true);
    } catch {
      toast.error('Could not load audio for playback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 w-full max-w-md">
      {!audioUrl ? (
        <button
          type="button"
          onClick={loadAndPlayAudio}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-all shadow-2xs"
        >
          {loading ? (
            <>
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              <span>Loading Audio...</span>
            </>
          ) : (
            <>
              <PlayIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>▶ Play Voice Message</span>
            </>
          )}
        </button>
      ) : (
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-2 border border-gray-200 dark:border-slate-700 shadow-2xs">
          <audio
            ref={audioRef}
            controls
            autoPlay
            src={audioUrl}
            className="w-full h-8"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}
    </div>
  );
}
