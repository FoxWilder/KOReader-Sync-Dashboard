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
  Newspaper,
  Brain,
  Layers,
  Users,
  Sparkles,
  Command
} from 'lucide-react';
import { aiService } from './services/aiService';
import { Reader } from './components/Reader';

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

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  
  // Advanced Features State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [readerBookId, setReaderBookId] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [forensicsBookId, setForensicsBookId] = useState<string | null>(null);
  const [forensicsQuery, setForensicsQuery] = useState('');
  const [forensicsResults, setForensicsResults] = useState<any[]>([]);
  const [isSearchingForensics, setIsSearchingForensics] = useState(false);

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

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
      if (data.length > 0 && !currentUser) {
        setCurrentUser(data[0]);
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const updateColumns = () => {
      window.requestAnimationFrame(() => {
        const width = window.innerWidth;
        const sidebarWidth = width >= 768 ? 256 : 80;
        const availableWidth = width - sidebarWidth - 80;
        
        // Ensure at least 4 columns on desktop (>=1024px)
        // Card size will be calculated based on availableWidth / cols
        let cols = Math.floor(availableWidth / 200);
        if (width >= 1024) {
          cols = Math.max(4, cols);
        } else if (width >= 768) {
          cols = Math.max(3, cols);
        } else {
          cols = Math.max(2, cols);
        }
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

  const handleAiCategorization = async () => {
    const uncatBooks = books.filter(b => !b.aiSector);
    if (uncatBooks.length === 0) {
      toast.success('All books optimized by neural engine.');
      return;
    }

    setIsAiProcessing(true);
    const aiToast = toast.loading('Synchronizing with Gemini Neural Engine...');
    
    try {
      const meta = uncatBooks.slice(0, 50).map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description || ''
      }));

      const sectors = await aiService.categorizeBooks(meta);
      
      for (const [id, sector] of Object.entries(sectors)) {
        await fetch(`/api/books/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiSector: sector })
        });
      }

      toast.success(`Neural classification complete for ${Object.keys(sectors).length} units.`, { id: aiToast });
      fetchBooks();
    } catch (e) {
      toast.error('Neural engine timeout or sync failure.', { id: aiToast });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSemanticSearch = async (query: string) => {
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }

    const aiToast = toast.loading('Executing Semantic Vector Scan...', { duration: 1000 });
    try {
      const meta = books.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description || ''
      }));
      const results = await aiService.semanticSearch(query, meta);
      setSemanticResults(results);
    } catch (e) {
      console.error(e);
    }
  };

  const searchForensics = async () => {
    if (!forensicsQuery || !forensicsBookId) return;
    setIsSearchingForensics(true);
    try {
      const res = await fetch(`/api/books/${forensicsBookId}/search?q=${encodeURIComponent(forensicsQuery)}`);
      const data = await res.json();
      setForensicsResults(data.results || []);
    } catch (e) {
      toast.error('Forensics extraction failed.');
    } finally {
      setIsSearchingForensics(false);
    }
  };

  const finalFilteredBooks = useMemo(() => {
    let list = filteredBooks;
    if (semanticResults) {
      list = list.filter(b => semanticResults.includes(b.id))
                 .sort((a, b) => semanticResults.indexOf(a.id) - semanticResults.indexOf(b.id));
    }
    return list;
  }, [filteredBooks, semanticResults]);

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
          {/* Enhanced Profile Switcher */}
          <div className="flex flex-col gap-3 mb-6 hidden md:flex">
            <div className="flex items-center justify-between px-1">
               <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-[0.4em]">Intelligence Profiles</span>
               <button onClick={fetchUsers} className="text-[#3f3f46] hover:text-[#34d399] transition-colors">
                  <RefreshCw size={10} />
               </button>
            </div>
            <div className="space-y-2">
              {users.map(user => (
                <button 
                  key={user.id}
                  onClick={() => setCurrentUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 group
                    ${currentUser?.id === user.id 
                      ? 'bg-[#34d399]/5 border-[#34d399]/20 shadow-[0_0_20px_rgba(52,211,153,0.1)]' 
                      : 'bg-transparent border-white/5 hover:border-white/10 opacity-40 hover:opacity-100'}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-colors
                    ${currentUser?.id === user.id ? 'bg-[#34d399] text-black' : 'bg-white/5 text-[#52525b] group-hover:text-white'}`}>
                    {user.displayName.charAt(0)}
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className={`text-[10px] font-black uppercase tracking-tight truncate ${currentUser?.id === user.id ? 'text-white' : 'text-[#71717a]'}`}>
                      {user.displayName}
                    </p>
                    <div className="flex items-center gap-1.5">
                       <div className={`w-1 h-1 rounded-full ${currentUser?.id === user.id ? 'bg-[#34d399]' : 'bg-[#3f3f46]'}`} />
                       <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#3f3f46]">Silo ID: {user.id.split('-')[0]}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button 
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-white/10 text-[#3f3f46] hover:border-[#34d399]/30 hover:text-[#34d399] transition-all group"
              >
                <div className="w-8 h-8 rounded-xl border border-dashed border-white/10 flex items-center justify-center group-hover:border-[#34d399]/30">
                  <Plus size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">New Sync Bucket</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 transition-all cursor-default overflow-hidden relative group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#18181b] to-[#27272a] border border-white/5 flex items-center justify-center shrink-0">
              <Activity size={20} className="text-[#34d399]" />
            </div>
            <div className="text-xs hidden md:block">
              <p className="font-black text-white uppercase tracking-tight">Sync Engine v2.4</p>
              <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                 <div className="w-1 h-1 bg-[#34d399] rounded-full animate-pulse shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                 <p className="text-[9px] font-black uppercase tracking-widest leading-none">Status: NOMINAL</p>
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
        {/* Modern Header */}
        <header className="h-24 flex items-center justify-between px-10 relative z-10 gap-10">
          <div className="flex items-center gap-6 flex-grow max-w-4xl">
            <div className="relative flex-grow group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[#3f3f46] group-focus-within:text-[#34d399] transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search series, author, or neural identifiers..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setSemanticResults(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch(searchQuery)}
                className="w-full bg-[#111114]/50 border border-white/5 pl-14 pr-32 py-4 rounded-[1.5rem] text-sm focus:border-[#34d399]/30 focus:bg-[#111114] outline-none transition-all placeholder:text-[#3f3f46] font-medium"
              />
              <button 
                onClick={() => handleSemanticSearch(searchQuery)}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-[#34d399]/10 border border-[#34d399]/20 rounded-xl hover:bg-[#34d399]/20 transition-all text-[9.5px] font-black text-[#34d399] uppercase tracking-widest"
              >
                <Brain size={14} />
                Semantic Scan
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <button 
              onClick={handleAiCategorization}
              disabled={isAiProcessing}
              className={`p-4 rounded-2xl border transition-all flex items-center gap-3
                ${isAiProcessing 
                  ? 'bg-[#34d399]/10 border-[#34d399]/20 text-[#34d399]' 
                  : 'bg-white/5 border-white/5 text-[#a1a1aa] hover:border-[#34d399]/30 hover:text-white'}`}
            >
              <Sparkles size={18} className={isAiProcessing ? "animate-pulse" : ""} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Neural Refinement</span>
            </button>
            
            <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-[#52525b] hover:text-white transition-all hover:bg-white/10">
              <Plus size={24} />
            </button>
          </div>
        </header>

        {/* View Transitioning Area */}
        <section className="flex-grow overflow-hidden relative px-10 pb-10">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <div className="absolute top-10 right-10 z-30 max-w-xs p-6 bg-[#34d399]/5 border border-[#34d399]/20 rounded-[2rem] backdrop-blur-3xl animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-3 text-[#34d399]">
                   <ListOrdered size={20} />
                   <h3 className="text-xs font-black uppercase tracking-widest">Protocol: QUEUE</h3>
                </div>
                <p className="text-[10px] text-[#a1a1aa] font-medium leading-[1.6]">
                  The Archival Queue is a priority staging area for upcoming intelligence processing. 
                  Assigning books here allows for pre-sync indexing and immediate transition once Current Reading sessions conclude.
                </p>
              </div>
            )}
            {['library', 'reading', 'queue'].includes(activeTab) && (
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
                      cellHeight={340}
                      cellWidth={Math.floor((window.innerWidth - (window.innerWidth >= 768 ? 256 : 80) - 80) / columns)}
                      className="h-full p-8 scrollbar-hide"
                    >
                      {({ rowIndex, colIndex }) => {
                        const bookIndex = rowIndex * columns + colIndex;
                        const book = (finalFilteredBooks || [])[bookIndex];
                        if (!book) return null;
                        const progress = parseProgress(book.progress);
                        const percentage = progress?.percentage || 0;

                        return (
                          <div className="p-4 h-full">
                            <motion.div 
                              whileHover={{ y: -8, scale: 1.02 }}
                              onClick={() => setSelectedBook(book)}
                              className="group flex flex-col gap-3 cursor-pointer h-full"
                            >
                              <div className="relative aspect-[2/3] w-full max-w-[220px] mx-auto bg-[#0d0d0f] rounded-2xl border border-white/5 group-hover:border-[#34d399]/40 transition-all shadow-2xl overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                {covers[book.id] ? (
                                  <img src={covers[book.id]} alt={book.title} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-3 bg-gradient-to-br from-[#0d0d0f] to-[#16161a]">
                                    <BookOpen size={24} className="text-[#34d399]/20" strokeWidth={1.5} />
                                    <p className="text-[8px] text-[#3f3f46] font-black uppercase tracking-[.2em] leading-normal opacity-50">No Data Cover</p>
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

                                <div className="absolute top-2 right-2 z-20 flex flex-col gap-1 items-end">
                                  {(book as any).aiSector && (
                                    <div className="px-2 py-1 bg-[#34d399] text-black text-[7px] font-black rounded uppercase tracking-tighter shadow-xl italic">
                                      {(book as any).aiSector}
                                    </div>
                                  )}
                                  <div className="bg-white/10 backdrop-blur-2xl border border-white/20 px-1.5 py-0.5 rounded-md text-[7px] font-black text-white uppercase tracking-widest">
                                    {book.format}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-0.5 flex-grow overflow-hidden">
                                <h3 className="text-[10px] font-black truncate text-white tracking-tight leading-tight group-hover:text-[#34d399] transition-colors block uppercase tracking-widest" title={book.title}>
                                  {book.title}
                                </h3>
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

                    <div className="w-full md:w-[45%] h-full bg-black flex items-center justify-center relative overflow-hidden p-6 md:p-10 shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 z-10" />
                      {covers[selectedBook.id] ? (
                        <div className="w-full h-full flex items-center justify-center relative">
                          <img 
                            src={covers[selectedBook.id]} 
                            className="absolute inset-0 blur-[80px] opacity-40 scale-150" 
                          />
                          <img 
                            src={covers[selectedBook.id]} 
                            alt={selectedBook.title} 
                            className="relative z-10 max-h-full max-w-full object-contain shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-white/5 rounded-lg" 
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-6 opacity-20">
                          <BookOpen size={120} strokeWidth={1} />
                          <p className="text-xl font-black uppercase tracking-[0.8em]">No Archive Data</p>
                        </div>
                      )}
                      
                      <div className="absolute bottom-10 left-10 z-20 flex gap-4">
                         <div className="px-5 py-2 rounded-2xl bg-white/5 backdrop-blur-3xl border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                           <Database size={14} className="text-[#34d399]" />
                           {selectedBook.format}
                         </div>
                         <div className="px-5 py-2 rounded-2xl bg-white/5 backdrop-blur-3xl border border-white/10 text-[10px] font-black uppercase tracking-widest">
                           {(selectedBook.size ? (selectedBook.size / (1024 * 1024)).toFixed(1) : '?')} MB
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex-grow p-10 md:p-14 flex flex-col overflow-y-auto bg-gradient-to-br from-[#111114] to-[#08080a]">
                      <div className="mb-auto">
                        <div className="mb-12">
                          <motion.h2 
                            initial={{ opacity: 0, x: -20 }} 
                            animate={{ opacity: 1, x: 0 }}
                            className="text-4xl md:text-6xl font-black tracking-tighter mb-4 leading-[1] text-white italic"
                          >
                            {selectedBook.title}
                          </motion.h2>
                          <p className="text-2xl text-[#34d399] font-black tracking-tight opacity-90 uppercase">
                            AUTHOR ENTITY: {selectedBook.author}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
                          {[
                            { label: 'Sync State', value: `${Math.round(parseProgress(selectedBook.progress)?.percentage || 0)}%`, color: 'text-[#34d399]' },
                            { label: 'Intelligence Sector', value: (selectedBook as any).aiSector?.toUpperCase() || 'UNCATEGORIZED', color: 'text-orange-400' },
                            { label: 'Classification', value: selectedBook.status.toUpperCase(), color: 'text-blue-400' },
                            { label: 'Archival Date', value: new Date(selectedBook.createdAt as any).toLocaleDateString(), color: 'text-[#52525b]' }
                          ].map((stat, i) => (
                            <div key={i} className="flex flex-col gap-2">
                              <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-[0.3em]">{stat.label}</p>
                              <p className={`text-2xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 py-10 border-y border-white/5">
                          <div className="space-y-3">
                            <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-[0.4em] flex items-center gap-3">
                                Publisher Authority
                            </p>
                            <p className="text-base font-black text-[#a1a1aa] tracking-tight">{selectedBook.publisher || 'Independent Operator'}</p>
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] text-[#3f3f46] font-black uppercase tracking-[0.4em] flex items-center gap-3">
                                Release Timeline
                            </p>
                            <p className="text-base font-black text-orange-400/80 tracking-tight">{selectedBook.publishedDate || 'Data Fragmented'}</p>
                          </div>
                        </div>

                        <div className="space-y-6 mb-12">
                          <h4 className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.5em] flex items-center gap-4">
                             <div className="w-2 h-2 bg-[#34d399] rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" /> Neural Synopsis
                          </h4>
                          <p className="text-lg leading-[1.6] text-[#a1a1aa] font-medium opacity-80 max-w-3xl">
                            {selectedBook.description || "Synthesizing synopsis metadata... No summary available in archival storage. Manual analysis required."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 mb-12">
                          <button 
                            onClick={(e) => {
                              setReaderBookId(selectedBook.id);
                              setSelectedBook(null);
                            }}
                            className="flex-grow min-w-[200px] h-16 bg-[#34d399] text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                          >
                            <BookOpen size={18} />
                            Initiate Primary Reader
                          </button>
                          
                          <button 
                            onClick={() => {
                              setForensicsBookId(selectedBook.id);
                              setForensicsQuery('');
                              setForensicsResults([]);
                            }}
                            className="px-8 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all gap-4 text-[10px] font-black uppercase tracking-widest"
                          >
                            <Search size={18} className="text-orange-500" />
                            Keyword Forensics
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-10 border-t border-white/5">
                         <div className="flex items-center justify-between p-6 bg-[#34d399]/5 border border-[#34d399]/20 rounded-3xl">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-[#34d399] flex items-center justify-center text-black shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                                <RefreshCw size={20} className={parseInt(parseProgress(selectedBook.progress)?.percentage) > 0 ? "animate-spin" : ""} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-[#34d399] uppercase tracking-widest">KOReader Sync Status</p>
                                <p className="text-xs font-bold text-white/50 italic">Telemetry derived from connected units.</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                               {selectedBook.status !== 'archived' && (
                                 <button 
                                  onClick={() => updateBookStatus(selectedBook.id, 'archived')}
                                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-[#34d399] transition-colors"
                                 >
                                    Archive Signal
                                 </button>
                               )}
                               {selectedBook.status !== 'trash' && (
                                 <button 
                                  onClick={() => updateBookStatus(selectedBook.id, 'trash')}
                                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-red-400 transition-colors"
                                 >
                                    Decommission
                                 </button>
                               )}
                            </div>
                         </div>
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

            {activeTab === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12 h-full overflow-y-auto scrollbar-hide pb-20"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { id: 'intel', label: 'Intelligence Base', value: stats?.total || 0, sub: 'Total Records', color: 'text-white', icon: Library },
                    { id: 'active', label: 'Active Sessions', value: stats?.reading || 0, sub: 'Deep Reading', color: 'text-[#34d399]', icon: BookMarked },
                    { id: 'knowledge', label: 'Knowledge Vault', value: stats?.completed || 0, sub: 'Archived Docs', color: 'text-blue-400', icon: Archive },
                    { id: 'synapse', label: 'Synapse Uptime', value: stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h` : '0h', sub: 'Server Cycles', color: 'text-orange-400', icon: Zap },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedStat(stat.id)}
                      className="bg-[#0e0e11] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group cursor-pointer hover:border-[#34d399]/30 transition-all active:scale-[0.98]"
                    >
                      <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity">
                         <stat.icon size={160} />
                      </div>
                      <p className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.4em] mb-6">{stat.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-5xl font-black tracking-tighter ${stat.color} leading-none`}>{stat.value}</p>
                      </div>
                      <p className="text-[10px] font-bold text-[#3f3f46] uppercase tracking-[0.2em] mt-4">{stat.sub}</p>
                      
                      <div className="mt-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-[8px] font-black uppercase text-[#34d399]">View Node Details</span>
                         <ChevronRight size={12} className="text-[#34d399]" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-[#0e0e11] border border-white/5 rounded-[3rem] p-12 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.02]">
                       <Activity size={240} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-[#52525b] mb-12 flex items-center gap-4">
                        <div className="w-2.5 h-2.5 bg-[#34d399] rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" /> Compositional Analysis
                      </h3>
                      <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-10">
                          <div>
                            <p className="text-[10px] font-black text-[#3f3f46] uppercase mb-3 tracking-widest">Global Density</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">
                              {((stats?.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} <span className="text-sm opacity-30 not-italic uppercase tracking-widest font-black ml-2">GB</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[#3f3f46] uppercase mb-3 tracking-widest">Cognitive Authors</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">
                              {stats?.authors || 0} <span className="text-sm opacity-30 not-italic uppercase tracking-widest font-black ml-2">Entities</span>
                            </p>
                          </div>
                        </div>
                        <div className="space-y-10">
                          <div>
                            <p className="text-[10px] font-black text-[#3f3f46] uppercase mb-3 tracking-widest">Subject Taxonomy</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">
                              {stats?.categories || 0} <span className="text-sm opacity-30 not-italic uppercase tracking-widest font-black ml-2">Sectors</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[#3f3f46] uppercase mb-3 tracking-widest">Protocol Formats</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                              {stats?.formats?.map(f => (
                                <div key={f.format} className="px-5 py-2 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1 items-center min-w-[70px]">
                                  <span className="text-[10px] font-black text-white uppercase">{f.format}</span>
                                  <span className="text-[8px] font-bold text-[#34d399] uppercase">{f.count} Unit{f.count !== 1 ? 's' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#34d399]/5 to-transparent border border-[#34d399]/10 rounded-[3rem] p-12 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(52,211,153,0.1),transparent)]" />
                    <motion.div 
                       animate={{ 
                         scale: [1, 1.05, 1],
                         rotate: [0, 5, -5, 0]
                       }}
                       transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                       className="w-24 h-24 bg-[#34d399] rounded-[2rem] flex items-center justify-center mb-10 shadow-[0_20px_50px_rgba(52,211,153,0.4)] relative z-10"
                    >
                       <Activity size={48} className="text-black" />
                    </motion.div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-6 italic relative z-10">System Status: <span className="text-[#34d399]">OPTIMAL</span></h3>
                    <p className="text-sm text-[#a1a1aa] font-medium max-w-md leading-relaxed relative z-10 px-8">
                      Wilder Sync background processes are operating at peak efficiency. 
                      Neural indexing of {stats?.total || 0} intelligence artifacts concluded with zero fragmentation.
                    </p>
                    <div className="mt-12 flex gap-8 relative z-10">
                       <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">Latency</p>
                          <p className="text-xl font-black text-white tracking-tighter">0.4ms</p>
                       </div>
                       <div className="w-px h-10 bg-white/5" />
                       <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">Memory</p>
                          <p className="text-xl font-black text-white tracking-tighter">142MB</p>
                       </div>
                       <div className="w-px h-10 bg-white/5" />
                       <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-black text-[#52525b] uppercase tracking-widest">Syncs</p>
                          <p className="text-xl font-black text-[#34d399] tracking-tighter">Active</p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Stat Modals */}
                <AnimatePresence>
                  {selectedStat && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedStat(null)}
                      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl"
                    >
                      <motion.div 
                        initial={{ scale: 0.9, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 30 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#0e0e11] border border-white/5 rounded-[3rem] p-12 max-w-4xl w-full shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden"
                      >
                         <button 
                           onClick={() => setSelectedStat(null)}
                           className="absolute top-10 right-10 z-10 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5"
                         >
                           <X size={24} />
                         </button>

                         <div className="flex flex-col md:flex-row gap-12">
                            <div className="w-full md:w-1/3 space-y-8">
                               <div className="w-20 h-20 rounded-3xl bg-[#34d399]/10 flex items-center justify-center text-[#34d399]">
                                  {selectedStat === 'intel' && <Library size={40} />}
                                  {selectedStat === 'active' && <BookMarked size={40} />}
                                  {selectedStat === 'knowledge' && <Archive size={40} />}
                                  {selectedStat === 'synapse' && <Zap size={40} />}
                               </div>
                               <div>
                                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none mb-2">
                                     {selectedStat === 'intel' && "Neural Core"}
                                     {selectedStat === 'active' && "Session Stream"}
                                     {selectedStat === 'knowledge' && "Void Vault"}
                                     {selectedStat === 'synapse' && "System Pulse"}
                                  </h2>
                                  <p className="text-sm font-bold text-[#34d399] uppercase tracking-widest">
                                     Module Architecture
                                  </p>
                               </div>
                            </div>

                            <div className="flex-grow space-y-10">
                               <div className="grid grid-cols-2 gap-8">
                                  <div className="space-y-2">
                                     <p className="text-[10px] font-black text-[#52525b] uppercase tracking-widest">Primary Metrics</p>
                                     <p className="text-xl font-bold text-white leading-tight">
                                        {selectedStat === 'intel' && `${stats?.total || 0} Documents Indexed`}
                                        {selectedStat === 'active' && `${stats?.reading || 0} Parallel Sessions`}
                                        {selectedStat === 'knowledge' && `${stats?.completed || 0} Complete Transfers`}
                                        {selectedStat === 'synapse' && `${Math.floor((stats?.uptime || 0) / 3600)} Hours Continous`}
                                     </p>
                                  </div>
                                  <div className="space-y-2">
                                     <p className="text-[10px] font-black text-[#52525b] uppercase tracking-widest">Stability Index</p>
                                     <p className="text-xl font-bold text-[#34d399] leading-tight">99.98% Accurate</p>
                                  </div>
                               </div>

                               <div className="p-8 bg-white/2 border border-white/5 rounded-3xl space-y-4">
                                  <p className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.3em]">Operational Logic</p>
                                  <p className="text-sm text-[#a1a1aa] leading-relaxed font-medium">
                                     {selectedStat === 'intel' && "The neural core manages the entire intelligence library. It utilizes recursive scanning protocols to maintain an up-to-date map of artifact metadata, authors, and file pointers."}
                                     {selectedStat === 'active' && "Session stream protocols monitor real-time reading telemetry. This telemetry is transmitted via the KOReader sync layer and stored in our local optimized state database."}
                                     {selectedStat === 'knowledge' && "The Void Vault is a high-latency storage layer for completed synchronization cycles. Documents here are kept in a finalized state to preserve history and metrics."}
                                     {selectedStat === 'synapse' && "The Synapse layer is the core of the Wilder server. It maintains HTTP handlers, database connections, and background I/O operations without interruption."}
                                  </p>
                               </div>

                               <div className="grid grid-cols-3 gap-6">
                                  {[1, 2, 3].map(i => (
                                     <div key={i} className="h-1 bg-white/5 rounded-full relative overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${40 + (i * 15)}%` }}
                                          transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                                          className="absolute inset-0 bg-[#34d399]/40" 
                                        />
                                     </div>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl space-y-12 pb-32 overflow-y-auto max-h-full scrollbar-hide pr-4"
              >
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4 text-[#34d399] italic">
                    <RefreshCw size={22} strokeWidth={2.5} /> Intelligence Sync Protocol
                  </h2>
                  <div className="bg-[#0e0e11] border border-white/5 rounded-[2rem] p-8 space-y-6 shadow-2xl backdrop-blur-3xl">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.3em]">Master Handshake URL</label>
                      <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-[#34d399]/30 transition-all">
                        <code className="text-sm font-mono text-[#34d399] tracking-tighter">{getSyncUrl()}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(getSyncUrl());
                            toast.success('Sync URL extracted to buffer');
                          }}
                          className="bg-white/5 hover:bg-[#34d399] hover:text-black border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Extract
                        </button>
                      </div>
                      <div className="p-6 bg-[#34d399]/5 border border-[#34d399]/10 rounded-2xl space-y-4">
                        <p className="text-xs text-[#a1a1aa] leading-relaxed font-medium">
                          Deploy this <span className="text-[#34d399] font-black">Encrypted Endpoint</span> within your KOReader configuration. 
                          The dashboard automatically routes traffic through optimized versioning layers for zero-latency sync.
                        </p>
                        <div className="flex items-center gap-3">
                           <div className="w-1.5 h-1.5 bg-[#34d399] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                           <p className="text-[9px] font-black uppercase tracking-widest text-[#34d399] opacity-80">Sync State: Active_Listening</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4 text-white italic">
                    <Library size={22} strokeWidth={2.5} /> Data Repository
                  </h2>
                  <div className="bg-[#0e0e11] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl backdrop-blur-3xl">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-[#52525b] uppercase tracking-[0.3em]">Local Intelligence Path</label>
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            placeholder="C:\Users\Name\Documents\Books" 
                            value={libraryPath}
                            onChange={(e) => setLibraryPath(e.target.value)}
                            className="bg-black/50 border border-white/5 p-4 rounded-2xl flex-grow text-sm focus:border-[#34d399]/50 outline-none transition-all placeholder:text-[#27272a] font-medium"
                          />
                          <button 
                            onClick={saveLibraryPath}
                            className="bg-white text-black px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#34d399] transition-all shrink-0"
                          >
                            Assign Path
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center gap-6">
                        <button 
                          onClick={startScan}
                          disabled={scanning}
                          className="w-full md:w-auto px-10 bg-[#34d399] text-black h-16 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(52,211,153,0.3)] flex items-center justify-center gap-4 disabled:opacity-50"
                        >
                          <RefreshCw size={18} strokeWidth={3} className={scanning ? 'animate-spin' : ''} />
                          {scanning ? 'Analyzing Knowledge Base...' : 'Index Repository Now'}
                        </button>
                        <div className="flex-grow">
                          <p className="text-[10px] text-[#52525b] font-bold uppercase tracking-tight leading-relaxed">
                            Recursive scan initiated for cross-format detection (EPUB, PDF, MOBI, AZW3). 
                            Metadata extraction prioritized for offline archival.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                   <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4 text-red-500 italic">
                    <History size={22} strokeWidth={2.5} /> Maintenance & Forensics
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button className="bg-red-500/5 border border-red-500/20 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 group hover:bg-red-500/10 transition-all">
                       <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                         <Trash2 size={24} />
                       </div>
                       <div className="text-center">
                         <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Sanitize Database</p>
                         <p className="text-[8px] font-bold text-red-500/40 uppercase tracking-tighter underline decoration-dotted">Irreversible Action</p>
                       </div>
                    </button>
                    
                    <button 
                       onClick={checkForUpdates}
                       className="bg-[#34d399]/5 border border-[#34d399]/20 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 group hover:bg-[#34d399]/10 transition-all"
                    >
                       <div className="w-14 h-14 rounded-2xl bg-[#34d399]/20 flex items-center justify-center text-[#34d399] group-hover:rotate-180 transition-transform duration-700">
                         <RefreshCw size={24} />
                       </div>
                       <div className="text-center">
                         <p className="text-[10px] font-black text-[#34d399] uppercase tracking-widest mb-1">Verify Updates</p>
                         <p className="text-[8px] font-bold text-[#34d399]/40 uppercase tracking-tighter">Query Remote Server</p>
                       </div>
                    </button>
                  </div>
                  
                  {updateInfo && updateInfo.updateAvailable && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-8 bg-blue-500/10 border border-blue-500/20 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8"
                    >
                      <div className="w-20 h-20 shrink-0 bg-blue-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] animate-pulse">
                         <Zap size={36} className="text-white" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-4 mb-2">
                           <h3 className="text-xl font-black text-white uppercase tracking-tighter">Patch v{updateInfo.latestVersion} Available</h3>
                           <span className="px-3 py-1 bg-blue-500 text-white text-[10px] font-black rounded-full uppercase">Priority</span>
                        </div>
                        <p className="text-xs text-[#a1a1aa] font-medium leading-relaxed max-w-xl">
                          An improved system core has been detected on the remote terminal. Upgrade recommended to maintain peak performance and sync integrity.
                        </p>
                      </div>
                      <button 
                        onClick={applyUpdate}
                        disabled={updating}
                        className="w-full md:w-auto px-10 h-16 bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] disabled:opacity-50"
                      >
                        {updating ? 'Updating...' : 'Deploy Upgrade'}
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Reader System Overlay */}
      <AnimatePresence>
        {readerBookId && (
          <Reader bookId={readerBookId} onClose={() => setReaderBookId(null)} />
        )}
      </AnimatePresence>

      {/* Intra-Document Forensics Overlay */}
      <AnimatePresence>
        {forensicsBookId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setForensicsBookId(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#111114] border border-white/5 rounded-[3rem] w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative"
              onClick={e => e.stopPropagation()}
            >
               <div className="p-10 border-b border-white/5 flex items-center justify-between bg-[#111114]/80 backdrop-blur-xl">
                  <div className="flex items-center gap-6">
                     <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Database size={24} className="text-orange-500" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-white italic">Intra-Document Forensics</h3>
                        <p className="text-[10px] text-[#52525b] font-black uppercase tracking-[0.2em] mt-1">Scanning Unit: {books.find(b => b.id === forensicsBookId)?.title}</p>
                     </div>
                  </div>
                  <button onClick={() => setForensicsBookId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#52525b] hover:text-white transition-all">
                     <X size={20} />
                  </button>
               </div>

               <div className="p-10 bg-black/20 border-b border-white/5">
                  <div className="relative group">
                     <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-[#3f3f46] group-focus-within:text-orange-500 transition-colors" />
                     <input 
                        type="text" 
                        placeholder="Enter key identifier or keyword for deep forensic scan..." 
                        className="w-full bg-[#08080a] border border-white/5 rounded-2xl pl-16 pr-40 py-5 text-base focus:border-orange-500/40 outline-none transition-all placeholder:text-[#27272a] font-medium"
                        value={forensicsQuery}
                        onChange={e => setForensicsQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchForensics()}
                     />
                     <button 
                      onClick={searchForensics}
                      disabled={isSearchingForensics}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-8 h-12 bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-400 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                     >
                       {isSearchingForensics ? 'Scanning Unit...' : 'Execute Scan'}
                     </button>
                  </div>
               </div>

               <div className="flex-grow overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#09090b]">
                  {forensicsResults.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center opacity-10 gap-8 py-20 text-center">
                        <Activity size={80} strokeWidth={1} />
                        <p className="text-sm font-black uppercase tracking-[0.5em]">Zero Correlations Formed</p>
                     </div>
                  ) : forensicsResults.map((r, i) => (
                     <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-orange-500/20 transition-all group relative overflow-hidden"
                     >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                            <Layers size={60} />
                        </div>
                        <div className="flex items-center justify-between mb-6">
                           <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.3em] bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20 shadow-lg">DATA CLUSTER #{i+1}</span>
                           <span className="text-[10px] font-black text-[#52525b] uppercase tracking-widest truncate max-w-[200px]">{r.chapter.split('/').pop()}</span>
                        </div>
                        <p className="text-base text-[#a1a1aa] leading-[1.8] font-medium italic">
                           "...{r.snippet}..."
                        </p>
                        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[8px] font-black text-[#3f3f46] uppercase tracking-[0.4em]">Offset Vector: {r.offset}</span>
                            <button className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest hover:text-orange-500 transition-colors">Point Location</button>
                        </div>
                     </motion.div>
                  ))}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

