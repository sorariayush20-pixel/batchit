import React from 'react';
import { FileAttachment } from '../types';
import { X, Download, FileText, FileCode, Film, Music, ShieldCheck } from 'lucide-react';

interface FilePreviewModalProps {
  attachment: FileAttachment;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ attachment, onClose }) => {
  const isImage = attachment.type.startsWith('image/');
  const isAudio = attachment.type.startsWith('audio/');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div className="truncate">
              <h4 className="text-sm font-semibold text-slate-100 truncate">{attachment.name}</h4>
              <span className="text-[10px] text-slate-400">{formatSize(attachment.size)} • Encrypted Attachment</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={attachment.dataUrl}
              download={attachment.name}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="p-6 flex-1 flex items-center justify-center overflow-auto bg-slate-950/50">
          {isImage ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-h-[60vh] max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
            />
          ) : isAudio ? (
            <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <Music className="w-8 h-8" />
              </div>
              <div>
                <h5 className="font-semibold text-slate-200 text-sm">{attachment.name}</h5>
                <p className="text-xs text-slate-400 mt-1">{formatSize(attachment.size)}</p>
              </div>
              <audio controls src={attachment.dataUrl} className="w-full" />
            </div>
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center max-w-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-300 mx-auto flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h5 className="font-semibold text-slate-200 text-sm">{attachment.name}</h5>
                <p className="text-xs text-slate-400 mt-1">{attachment.type || 'Document'} • {formatSize(attachment.size)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
