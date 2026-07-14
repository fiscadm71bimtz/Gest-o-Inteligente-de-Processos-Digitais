/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileCheck2, Settings, Code, FileCode, CheckCircle2, 
  HelpCircle, Sparkles, BookOpen, Layers
} from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import UserProcessPanel from './components/UserProcessPanel';
import { TipoProcesso } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [templates, setTemplates] = useState<TipoProcesso[]>([]);

  const handleTemplatesChange = (newTemplates: TipoProcesso[]) => {
    setTemplates(newTemplates);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800" id="app-root-container">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-40 shadow-sm/5 shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-600/10 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-950 tracking-tight text-base">Gestão de Processos</span>
                <span className="text-[9px] bg-indigo-50 text-indigo-600 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100/30">
                  Unificador
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">Gestão Inteligente de Processos Digitais</p>
            </div>
          </div>

          {/* TAB SELECTION CONTROLS */}
          <nav className="flex space-x-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/30">
            <button
              onClick={() => setActiveTab('user')}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'user'
                  ? 'bg-white text-indigo-600 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.06)] border border-slate-200/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/45'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Gerar Processo</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-indigo-600 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.06)] border border-slate-200/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/45'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Gerenciar Checklists</span>
            </button>
          </nav>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL (RENDERIZAÇÃO DINÂMICA DE ABAS) */}
      <main className="flex-1 py-8">
        <div className={activeTab === 'user' ? 'block' : 'hidden'}>
          <UserProcessPanel templates={templates} />
        </div>
        <div className={activeTab === 'admin' ? 'block' : 'hidden'}>
          <AdminPanel onTemplatesChange={handleTemplatesChange} />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-transparent border-t border-slate-200/40 py-6 shrink-0 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-600 tracking-tight">Gestão de Processos</span>
            <span>© 2026</span>
            <span>•</span>
            <span>Gestão Inteligente de Documentos</span>
          </div>
          <div className="flex items-center space-x-3 font-semibold">
            <span className="text-slate-200">|</span>
            <span className="flex items-center gap-1.5 bg-indigo-50/50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100/20 text-[10px]">
              <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
              Chancela PDF-Lib Integrada
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
