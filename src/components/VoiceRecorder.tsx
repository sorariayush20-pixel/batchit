import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send, Radio } from 'lucide-react';
import { FileAttachment } from '../types';

interface VoiceRecorderProps {
  onSendVoiceNote: (attachment: FileAttachment) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoiceNote, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record voice notes.');
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const attachment: FileAttachment = {
        id: `voice_${Date.now()}`,
        name: `Voice Memo (${recordingTime}s).webm`,
        size: audioBlob.size,
        type: 'audio/webm',
        dataUrl: base64Data,
        isEncrypted: true,
      };
      onSendVoiceNote(attachment);
    };
    reader.readAsDataURL(audioBlob);
  };

  React.useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
      {audioUrl && (
        <audio
          ref={audioPlayerRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 text-rose-500 font-mono text-xs font-semibold px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 animate-pulse">
            <Radio className="w-4 h-4 animate-spin" />
            <span>REC {formatTime(recordingTime)}</span>
          </div>
          <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 animate-pulse" />
          </div>
          <button
            onClick={stopRecording}
            className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition shadow-md"
            title="Stop recording"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={togglePlayback}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <div className="text-xs text-slate-300 font-mono">
            Voice Memo ({formatTime(recordingTime)})
          </div>

          <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-full" />
          </div>

          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 transition"
            title="Discard"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
