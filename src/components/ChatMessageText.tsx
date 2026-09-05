import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Globe } from 'lucide-react';

interface ChatMessageTextProps {
  text: string;
  isOwn: boolean;
}

interface UrlMatch {
  raw: string;
  href: string;
  domain: string;
}

export const ChatMessageText: React.FC<ChatMessageTextProps> = ({ text, isOwn }) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedTimeoutId, setCopiedTimeoutId] = useState<any>(null);

  const handleCopyUrl = (url: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {
        // Fallback if clipboard API is restricted
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }

    if (copiedTimeoutId) {
      clearTimeout(copiedTimeoutId);
    }
    setCopiedUrl(url);
    const timeout = setTimeout(() => {
      setCopiedUrl(null);
    }, 2000);
    setCopiedTimeoutId(timeout);
  };

  // URL matching regex supporting http, https, ftp, and www. prefixes
  const URL_REGEX = /((?:https?:\/\/|ftp:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;

  const parts: React.ReactNode[] = [];
  const extractedUrls: UrlMatch[] = [];
  const seenUrls = new Set<string>();

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const rawUrl = match[0];

    // Add preceding plain text
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const href = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
    let domain = '';
    try {
      const urlObj = new URL(href);
      domain = urlObj.hostname.replace(/^www\./, '');
    } catch {
      domain = rawUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }

    if (!seenUrls.has(href)) {
      seenUrls.add(href);
      extractedUrls.push({ raw: rawUrl, href, domain });
    }

    const isCurrentCopied = copiedUrl === href;

    // Inline Clickable & Copyable Link
    parts.push(
      <span key={`url-${matchIndex}`} className="inline-flex items-baseline gap-1 mx-0.5 flex-wrap">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`font-medium underline underline-offset-2 break-all transition ${
            isOwn
              ? 'text-white hover:text-emerald-100 decoration-emerald-200/70 hover:decoration-white'
              : 'text-emerald-400 hover:text-emerald-300 decoration-emerald-500/50 hover:decoration-emerald-300'
          }`}
          title={`Open ${href} in new tab`}
        >
          {rawUrl}
        </a>
        <button
          type="button"
          onClick={(e) => handleCopyUrl(href, e)}
          className={`inline-flex items-center justify-center p-0.5 rounded transition align-middle opacity-80 hover:opacity-100 ${
            isOwn
              ? 'hover:bg-emerald-700/60 text-emerald-100'
              : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title={isCurrentCopied ? 'Link copied!' : 'Copy link address'}
        >
          {isCurrentCopied ? (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-200 bg-emerald-900/60 px-1 rounded">
              <Check className="w-2.5 h-2.5" />
              <span>Copied</span>
            </span>
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </span>
    );

    lastIndex = matchIndex + rawUrl.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{parts}</p>

      {/* Rich Link Preview Card(s) if URL(s) detected */}
      {extractedUrls.length > 0 && (
        <div className="pt-1.5 space-y-1.5 border-t border-white/10">
          {extractedUrls.map((urlItem) => {
            const isCardCopied = copiedUrl === urlItem.href;
            return (
              <div
                key={urlItem.href}
                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                  isOwn
                    ? 'bg-black/20 border-white/15 text-white'
                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
                }`}
              >
                {/* Domain & URL preview */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${urlItem.domain}&sz=32`}
                      alt={urlItem.domain}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <Globe className="w-3.5 h-3.5 text-emerald-400 opacity-80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                      <span>{urlItem.domain || 'Link'}</span>
                    </div>
                    <div className="text-[10px] opacity-75 truncate font-mono">{urlItem.href}</div>
                  </div>
                </div>

                {/* Action Buttons: Open & Copy */}
                <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={(e) => handleCopyUrl(urlItem.href, e)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition ${
                      isCardCopied
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : isOwn
                        ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-750 text-slate-200'
                    }`}
                    title="Copy URL"
                  >
                    {isCardCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <a
                    href={urlItem.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition shadow-sm ${
                      isOwn
                        ? 'bg-white text-emerald-950 hover:bg-emerald-50 border-white/40'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400/50'
                    }`}
                    title="Open in new tab"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
