import { ExternalLink } from 'lucide-react';

export function Watermark() {
  return (
    <a
      href="https://byteandberry.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all text-xs text-slate-600 hover:text-slate-900 group"
      title="Visit Byte&Berry"
    >
      <span className="text-[10px] font-medium">Created by</span>
      <span className="font-semibold text-primary-600 group-hover:text-primary-700">Byte&Berry</span>
      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

