import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  QrCode,
  Layers,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Zap,
  Terminal,
  Info,
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallApp: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallApp,
}) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'apk' | 'capacitor' | 'qr'>('direct');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-ova257bak4yurfuiebhxwp-683189162498.asia-east1.run.app';
  const pwaBuilderUrl = `https://www.pwabuilder.com/app/${encodeURIComponent(currentAppUrl)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const capacitorCommands = [
    {
      id: 'install',
      title: '1. Install Capacitor in your project',
      code: 'npm install @capacitor/core @capacitor/android && npm install -D @capacitor/cli',
    },
    {
      id: 'init',
      title: '2. Initialize Capacitor & Add Android platform',
      code: 'npx cap init "Batchit" "com.batchit.app" --web-dir dist\nnpx cap add android',
    },
    {
      id: 'build',
      title: '3. Build web bundle & Sync to Android',
      code: 'npm run build\nnpx cap sync android',
    },
    {
      id: 'open',
      title: '4. Open in Android Studio & Build APK',
      code: 'npx cap open android',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Android App & APK Options
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ready for Android
                </span>
              </h2>
              <p className="text-xs text-slate-400">Install directly, generate an APK, or build native package</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'direct'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1-Tap Direct Install</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300">Fastest</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'apk'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Generate APK File</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'qr'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan on Mobile</span>
          </button>

          <button
            onClick={() => setActiveTab('capacitor')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'capacitor'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Capacitor / Studio</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* TAB 1: DIRECT 1-TAP INSTALL (PWA / WebAPK) */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/30 border border-emerald-500/30 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">Native Android WebAPK Installation</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Batchit is equipped with a modern Progressive Web App (PWA) manifest. When installed on Android, Chrome converts it into a real native WebAPK with full standalone fullscreen experience, home screen icon, app drawer entry, and local storage.
                  </p>
                </div>
              </div>

              {/* Install Button if browser supports beforeinstallprompt */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 mx-auto flex items-center justify-center p-2 shadow-inner">
                  <img src="/icon-192.png" alt="Batchit Icon" className="w-full h-full object-cover rounded-xl" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">Install Batchit App</h4>
                  <p className="text-xs text-slate-400">Zero download size &bull; Instant updates &bull; Full E2EE</p>
                </div>

                <button
                  onClick={onInstallApp}
                  className="w-full max-w-sm mx-auto py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Add to Android Home Screen</span>
                </button>
              </div>

              {/* Step-by-step instructions for Android Mobile */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  How to Install on Android Mobile:
                </h4>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside pl-1">
                  <li>Open this URL in <strong className="text-slate-200">Google Chrome</strong> or <strong className="text-slate-200">Samsung Internet</strong> on your Android phone.</li>
                  <li>Tap the <strong className="text-slate-200">three dots menu (⋮)</strong> at the top-right corner.</li>
                  <li>Tap <strong className="text-emerald-400">"Install app"</strong> or <strong className="text-emerald-400">"Add to Home screen"</strong>.</li>
                  <li>Android will immediately generate the WebAPK and place the Batchit icon in your phone's app list!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: GENERATE APK (PWABuilder / Bubblewrap) */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100">1-Click Online APK Generator (PWABuilder)</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  PWABuilder (developed by Microsoft & Google) turns any live PWA URL into a signed, ready-to-install Android <code className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 rounded font-mono text-[11px]">.apk</code> package or Google Play Store package.
                </p>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300 truncate max-w-[360px]">
                    {currentAppUrl}
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 ml-2 transition"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>

                <a
                  href={pwaBuilderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition text-center"
                >
                  <Download className="w-4 h-4" />
                  <span>Open PWABuilder to Download APK</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Alternative tool: Bubblewrap CLI */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-slate-200">Or use Google's Official Bubblewrap CLI:</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Run this command in terminal to build a signed APK directly via Google's official Trusted Web Activity tool:
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto">
                    npx @bubblewrap/cli init --manifest={currentAppUrl}/manifest.webmanifest{'\n'}
                    npx @bubblewrap/cli build
                  </pre>
                  <button
                    onClick={() => handleCopyCommand(`npx @bubblewrap/cli init --manifest=${currentAppUrl}/manifest.webmanifest\nnpx @bubblewrap/cli build`, 'bubblewrap')}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                    title="Copy command"
                  >
                    {copiedCmd === 'bubblewrap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCAN QR CODE ON ANDROID PHONE */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 inline-block mx-auto">
                <div className="w-48 h-48 bg-white p-2 rounded-xl mx-auto flex items-center justify-center shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentAppUrl)}&margin=1`}
                    alt="Scan to open on Android"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-3 max-w-xs mx-auto">
                  Scan this QR code with your Android phone camera to open and install the app instantly.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentAppUrl}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-mono w-72 text-center"
                />
                <button
                  onClick={handleCopyUrl}
                  className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CAPACITOR / ANDROID STUDIO PROJECT */}
          {activeTab === 'capacitor' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-300">
                  This project includes <code className="px-1 py-0.5 bg-slate-800 text-emerald-300 rounded font-mono text-[11px]">capacitor.config.json</code>. You can export this project as a ZIP, open it on your computer, and compile a release APK via Android Studio in 4 simple commands:
                </p>
              </div>

              {capacitorCommands.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{item.title}</span>
                    <button
                      onClick={() => handleCopyCommand(item.code, item.id)}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                    >
                      {copiedCmd === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd === item.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-emerald-400 font-mono text-xs overflow-x-auto">
                    {item.code}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">End-to-end encrypted &bull; Android 8.0+ supported</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
