/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'react-hot-toast';
import { VList, Virtualizer, experimental_VGrid as VGrid } from 'virtua';
import { 
  Github, 
  Library, 
  Settings, 
  RefreshCw, 
  BookOpen, 
  Upload, 
  LayoutDashboard,
  Search,
  Plus,
  Zap,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Power,
  Download,
  Archive,
  BarChart3,
  ListOrdered,
  FileText,
  Activity,
  History,
  MoreVertical,
  ChevronRight,
  BookMarked,
  X,
  Database,
  Newspaper
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  language?: string;
  coverPath: string;
  status: 'library' | 'reading' | 'queue' | 'archived' | 'trash';
  isReading: number;
  progress?: string;
  size?: number;
  pages?: number;
  format?: string;
}

interface Stats {
  total: number;
  reading: number;
  completed: number;
  authors: number;
  formats: { format: string; count: number }[];
  size: number;
  categories: number;
  uptime: number;
}

interface NewsItem {
  repo: string;
  latest: {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
  };
}

type Tab = 'library' | 'reading' | 'queue' | 'stats' | 'archived' | 'trash' | 'settings' | 'news';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  // Detect if we are in a preview environment (AI Studio or GitHub Pages)
  const isPreview = typeof window !== 'undefined' && (
     window.location.hostname.includes('github.io') || 
     window.location.hostname.includes('run.app') ||
     window.location.hostname.includes('google-usercontent.com')
  );

  const fetchBooks = async () => {
    if (isPreview) {
      setBooks([
        { 
          id: '1', 
          title: 'The Great Gatsby', 
          author: 'F. Scott Fitzgerald', 
          description: 'A classic novel of the Jazz Age, exploring themes of wealth, love, and the American Dream.',
          publisher: 'Charles Scribner\'s Sons',
          publishedDate: '1925',
          language: 'en',
          coverPath: '', 
          status: 'reading', 
          isReading: 1, 
          progress: '{"percentage": 45}', 
          size: 1024 * 500, 
          format: 'epub' 
        },
        { 
          id: '2', 
          title: '1984', 
          author: 'George Orwell', 
          description: 'A dystopian social science fiction novel and cautionary tale about totalitarianism and state surveillance.',
          publisher: 'Secker & Warburg',
          publishedDate: '1949',
          language: 'en',
          coverPath: '', 
          status: 'queue', 
          isReading: 0, 
          size: 1024 * 800, 
          format: 'epub' 
        },
      ]);
      return;
    }

    try {
      const statusParam = ['library', 'deployment', 'settings', 'stats'].includes(activeTab) ? '' : `?status=${activeTab}`;
      const res = await fetch(`/api/books${statusParam}`);
      const data = await res.json();
      setBooks(data);
      
      // Fetch covers for books that have a coverPath
      data.forEach(async (book: Book) => {
        if (book.coverPath && !covers[book.id]) {
          try {
            const cres = await fetch(book.coverPath);
            const b64 = await cres.text();
            setCovers(prev => ({ ...prev, [book.id]: b64 }));
          } catch (e) { console.error(e); }
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    if (isPreview) {
      setStats({ total: 4500, reading: 3, completed: 42, uptime: 3600 * 24 * 7 });
      return;
    }

    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBooks();
    if (activeTab === 'stats') fetchStats();
    if (activeTab === 'news') fetchNews();
    if (activeTab === 'settings') {
      fetchSettings();
      checkForUpdates();
    }
  }, [activeTab]);

  const updateBookStatus = async (id: string, status: string) => {
    await fetch(`/api/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchBooks();
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [books, searchQuery]);

  const sidebarItems: { id: Tab; label: string; icon: any }[] = [
    { id: 'library', label: 'All Books', icon: Library },
    { id: 'reading', label: 'Currently Reading', icon: BookMarked },
    { id: 'queue', label: 'Queue', icon: ListOrdered },
    { id: 'news', label: 'News Feed', icon: Newspaper },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const [libraryPath, setLibraryPath] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{ updateAvailable: boolean; latestVersion: string; currentVersion: string; releaseNotes?: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<any>(null);
  const [columns, setColumns] = useState(5);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [fetchingNews, setFetchingNews] = useState(false);
  const [newRepo, setNewRepo] = useState('');

  useEffect(() => {
    const updateColumns = () => {
      window.requestAnimationFrame(() => {
        const width = window.innerWidth;
        const sidebarWidth = width >= 768 ? 256 : 80;
        const availableWidth = width - sidebarWidth - 80; // Main section padding
        // Decrease divisor to ensure at least 4-5 on standard widths
        const cols = Math.max(4, Math.floor(availableWidth / 180));
        setColumns(cols);
      });
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const fetchNews = async () => {
    setFetchingNews(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNewsItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingNews(false);
    }
  };

  const addNewsRepo = async () => {
    if (!newRepo.includes('/')) {
      toast.error('Invalid repo format (user/repo)');
      return;
    }
    try {
      await fetch('/api/news/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: newRepo })
      });
      setNewRepo('');
      fetchNews();
      toast.success('Repo added');
    } catch (e) {
      toast.error('Failed to add repo');
    }
  };

  const removeNewsRepo = async (repo: string) => {
    try {
      await fetch('/api/news/repos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });
      fetchNews();
      toast.success('Repo removed');
    } catch (e) {
      toast.error('Failed to remove repo');
    }
  };

  const fetchNews = async () => {
    setFetchingNews(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNewsItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingNews(false);
    }
  };

  const addNewsRepo = async () => {
    if (!newRepo.includes('/')) {
      toast.error('Invalid repo format (user/repo)');
      return;
    }
    try {
      await fetch('/api/news/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: newRepo })
      });
      setNewRepo('');
      fetchNews();
      toast.success('Repo added');
    } catch (e) {
      toast.error('Failed to add repo');
    }
  };

  const removeNewsRepo = async (repo: string) => {
    try {
      await fetch('/api/news/repos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });
      fetchNews();
      toast.success('Repo removed');
    } catch (e) {
      toast.error('Failed to remove repo');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const pathSet = data.find((s: any) => s.key === 'library_path');
      if (pathSet) setLibraryPath(pathSet.value);
    } catch (e) { console.error(e); }
  };

  const saveLibraryPath = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'library_path', value: libraryPath })
      });
      if (res.ok) {
        toast.success('Library path saved');
      }
    } catch (e) {
      toast.error('Failed to save path');
    }
  };

  const startScan = async () => {
    setScanning(true);
    setScanStatus({ count: 0, current: 'Initializing...' });
    toast.loading('Starting library index...', { id: 'scan-toast' });
    
    try {
      const res = await fetch('/api/library/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Library indexing complete!', { id: 'scan-toast' });
        fetchBooks();
        fetchStats();
      } else {
        throw new Error(data.message || 'Scan failed');
      }
    } catch (e) {
      toast.error('Indexing failed. Check logs.', { id: 'scan-toast' });
    } finally {
      setScanning(false);
      setScanStatus(null);
    }
  };

  const checkForUpdates = async () => {
    try {
      const res = await fetch('/api/system/update/check');
      const data = await res.json();
      setUpdateInfo(data);
    } catch (e) { console.error(e); }
  };

  const applyUpdate = async () => {
    if (!updateInfo?.updateAvailable) return;

    // Show release notes in a toast and ask for confirmation
    const confirmToast = toast((t) => (
      <div className="space-y-4 p-2 max-w-sm">
        <div className="flex items-center gap-3 text-blue-400">
          <Zap size={20} className="animate-pulse" />
          <p className="font-black uppercase tracking-tighter text-sm">Release Intelligence: {updateInfo.latestVersion}</p>
        </div>
        <div className="max-h-48 overflow-y-auto text-[10px] font-medium text-[#71717a] leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 scrollbar-hide">
          {updateInfo.releaseNotes}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              executeUpgrade();
            }}
            className="flex-grow bg-[#34d399] text-black py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
          >
            Confirm Upgrade
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Abort
          </button>
        </div>
      </div>
    ), { duration: 10000, position: 'bottom-right' });
  };

  const executeUpgrade = async () => {
    setUpdating(true);
    const updateToast = toast.loading('Initiating core system upgrade...');
    
    try {
      setTimeout(() => toast.loading('Downloading patch files...', { id: updateToast }), 1500);
      setTimeout(() => toast.loading('Verifying integrity...', { id: updateToast }), 3000);
      setTimeout(() => toast.loading('Executing installation scripts...', { id: updateToast }), 4500);
      
      const res = await fetch('/api/system/update/apply', { method: 'POST' });
      const data = await res.json();
      
      setTimeout(() => {
        toast.success('Update deployed! System restarting.', { id: updateToast });
        setUpdating(false);
      }, 6000);
    } catch (e) {
      toast.error('Update deployment failed.', { id: updateToast });
      setUpdating(false);
    }
  };

  const parseProgress = (progStr?: string) => {
    if (!progStr) return null;
    try {
      return JSON.parse(progStr);
    } catch (e) { return null; }
  };

  const parseProgress = (progStr?: string) => {
    if (!progStr) return null;
    try {
      return JSON.parse(progStr);
    } catch (e) { return null; }
  };

  const getSyncUrl = () => {
    const host = window.location.host;
    return `http://${host}/sync`;
  };

  return (
    <div className="flex h-screen w-full bg-[#08080a] text-[#e4e4e7] overflow-hidden font-sans selection:bg-[#34d399]/30 selection:text-white">
      <Toaster position="bottom-right" toastOptions={{
        className: 'border-white/10 !bg-[#111114] !text-white !rounded-2xl !text-xs font-bold'
      }} />

      {/* Modern Sidebar */}
      <aside className="w-20 md:w-64 border-r border-[#1c1c1f] flex flex-col bg-[#0b0b0d] z-20 transition-all duration-500 ease-in-out">
        <div className="p-8 flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-10 h-10 bg-gradient-to-br from-[#34d399] to-[#10b981] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.3)] transition-shadow"
          >
             <Zap size={22} className="text-black" strokeWidth={2.5} />
          </motion.div>
          <div className="hidden md:block">
            <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">
              Wilder<span className="text-[#34d399]">Sync</span>
            </h1>
            <p className="text-[8px] font-black tracking-[0.4em] uppercase text-[#3f3f46] mt-1 ml-0.5">Control Deck</p>
          </div>
        </div>

        <nav className="flex-grow p-4 md:p-6 flex flex-col gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative group
                ${activeTab === item.id 
                  ? 'bg-gradient-to-r from-[#34d399]/10 to-transparent text-[#34d399]' 
                  : 'text-[#52525b] hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className="text-sm font-bold tracking-tight hidden md:block">{item.label}</span>
              {activeTab === item.id && (
                <>
                  <motion.div layoutId="nav-glow" className="absolute left-0 w-1 h-6 bg-[#34d399] rounded-r-full shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                  <motion.div layoutId="nav-bg" className="absolute inset-0 bg-[#34d399]/5 rounded-2xl -z-10" />
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all cursor-default overflow-hidden relative group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#18181b] to-[#27272a] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#34d399]/30 transition-colors">
              <User size={20} className="text-[#34d399]" />
            </div>
            <div className="text-xs hidden md:block">
              <p className="font-black text-white uppercase tracking-tight">Admin Console</p>
              <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                 <div className="w-1 h-1 bg-[#34d399] rounded-full animate-pulse shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                 <p className="text-[9px] font-black uppercase tracking-widest leading-none">Status: Linked</p>
              </div>
            </div>
          </div>

          {/* Sidebar System Controls */}
          <div className="hidden md:flex flex-col gap-2">
            {!updateInfo ? (
              <button 
                onClick={checkForUpdates}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 text-[#71717a] hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest shadow-xl group"
              >
                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                Poll Update Server
              </button>
            ) : updateInfo.updateAvailable ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Update Ready</p>
                  <p className="text-[10px] font-mono text-white/40">{updateInfo.latestVersion}</p>
                </div>
                <button 
                  onClick={applyUpdate}
                  disabled={updating}
                  className="w-full bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-[0_10px_20px_rgba(59,130,246,0.3)] disabled:opacity-50"
                >
                  {updating ? 'Deploying...' : 'Initiate Upgrade'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-[#34d399]/5 border border-[#34d399]/10 rounded-2xl flex items-center justify-between">
                <p className="text-[9px] font-black text-[#34d399] uppercase tracking-widest opacity-60">System Current</p>
                <div className="w-1.5 h-1.5 bg-[#34d399] rounded-full opacity-40 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Dynamic Viewport */}
      <main className="flex-grow flex flex-col overflow-hidden relative">
        {/* Transparent Header */}
        <header className="h-24 flex items-center justify-between px-10 relative z-10">
          <div className="flex items-center gap-8 flex-grow max-w-3xl">
            <div className="relative flex-grow group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[#3f3f46] group-focus-within:text-[#34d399] transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search series, author, identifier..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111114]/50 border border-white/5 pl-14 pr-6 py-4 rounded-[1.5rem] text-sm focus:border-[#34d399]/30 focus:bg-[#111114] outline-none transition-all placeholder:text-[#3f3f46] font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            {scanning && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 px-5 py-2.5 bg-[#34d399]/5 border border-[#34d399]/20 rounded-2xl"
              >
                 <RefreshCw size={16} className="text-[#34d399] animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#34d399]">Indexing Engine</span>
              </motion.div>
            )}
            <div className="h-10 w-px bg-white/5" />
            <button 
              onClick={() => toast.success('Server Interaction Required')}
              className="bg-white text-black h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-[.15em] hover:bg-[#34d399] hover:text-black hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-2xl shadow-white/5"
            >
              <Plus size={18} strokeWidth={3} /> Import
            </button>
          </div>
        </header>

        {/* View Transitioning Area */}
        <section className="flex-grow overflow-hidden relative px-10 pb-10">
          <AnimatePresence mode="wait">
            {['library', 'reading', 'queue', 'archived', 'trash'].includes(activeTab) && (
              <motion.div 
                key="books-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full rounded-[2.5rem] bg-[#0b0b0d]/50 border border-white/5 overflow-hidden backdrop-blur-3xl"
              >
                {filteredBooks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#3f3f46] gap-6">
                    <div className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center bg-white/2 overflow-hidden relative group">
                       <Library size={48} className="opacity-10 group-hover:opacity-20 transition-opacity" />
                       <div className="absolute inset-0 bg-gradient-to-t from-[#34d399]/10 to-transparent" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black tracking-[.4em] uppercase opacity-30">Archive Vacant</p>
                      <p className="text-[10px] uppercase font-bold opacity-10 mt-2">Check source directory or filters</p>
                    </div>
                  </div>
                ) : (
                    <VGrid
                      row={Math.max(1, Math.ceil(filteredBooks.length / columns))}
                      col={columns}
                      cellHeight={320}
                      cellWidth={Math.floor((window.innerWidth - (window.innerWidth >= 768 ? 256 : 80) - 80) / columns)}
                      className="h-full p-8 scrollbar-hide"
                    >
                      {({ rowIndex, colIndex }) => {
                        const bookIndex = rowIndex * columns + colIndex;
                        const book = filteredBooks[bookIndex];
                        if (!book) return null;
                        const progress = parseProgress(book.progress);
                        const percentage = progress?.percentage || 0;

                        return (
                          <div className="p-2 h-full">
                            <motion.div 
                              whileHover={{ y: -8 }}
                              onClick={() => setSelectedBook(book)}
                              className="group flex flex-col gap-2 cursor-pointer h-full"
                            >
                              <div className="aspect-[2/3] bg-[#0d0d0f] rounded-xl border border-white/5 relative group-hover:border-[#34d399]/40 transition-all shadow-xl overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                {covers[book.id] ? (
                                  <img src={covers[book.id]} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2 bg-gradient-to-br from-[#0d0d0f] to-[#16161a]">
                                    <BookOpen size={20} className="text-[#34d399]/10" strokeWidth={1.5} />
                                    <p className="text-[7px] text-[#3f3f46] font-black uppercase tracking-[.2em] leading-normal opacity-50">No Cover</p>
                                  </div>
                                )}
                                
                                {percentage > 0 && (
                                  <div className="absolute top-0 left-0 w-full h-0.5 bg-black/60 backdrop-blur-md z-20 overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      className="h-full bg-gradient-to-r from-[#34d399] to-[#10b981]" 
                                    />
                                  </div>
                                )}

                                <div className="absolute bottom-2 right-2 z-20 flex flex-col gap-1 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                  <div className="bg-white/10 backdrop-blur-2xl border border-white/20 px-1.5 py-0.5 rounded-md text-[7px] font-black text-white uppercase tracking-widest uppercase">
                                    {book.format}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-0.5 flex-grow overflow-hidden">
                                <h3 className="text-[10px] font-black truncate text-white tracking-tight leading-tight group-hover:text-[#34d399] transition-colors">{book.title}</h3>
                                <p className="text-[8px] text-[#52525b] font-black truncate uppercase tracking-tighter opacity-80">{book.author}</p>
                              </div>
                            </motion.div>
                          </div>
                        );
                      }}
                    </VGrid>
                )}
              </motion.div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
              {selectedBook && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedBook(null)}
                  className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden max-w-5xl w-full flex flex-col md:flex-row h-[85vh] md:h-auto shadow-[0_30px_60px_-15px_rgba(0,0,0,1)] relative group"
                  >
                    <button 
                      onClick={() => setSelectedBook(null)}
                      className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all backdrop-blur-xl border border-white/5"
                    >
                      <X size={20} />
                    </button>

                    <div className="w-full md:w-[40%] aspect-[4/5] md:aspect-auto bg-black flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                      {covers[selectedBook.id] ? (
                        <div className="w-full h-full relative">
                          <img 
                            src={covers[selectedBook.id]} 
                            className="absolute inset-0 blur-3xl opacity-30 scale-150" 
                          />
                          <img 
                            src={covers[selectedBook.id]} 
                            alt={selectedBook.title} 
                            className="relative z-10 w-full h-full object-cover shadow-[0_0_50px_rgba(0,0,0,0.5)]" 
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 opacity-10">
                          <BookOpen size={100} strokeWidth={1} />
                          <p className="text-sm font-black uppercase tracking-[0.5em]">No Cover</p>
                        </div>
                      )}
                      
                      <div className="absolute bottom-8 left-8 z-20 flex gap-3">
                         <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                           <Database size={12} className="text-[#34d399]" />
                           {selectedBook.format}
                         </div>
                         <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest">
                           {(selectedBook.size ? (selectedBook.size / (1024 * 1024)).toFixed(1) : '?')} MB
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex-grow p-10 md:p-14 flex flex-col justify-between overflow-y-auto max-h-[85vh]">
                      <div>
                        <div className="mb-10">
                          <motion.h2 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-[1.1] text-white"
                          >
                            {selectedBook.title}
                          </motion.h2>
                          <p className="text-xl text-[#34d399] font-bold tracking-tight opacity-90">
                            by {selectedBook.author}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                          {[
                            { label: 'Progress', value: `${Math.round(parseProgress(selectedBook.progress)?.percentage || 0)}%`, color: 'text-[#34d399]' },
                            { label: 'Language', value: selectedBook.language?.toUpperCase() || 'EN', color: 'text-white' },
                            { label: 'Status', value: selectedBook.status.toUpperCase(), color: 'text-blue-400' },
                            { label: 'Created', value: new Date(selectedBook.createdAt as any).toLocaleDateString(), color: 'text-[#71717a]' }
                          ].map((stat, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-[0.2em]">{stat.label}</p>
                              <p className={`text-xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12 py-8 border-y border-white/5">
                          <div className="space-y-2">
                            <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-widest flex items-center gap-2">
                              <Archive size={14} className="text-[#34d399]" /> Publisher
                            </p>
                            <p className="text-sm font-bold text-[#a1a1aa] leading-tight">{selectedBook.publisher || 'Independent'}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-widest flex items-center gap-2">
                              <Clock size={14} className="text-orange-400" /> Published Date
                            </p>
                            <p className="text-sm font-bold text-[#a1a1aa] leading-tight">{selectedBook.publishedDate || 'Unknown Date'}</p>
                          </div>
                        </div>

                        <div className="space-y-4 mb-10">
                          <h4 className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.3em] flex items-center gap-3">
                             <div className="w-1.5 h-1.5 bg-[#34d399] rounded-full" /> Synopsis
                          </h4>
                          <p className="text-base leading-relaxed text-[#a1a1aa] font-medium italic opacity-80">
                            {selectedBook.description || "No thematic summary available. Metadata re-index recommended."}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 mt-auto">
                        <button 
                          onClick={() => updateBookStatus(selectedBook.id, selectedBook.status === 'reading' ? 'library' : 'reading')}
                          className="flex-grow flex items-center justify-center gap-3 bg-[#34d399] text-black h-16 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(52,211,153,0.3)]"
                        >
                          <Zap size={18} /> {selectedBook.status === 'reading' ? 'Clear Reading Status' : 'Mark as Reading'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab === 'news' && (
              <motion.div 
                key="news"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                    Intelligence <span className="text-[#34d399]">Feed</span>
                  </h2>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      placeholder="user/repo"
                      value={newRepo}
                      onChange={(e) => setNewRepo(e.target.value)}
                      className="bg-[#111114] border border-white/5 px-4 py-2 rounded-xl text-sm outline-none focus:border-[#34d399]/50 transition-all"
                    />
                    <button 
                      onClick={addNewsRepo}
                      className="bg-white text-black px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#34d399] transition-all"
                    >
                      Monitor Repo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {fetchingNews ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                      <RefreshCw size={40} className="text-[#34d399] animate-spin opacity-20" />
                    </div>
                  ) : newsItems.map((item, idx) => (
                    <motion.div 
                      key={item.repo}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-[#111114] border border-white/5 rounded-[2rem] p-8 relative group overflow-hidden shadow-2xl flex flex-col h-full min-h-[400px]"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Github size={120} />
                      </div>

                      <div className="flex items-start justify-between mb-8 shrink-0">
                        <div className="h-14">
                          <p className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.4em] mb-2">Repository</p>
                          <h3 className="text-xl font-black text-white truncate max-w-[300px]">{item.repo}</h3>
                        </div>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => removeNewsRepo(item.repo)}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-500/50 hover:text-red-500 hover:bg-white/10 transition-all border border-white/5"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-2xl p-6 border border-white/5 flex-grow mb-8 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4 h-6">
                            <div className="flex items-center gap-3">
                              <Zap size={16} className="text-orange-400" />
                              <span className="text-sm font-black text-orange-400">{item.latest.tag_name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#52525b] uppercase">
                              {new Date(item.latest.published_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-white mb-3 line-clamp-1">{item.latest.name}</h4>
                          <p className="text-xs text-[#71717a] line-clamp-4 leading-relaxed overflow-hidden">
                            {item.latest.body.replace(/[#*`]/g, '')}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <a 
                          href={item.latest.html_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-[10px] font-black text-[#34d399] uppercase tracking-widest hover:translate-x-2 transition-transform"
                        >
                          View Intel Dossier <ChevronRight size={14} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'news' && (
              <motion.div 
                key="news"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                    Intelligence <span className="text-[#34d399]">Feed</span>
                  </h2>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      placeholder="user/repo"
                      value={newRepo}
                      onChange={(e) => setNewRepo(e.target.value)}
                      className="bg-[#111114] border border-white/5 px-4 py-2 rounded-xl text-sm outline-none focus:border-[#34d399]/50 transition-all"
                    />
                    <button 
                      onClick={addNewsRepo}
                      className="bg-white text-black px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#34d399] transition-all"
                    >
                      Monitor Repo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {fetchingNews ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                      <RefreshCw size={40} className="text-[#34d399] animate-spin opacity-20" />
                    </div>
                  ) : newsItems.map((item, idx) => (
                    <motion.div 
                      key={item.repo}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-[#111114] border border-white/5 rounded-[2rem] p-8 relative group overflow-hidden shadow-2xl flex flex-col h-full min-h-[400px]"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Github size={120} />
                      </div>

                      <div className="flex items-start justify-between mb-8 shrink-0">
                        <div className="h-14">
                          <p className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.4em] mb-2">Repository</p>
                          <h3 className="text-xl font-black text-white truncate max-w-[300px]">{item.repo}</h3>
                        </div>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => removeNewsRepo(item.repo)}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-500/50 hover:text-red-500 hover:bg-white/10 transition-all border border-white/5"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-2xl p-6 border border-white/5 flex-grow mb-8 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4 h-6">
                            <div className="flex items-center gap-3">
                              <Zap size={16} className="text-orange-400" />
                              <span className="text-sm font-black text-orange-400">{item.latest.tag_name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#52525b] uppercase">
                              {new Date(item.latest.published_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-white mb-3 line-clamp-1">{item.latest.name}</h4>
                          <p className="text-xs text-[#71717a] line-clamp-4 leading-relaxed overflow-hidden">
                            {item.latest.body.replace(/[#*`]/g, '')}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <a 
                          href={item.latest.html_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-[10px] font-black text-[#34d399] uppercase tracking-widest hover:translate-x-2 transition-transform"
                        >
                          View Intel Dossier <ChevronRight size={14} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { label: 'Intelligence Base', value: stats?.total || 0, sub: 'Total Records', color: 'text-white', icon: Library },
                    { label: 'Active Sessions', value: stats?.reading || 0, sub: 'Deep Reading', color: 'text-[#34d399]', icon: BookMarked },
                    { label: 'Knowledge Vault', value: stats?.completed || 0, sub: 'Archived Docs', color: 'text-blue-400', icon: Archive },
                    { label: 'Synapse Uptime', value: `${Math.floor((stats?.uptime || 0) / 3600)}h`, sub: 'Server Cycles', color: 'text-orange-400', icon: Zap },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-[#111114] border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group"
                    >
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <stat.icon size={120} />
                      </div>
                      <p className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.3em] mb-4">{stat.label}</p>
                      <p className={`text-4xl font-black tracking-tighter ${stat.color} mb-2`}>{stat.value}</p>
                      <p className="text-[10px] font-bold text-[#3f3f46] uppercase">{stat.sub}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-[#111114] border border-white/5 rounded-[2.5rem] p-10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#52525b] mb-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-[#34d399] rounded-full" /> Library Composition
                    </h3>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-[#3f3f46] uppercase mb-2">Total Storage</p>
                          <p className="text-2xl font-black text-white italic">
                            {((stats?.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} <span className="text-sm opacity-30 not-italic">GB</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#3f3f46] uppercase mb-2">Creative Minds</p>
                          <p className="text-2xl font-black text-white italic">
                            {stats?.authors || 0} <span className="text-sm opacity-30 not-italic">Authors</span>
                          </p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-[#3f3f46] uppercase mb-2">Taxonomy</p>
                          <p className="text-2xl font-black text-white italic">
                            {stats?.categories || 0} <span className="text-sm opacity-30 not-italic">Categories</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#3f3f46] uppercase mb-2">Data Formats</p>
                          <div className="flex flex-wrap gap-2">
                            {stats?.formats?.map(f => (
                              <span key={f.format} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-[#52525b] uppercase tracking-tighter">
                                {f.format}: {f.count}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#34d399]/5 to-transparent border border-[#34d399]/10 rounded-[2.5rem] p-10 flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 bg-[#34d399] rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(52,211,153,0.3)]">
                       <Activity size={40} className="text-black" />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 italic">System Pulse <span className="text-[#34d399]">Optimal</span></h3>
                    <p className="text-sm text-[#71717a] font-medium max-w-sm leading-relaxed">
                      Wilder Sync is monitoring your intelligence base across {stats?.authors || 0} authors and {stats?.categories || 0} sectors of knowledge.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl space-y-12 pb-20"
              >
                <div>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-orange-400">
                    <RefreshCw size={20} /> KOReader Sync Configuration
                  </h2>
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-6 shadow-xl">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#71717a] uppercase tracking-widest">Configuration URL</label>
                      <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl flex items-center justify-between group">
                        <code className="text-sm font-mono text-[#34d399]">{getSyncUrl()}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(getSyncUrl());
                            alert('Sync URL copied to clipboard');
                          }}
                          className="text-[10px] font-bold text-[#71717a] hover:text-white uppercase transition-colors px-2 py-1 bg-[#18181b] rounded border border-white/5"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-3">
                        <p className="text-xs text-[#a1a1aa] leading-relaxed">
                          Enter this <span className="font-bold text-orange-400">Short URL</span> in your KOReader <span className="font-bold">Sync plugin</span> settings. 
                          By using the shortened route, you bypass the long versioned path while maintaining full compatibility.
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-orange-400/80">
                           <CheckCircle2 size={12} /> NO SERVER RESTART REQUIRED
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-[#34d399]">
                    <Library size={20} /> Ebook Library
                  </h2>
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-6 shadow-xl">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#71717a] uppercase">Library Path (Local Windows Path)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="C:\Users\Name\Documents\Books" 
                            value={libraryPath}
                            onChange={(e) => setLibraryPath(e.target.value)}
                            className="bg-[#09090b] border border-[#27272a] p-3 rounded-lg flex-grow text-sm focus:border-[#34d399] outline-none transition-all"
                          />
                          <button 
                            onClick={saveLibraryPath}
                            className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#e4e4e7] transition-all"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-[#27272a]">
                        <button 
                          onClick={startScan}
                          disabled={scanning}
                          className={`w-full flex items-center justify-center gap-3 bg-[#34d399] text-black py-3 rounded-xl text-sm font-bold hover:bg-[#34d399]/90 transition-all ${scanning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} />
                          {scanning ? 'Indexing Library...' : 'Index Library Now'}
                        </button>
                        <p className="text-[10px] text-[#71717a] mt-3 text-center">
                          Scans for EPUB, PDF, MOBI and AZW3 files in the library path and its subfolders.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                   <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-red-500">
                    <History size={20} /> System Maintenance
                  </h2>
                  <div className="flex gap-4">
                    <button className="flex-grow flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/50 py-4 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/20 transition-all">
                       <Trash2 size={18} /> Clear Database
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

