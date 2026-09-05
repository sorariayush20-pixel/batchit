import React from 'react';
import { Heart, Info, Mail, MessageSquare, ShieldCheck, User, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-5 text-white flex items-center justify-between relative flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Info className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">About Us & Contact</h2>
              <p className="text-[11px] text-emerald-100/90">Batchit Zero-Trust Platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* About Us Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>About Us</span>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Made with</span>
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                  <span>in India 🇮🇳</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Gen Z Platform
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong className="text-slate-100">Founder:</strong> Ayushmaan Sorari
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong className="text-emerald-400">100% Free</strong> • No mobile number or email address required
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>End-to-end encrypted messaging designed for total privacy & convenience.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Us Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Mail className="w-4 h-4" />
              <span>Contact Us</span>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Have ideas or feedback? Feel free to give suggestions and improvements to help us make Batchit even better!
              </p>

              <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <Mail className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Direct Support & Feedback Email
                  </div>
                  <a
                    href="mailto:satchi0011@outlook.com"
                    className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline transition"
                  >
                    satchi0011@outlook.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl transition shadow-md shadow-emerald-500/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
