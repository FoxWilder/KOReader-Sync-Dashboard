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
  Power
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  coverPath: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library' | 'settings'>('library');
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    // Mock initial books if empty
    setBooks([
      { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1490528560i/4671.jpg' },
      { id: '2', title: '1984', author: 'George Orwell', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1532714506i/40961427.jpg' },
      { id: '3', title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', coverPath: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1382846449i/7144.jpg' },
    ]);
  }, []);

  const steps = [
    { id: '01', title: 'Repository Fork', desc: 'Sudashiii/Sake → user/Sake', status: 'done' },
    { id: '02', title: 'Dependency Refactor', desc: 'Removing Docker & S3 Config', status: 'done' },
    { id: '03', title: 'PowerShell Integration', desc: 'Injecting setup.ps1 & installer', status: 'active' },
    { id: '04', title: 'CI/CD Automation', desc: 'GitHub Actions & rolling releases', status: 'pending' },
  ];

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-[#e4e4e7] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#27272a] bg-[#09090b] flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-[#34d399] rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            <BookOpen size={18} color="#09090b" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold tracking-tight text-lg">Sake <span className="text-[#71717a] font-normal">Sync</span></h1>
        </div>

        <nav className="flex-grow space-y-1">
          <button 
            onClick={() => setActiveTab('library')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'library' ? 'bg-[#18181b] text-[#34d399]' : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-white'}`}
          >
            <Library size={18} /> Library
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-[#18181b] text-[#34d399]' : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-white'}`}
          >
            <LayoutDashboard size={18} /> Deployment
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-[#18181b] text-[#34d399]' : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-white'}`}
          >
            <Settings size={18} /> Settings
          </button>
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
            <button className="ml-auto text-[#71717a] hover:text-white">
              <Power size={14} />
            </button>
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
              placeholder="Search your library..." 
              className="bg-transparent text-xs w-full focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#34d399]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span> SYSTEM READY
            </div>
            <button className="bg-white text-black px-4 py-1.5 rounded-md text-xs font-bold hover:bg-[#e4e4e7] transition-all flex items-center gap-2">
              <Plus size={14} /> Import Book
            </button>
          </div>
        </header>

        {/* Content Tabs */}
        <section className="flex-grow p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'library' && (
              <motion.div 
                key="library"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6"
              >
                {books.map((book) => (
                  <motion.div 
                    key={book.id}
                    whileHover={{ scale: 1.05 }}
                    className="group flex flex-col gap-3"
                  >
                    <div className="aspect-[2/3] bg-[#18181b] rounded-lg overflow-hidden border border-[#27272a] relative group-hover:border-[#34d399]/50 transition-all shadow-xl">
                      <img src={book.coverPath} alt={book.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-full py-1.5 bg-[#34d399] text-black text-[10px] font-bold rounded flex items-center justify-center gap-1">
                          <BookOpen size={12} /> Read Now
                        </button>
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

            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-12 gap-6"
              >
                {/* Re-using the conversion dashboard logic */}
                <div className="col-span-4 flex flex-col gap-6">
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                    <h2 className="text-[10px] font-bold mb-6 text-[#a1a1aa] uppercase tracking-[0.15em]">Process Tracking</h2>
                    <div className="space-y-6">
                      {steps.map((step) => (
                        <div key={step.id} className="flex items-start gap-4">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            step.status === 'done' ? 'bg-[#34d399]/20 border-[#34d399] text-[#34d399]' :
                            step.status === 'active' ? 'bg-[#34d399]/10 border-[#34d399] text-[#34d399] animate-pulse' :
                            'border-[#27272a] text-[#52525b]'
                          }`}>
                            {step.id}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{step.title}</p>
                            <p className={`text-xs ${step.status === 'active' ? 'text-[#34d399]' : 'text-[#71717a]'}`}>
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
                    <h2 className="text-[10px] font-bold mb-6 text-[#a1a1aa] uppercase tracking-[0.15em]">System Info</h2>
                    <div className="grid grid-cols-2 gap-4 text-center mb-6">
                      <div className="p-3 border border-[#27272a] rounded bg-black/30">
                        <p className="text-[8px] text-[#71717a] uppercase mb-1">Backend</p>
                        <p className="text-sm font-bold text-[#34d399]">Express</p>
                      </div>
                      <div className="p-3 border border-[#27272a] rounded bg-black/30">
                        <p className="text-[8px] text-[#71717a] uppercase mb-1">Database</p>
                        <p className="text-sm font-bold text-[#34d399]">SQLite</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 flex flex-col bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl h-[500px]">
                   <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#27272a]/20">
                    <div className="text-[10px] font-mono text-[#71717a] uppercase tracking-[0.2em] font-bold">
                      Automation Logs
                    </div>
                  </div>
                  <div className="p-6 font-mono text-xs leading-relaxed overflow-y-auto flex-grow bg-black/40">
                    <p className="text-[#34d399]">[INIT] Sake Server v1.1.0 starting...</p>
                    <p className="text-[#e4e4e7] mt-1">✓ SQLite database 'sake.db' initialized.</p>
                    <p className="text-[#e4e4e7]">✓ KOReader sync endpoints bound to /koreader/sync/v1/*</p>
                    <p className="text-[#a1a1aa] mt-2 italic"># Listening for progress updates...</p>
                    <p className="text-[#e4e4e7] mt-4">&gt; Version: rolling-2bdeb34</p>
                    <p className="text-[#e4e4e7]">&gt; Server: listening on 0.0.0.0:3000</p>
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
                className="max-w-xl space-y-10"
              >
                <div>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                    <RefreshCcw size={20} className="text-[#34d399]" /> KOReader Sync Configuration
                  </h2>
                  <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#71717a] uppercase">Server URL</label>
                      <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-lg flex items-center justify-between">
                        <code className="text-sm font-mono text-[#34d399]">http://your-server-ip:3000/koreader/sync/v1</code>
                        <button className="text-[10px] font-bold text-[#71717a] hover:text-white uppercase transition-colors">Copy</button>
                      </div>
                      <p className="text-[10px] text-[#52525b]">Enter this URL in your KOReader plugin settings to enable progress syncing.</p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717a] uppercase">Auth Token</label>
                       <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-lg flex items-center justify-between">
                        <code className="text-sm font-mono text-[#34d399]">sk_live_51P...mock_token</code>
                        <button className="text-[10px] font-bold text-[#71717a] hover:text-white uppercase transition-colors">Copy</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                   <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                    <Download size={20} className="text-[#34d399]" /> Maintenance
                  </h2>
                  <div className="flex gap-4">
                    <button className="flex-grow flex items-center justify-center gap-3 bg-[#18181b] border border-[#27272a] py-4 rounded-xl text-sm font-bold hover:border-[#34d399]/50 transition-all">
                       <RefreshCcw size={18} /> Forced Sync
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

