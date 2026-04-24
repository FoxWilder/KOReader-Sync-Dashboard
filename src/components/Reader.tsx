import React, { useEffect, useRef, useState } from 'react';
import ePub, { Rendition } from 'epubjs';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Search, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderProps {
  bookId: string;
  onClose: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ bookId, onClose }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('Loading intelligence artifact...');

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = ePub(`/api/books/${bookId}/file`);
    const rend = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      manager: 'default',
    });

    const display = async () => {
      try {
        await rend.display();
        setRendition(rend);
        setLoading(false);
        
        const meta = await book.loaded.metadata;
        setTitle(meta.title);
      } catch (e) {
        console.error("Failed to render book:", e);
      }
    };

    display();

    rend.on('relocated', (location: any) => {
      const percentage = location.start.percentage;
      setProgress(Math.round(percentage * 100));
    });

    return () => {
      if (book) book.destroy();
    };
  }, [bookId]);

  const prevPage = () => rendition?.prev();
  const nextPage = () => rendition?.next();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col font-sans"
    >
      {/* Reader Nav */}
      <nav className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#0a0a0d]">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <X size={20} className="text-[#a1a1aa]" />
          </button>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-[#52525b] uppercase tracking-widest">Neural Access Protocol</span>
            <h2 className="text-sm font-black text-white italic tracking-tight truncate max-w-[300px] uppercase">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end gap-1">
             <span className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">Sync Integrity</span>
             <div className="flex items-center gap-2">
                <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-[#34d399]" 
                   />
                </div>
                <span className="text-[10px] font-black text-[#34d399] tracking-tighter w-8 text-right">{progress}%</span>
             </div>
          </div>
        </div>
      </nav>

      {/* Reader Content */}
      <main className="flex-grow relative flex items-center justify-center bg-[#070709] overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 bg-[#070709]">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-2 border-[#34d399]/20 border-t-[#34d399] rounded-full"
            />
            <p className="text-[10px] font-black text-[#34d399] uppercase tracking-[0.3em] animate-pulse">Extracting Data Points</p>
          </div>
        )}
        
        <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col gap-4">
           <button onClick={prevPage} className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center hover:bg-white/5 transition-all active:scale-95 group">
              <ChevronLeft size={24} className="text-[#52525b] group-hover:text-white transition-colors" />
           </button>
        </div>

        <div className="w-full max-w-4xl h-full py-16 px-12 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
           <div ref={viewerRef} className="w-full h-full invert opacity-90 transition-opacity duration-1000" />
        </div>

        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col gap-4">
           <button onClick={nextPage} className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center hover:bg-white/5 transition-all active:scale-95 group">
              <ChevronRight size={24} className="text-[#52525b] group-hover:text-white transition-colors" />
           </button>
        </div>
      </main>

      {/* Reader Footer Controls */}
      <footer className="h-16 border-t border-white/5 px-8 flex items-center justify-between bg-[#0a0a0d]">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
               <Activity size={12} className="text-[#34d399]" />
               <span className="text-[9px] font-black text-[#a1a1aa] uppercase tracking-widest leading-none">Session: ACTIVE</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center hover:bg-white/5 text-[#52525b] hover:text-white transition-all">
                <Search size={18} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center hover:bg-white/5 text-[#52525b] hover:text-white transition-all">
                <ZoomOut size={18} />
            </button>
            <button className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center hover:bg-white/5 text-[#52525b] hover:text-white transition-all">
                <ZoomIn size={18} />
            </button>
         </div>
      </footer>
    </motion.div>
  );
};
