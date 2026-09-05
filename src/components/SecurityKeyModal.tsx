import React, { useState } from 'react';
import { Shield, Key, Copy, Check, Lock, Info, Server, RefreshCw } from 'lucide-react';
import { KeyPairPem } from '../crypto/e2ee';

interface SecurityKeyModalProps {
  keyPairPem: KeyPairPem;
  onClose: () => void;
  onRegenerateKeys: () => void;
}

export const SecurityKeyModal: React.FC<SecurityKeyModalProps> = ({
  keyPairPem,
  onClose,
  onRegenerateKeys,
}) => {
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const copyToClipboard = (text: string, type: 'public' | 'fp') => {
    navigator.clipboard.writeText(text);
    if (type === 'public') {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } else {
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Security & Key Vault</h3>
              <p className="text-xs text-slate-400">Client-Side End-to-End Encryption Specification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Active Ciphers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Asymmetric Key Exchange</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">RSA-OAEP 2048-bit</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Used for key agreement & DM key exchange</p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Symmetric Content Cipher</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">AES-256-GCM</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Used for payload & file attachment encryption</p>
            </div>
          </div>

          {/* Safety Fingerprint */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-emerald-400" />
                Your Safety Fingerprint (SHA-256)
              </label>
              <button
                onClick={() => copyToClipboard(keyPairPem.fingerprint, 'fp')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                {copiedFingerprint ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedFingerprint ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-lg font-mono text-xs text-emerald-300 tracking-wider break-all select-all">
              {keyPairPem.fingerprint}
            </div>
          </div>

          {/* Public Key PEM */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Public Key (PEM)</label>
              <button
                onClick={() => copyToClipboard(keyPairPem.publicKeyPem, 'public')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                {copiedPublic ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPublic ? 'Copied' : 'Copy PEM'}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-slate-400 h-28 overflow-y-auto whitespace-pre-wrap select-all">
              {keyPairPem.publicKeyPem}
            </pre>
          </div>

          {/* Zero Trust Architecture Note */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200">
            <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your Private Key never leaves browser memory. The server only sees Base64 encrypted ciphertexts and cannot read messages or files.
            </p>
          </div>

          {/* Regenerate Keys Button */}
          <div className="pt-2 flex justify-between items-center border-t border-slate-800">
            <button
              onClick={onRegenerateKeys}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Keypair
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
