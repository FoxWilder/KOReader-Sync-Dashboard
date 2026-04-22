/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Github, 
  Library, 
  Settings, 
  RefreshCcw, 
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
  BookMarked
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  coverPath: string;
  status: 'queue' | 'reading' | 'archived' | 'trash';
  isReading: number;
  progress?: string;
}

interface Stats {
  total: number;
  reading: number;
  completed: number;
  uptime: number;
}

type Tab = 'library' | 'reading' | 'queue' | 'stats' | 'archived' | 'trash' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Detect if we are in a preview environment (AI Studio or GitHub Pages)
  const isPreview = typeof window !== 'undefined' && (
     window.location.hostname.includes('github.io') || 
     window.location.hostname.includes('run.app') ||
     window.location.hostname.includes('google-usercontent.com')
  );

  const fetchBooks = async () => {
    if (isPreview) {
      setBooks([
        { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1490528560i/4671.jpg', status: 'reading', isReading: 1 },
        { id: '2', title: '1984', author: 'George Orwell', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1532714506i/40961427.jpg', status: 'queue', isReading: 0 },
        { id: '3', title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1382846449i/7144.jpg', status: 'archived', isReading: 0 },
        { id: '4', title: 'Brave New World', author: 'Aldous Huxley', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1523058850i/375013.jpg', status: 'library', isReading: 0 },
        { id: '5', title: 'The Hobbit', author: 'J.R.R. Tolkien', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1372847500i/5907.jpg', status: 'reading', isReading: 1 },
        { id: '6', title: 'Fahrenheit 451', author: 'Ray Bradbury', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1383718290i/13079982.jpg', status: 'queue', isReading: 0 },
      ]);
      return;
    }

    try {
      const statusParam = ['library', 'deployment', 'settings', 'stats'].includes(activeTab) ? '' : `?status=${activeTab}`;
      const res = await fetch(`/api/books${statusParam}`);
      const data = await res.json();
      setBooks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    if (isPreview) {
      setStats({ total: 154, reading: 3, completed: 42, uptime: 3600 * 24 * 7 });
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

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sidebarItems: { id: Tab; label: string; icon: any }[] = [
    { id: 'library', label: 'All Books', icon: Library },
    { id: 'reading', label: 'Currently Reading', icon: BookMarked },
    { id: 'queue', label: 'Queue', icon: ListOrdered },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const [libraryPath, setLibraryPath] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{ updateAvailable: boolean; latestVersion: string; currentVersion: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const pathSet = data.find((s: any) => s.key === 'library_path');
      if (pathSet) setLibraryPath(pathSet.value);
    } catch (e) { console.error(e); }
  };

  const saveLibraryPath = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'library_path', value: libraryPath })
    });
    alert('Library path saved.');
  };

  const startScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/library/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Indexing complete.');
        fetchBooks();
      } else {
        alert(`Indexing failed: ${data.message || 'Check logs.'}`);
      }
    } catch (e) { console.error(e); }
    setScanning(false);
  };

  const checkForUpdates = async () => {
    try {
      const res = await fetch('/api/system/update/check');
      const data = await res.json();
      setUpdateInfo(data);
    } catch (e) { console.error(e); }
  };

  const applyUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/system/update/apply', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (e) { console.error(e); }
    setUpdating(false);
  };

  useEffect(() => {
    fetchBooks();
    if (activeTab === 'stats') fetchStats();
    if (activeTab === 'settings') {
      fetchSettings();
      checkForUpdates();
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-[#e4e4e7] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#27272a] bg-[#09090b] flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-[#34d399] rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            <BookMarked size={18} color="#09090b" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold tracking-tight text-lg">Wilder <span className="text-[#71717a] font-normal">Sync</span></h1>
        </div>

        <nav className="flex-grow space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-[#18181b] text-[#34d399]' : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-white'}`}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[#27272a]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="text-xs">
              <p className="font-bold">Admin</p>
              <p className="text-[#71717a]">Sync Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col overflow-hidden bg-[#000000]">
        {/* Sub-Header */}
        <header className="px-8 py-4 border-b border-[#27272a] bg-[#09090b]/50 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4 bg-[#18181b] px-3 py-1.5 rounded-lg border border-[#27272a] w-64">
            <Search size={14} className="text-[#71717a]" />
            <input 
              type="text" 
              placeholder="Search library..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#34d399]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span> SYSTEM READY
            </div>
            <button 
              onClick={() => alert('Importing books requires a running server. In this preview, check your local installation for the full experience!')}
              className="bg-white text-black px-4 py-1.5 rounded-md text-xs font-bold hover:bg-[#e4e4e7] transition-all flex items-center gap-2"
            >
              <Plus size={14} /> Import
            </button>
          </div>
        </header>

        {/* Content Tabs */}
        <section className="flex-grow p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {['library', 'reading', 'queue', 'archived', 'trash'].includes(activeTab) && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6"
              >
                {filteredBooks.map((book) => (
                  <motion.div 
                    key={book.id}
                    whileHover={{ scale: 1.05 }}
                    className="group flex flex-col gap-3"
                  >
                    <div className="aspect-[2/3] bg-[#18181b] rounded-lg overflow-hidden border border-[#27272a] relative group-hover:border-[#34d399]/50 transition-all shadow-xl">
                      <img src={book.coverPath} alt={book.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 p-3 flex flex-col gap-1 translate-y-full group-hover:translate-y-0 transition-transform">
                        {activeTab !== 'reading' && (
                          <button onClick={() => updateBookStatus(book.id, 'reading')} className="w-full py-1 bg-[#34d399] text-black text-[10px] font-bold rounded flex items-center justify-center gap-1">
                            <BookOpen size={12} /> Start
                          </button>
                        )}
                        {activeTab !== 'archived' && (
                          <button onClick={() => updateBookStatus(book.id, 'archived')} className="w-full py-1 bg-[#18181b] text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 border border-[#27272a]">
                            <Archive size={12} /> Archive
                          </button>
                        )}
                        {activeTab !== 'trash' && (
                           <button onClick={() => updateBookStatus(book.id, 'trash')} className="w-full py-1 bg-red-500/20 text-red-500 text-[10px] font-bold rounded flex items-center justify-center gap-1 border border-red-500/30">
                            <Trash2 size={12} /> Trash
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold truncate">{book.title}</h3>
                      <p className="text-[10px] text-[#71717a] truncate">{book.author}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                  <p className="text-[10px] font-bold text-[#71717a] uppercase mb-1">Total Books</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                  <p className="text-[10px] font-bold text-[#71717a] uppercase mb-1">Reading Now</p>
                  <p className="text-2xl font-bold text-[#34d399]">{stats?.reading || 0}</p>
                </div>
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                  <p className="text-[10px] font-bold text-[#71717a] uppercase mb-1">Completed</p>
                  <p className="text-2xl font-bold text-blue-400">{stats?.completed || 0}</p>
                </div>
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                  <p className="text-[10px] font-bold text-[#71717a] uppercase mb-1">Uptime</p>
                  <p className="text-2xl font-bold text-orange-400">{Math.floor((stats?.uptime || 0) / 3600)}h</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl space-y-10"
              >
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
                          <RefreshCcw size={18} className={scanning ? 'animate-spin' : ''} />
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
                   <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-blue-400">
                    <Zap size={20} /> Software Update
                  </h2>
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-xl">
                    {!updateInfo ? (
                      <button 
                        onClick={checkForUpdates}
                        className="w-full flex items-center justify-center gap-3 bg-[#18181b] border border-[#27272a] py-4 rounded-xl text-sm font-bold hover:border-blue-400/50 transition-all"
                      >
                        <RefreshCcw size={18} /> Check for Updates
                      </button>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#71717a] uppercase mb-1">Status</p>
                            <p className={`text-sm font-bold ${updateInfo.updateAvailable ? 'text-blue-400' : 'text-[#34d399]'}`}>
                              {updateInfo.updateAvailable ? 'Update Available!' : 'System Up to Date'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-[#71717a] uppercase mb-1">Current Version</p>
                            <p className="text-sm font-mono">{updateInfo.currentVersion}</p>
                          </div>
                        </div>

                        {updateInfo.updateAvailable && (
                          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-4">
                            <p className="text-xs">
                              A new release <span className="font-bold text-blue-400">{updateInfo.latestVersion}</span> is available. 
                              Applying the update will restart the server.
                            </p>
                            <button 
                              onClick={applyUpdate}
                              disabled={updating}
                              className={`w-full flex items-center justify-center gap-3 bg-blue-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Download size={18} />
                              {updating ? 'Applying Update...' : 'Apply Update Now'}
                            </button>
                          </div>
                        )}
                        
                        {!updateInfo.updateAvailable && (
                          <p className="text-xs text-[#71717a] text-center">
                            You are running the latest version of Wilder Sync.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                   <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-red-500">
                    <History size={20} /> System Maintenance
                  </h2>
                  <div className="flex gap-4">
                    <button className="flex-grow flex items-center justify-center gap-3 bg-[#18181b] border border-[#27272a] py-4 rounded-xl text-sm font-bold hover:border-white/20 transition-all">
                       <RefreshCcw size={18} /> Forced Handshake
                    </button>
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

