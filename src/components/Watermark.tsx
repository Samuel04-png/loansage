import { ExternalLink } from 'lucide-react';

export function Watermark() {
  return (
    <a
      href="https://byteandberry.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 md:bottom-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border border-slate-200 dark:border-neutral-700 rounded-full shadow-sm hover:shadow-md transition-all text-xs text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100 group"
      title="Visit Byte&Berry"
    >
      <span className="text-[10px] font-medium">Created by</span>
      <span className="font-semibold text-primary-600 dark:text-blue-400 group-hover:text-primary-700 dark:group-hover:text-blue-300">Byte&Berry</span>
      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

