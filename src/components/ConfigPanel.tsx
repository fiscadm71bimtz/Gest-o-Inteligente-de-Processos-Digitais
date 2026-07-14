/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Stamp, ShieldCheck } from 'lucide-react';
import { RubricaConfig } from '../types';

interface ConfigPanelProps {
  configChancela: RubricaConfig;
  setConfigChancela: (config: RubricaConfig) => void;
}

export default function ConfigPanel({ configChancela, setConfigChancela }: ConfigPanelProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* HEADER DA PÁGINA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-600/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configurações Globais</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Configure o comportamento padrão do unificador e a identidade visual da autenticação digital.</p>
          </div>
        </div>
      </div>

      {/* PDF Unification / Stamp Customizer Pane (Bento Box) */}
      <div className="relative bg-white p-7 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] space-y-6 overflow-hidden z-0">
        {/* Background decorative gradient */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-100/60 to-transparent rounded-full blur-3xl -z-10 -translate-y-1/3 translate-x-1/3"></div>

        <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-500/20">
            <Stamp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-[15px]">
              Selo de Chancela & Autenticação Digital
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Configure as credenciais e metadados que serão impressos no documento final.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block ml-1">Texto de Autenticação</label>
            <input
              type="text"
              value={configChancela.texto}
              onChange={(e) => setConfigChancela({ ...configChancela, texto: e.target.value })}
              placeholder="Ex: ASSINATURA DIGITAL"
              className="w-full text-xs px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bold text-slate-800 shadow-inner shadow-slate-100/50"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block ml-1">Posição da Chancela</label>
            <select
              value={configChancela.posicao}
              onChange={(e) => setConfigChancela({ ...configChancela, posicao: e.target.value as any })}
              className="w-full text-xs px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bold text-slate-800 cursor-pointer shadow-inner shadow-slate-100/50"
            >
              <option value="bottom-right">Rodapé Direito</option>
              <option value="bottom-left">Rodapé Esquerdo</option>
              <option value="bottom-center">Rodapé Centralizado</option>
              <option value="top-right">Cabeçalho Direito</option>
              <option value="top-left">Cabeçalho Esquerdo</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block ml-1">Cor do Selo</label>
            <div className="flex items-center space-x-3 bg-slate-50/50 border border-slate-200/80 p-2 rounded-2xl shadow-inner shadow-slate-100/50 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 transition-all">
              <input
                type="color"
                value={configChancela.cor}
                onChange={(e) => setConfigChancela({ ...configChancela, cor: e.target.value })}
                className="w-8 h-8 rounded-xl border-0 p-0 cursor-pointer overflow-hidden shrink-0 bg-transparent"
              />
              <input
                type="text"
                value={configChancela.cor}
                onChange={(e) => setConfigChancela({ ...configChancela, cor: e.target.value })}
                className="w-full text-xs bg-transparent border-none font-mono font-bold text-slate-700 focus:outline-none uppercase tracking-wider"
              />
            </div>
          </div>
        </div>

        {/* NOVA SEÇÃO: SERVIDOR E POSIÇÃO DA NUMERAÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-3">
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block ml-1">Nome do Servidor (Autenticador)</label>
            <input
              type="text"
              value={configChancela.nomeServidor || ''}
              onChange={(e) => setConfigChancela({ ...configChancela, nomeServidor: e.target.value })}
              placeholder="Ex: 1º Sgt Gaudencio"
              className="w-full text-xs px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bold text-slate-800 shadow-inner shadow-slate-100/50"
            />
          </div>
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block ml-1">Posição da Numeração de Páginas</label>
            <select
              value={configChancela.posicaoPagina}
              onChange={(e) => setConfigChancela({ ...configChancela, posicaoPagina: e.target.value as any })}
              className="w-full text-xs px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bold text-slate-800 cursor-pointer shadow-inner shadow-slate-100/50"
            >
              <option value="bottom-right">Rodapé Direito</option>
              <option value="bottom-left">Rodapé Esquerdo</option>
              <option value="bottom-center">Rodapé Centralizado</option>
              <option value="top-right">Cabeçalho Direito</option>
              <option value="top-left">Cabeçalho Esquerdo</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-5 items-center bg-gradient-to-r from-slate-50 to-indigo-50/40 p-5 rounded-2xl border border-slate-100/80 text-xs shadow-sm shadow-slate-200/20 mt-4">
          <label className="flex items-center cursor-pointer space-x-3 group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={configChancela.incluirPagina} 
                onChange={(e) => setConfigChancela({ ...configChancela, incluirPagina: e.target.checked })} 
              />
              <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-500 group-hover:after:scale-95 shadow-inner"></div>
            </div>
            <span className="text-xs text-slate-700 font-extrabold select-none group-hover:text-indigo-700 transition-colors">
              Páginas Numeradas
            </span>
          </label>

          <label className="flex items-center cursor-pointer space-x-3 group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={configChancela.incluirData} 
                onChange={(e) => setConfigChancela({ ...configChancela, incluirData: e.target.checked })} 
              />
              <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-500 group-hover:after:scale-95 shadow-inner"></div>
            </div>
            <span className="text-xs text-slate-700 font-extrabold select-none group-hover:text-indigo-700 transition-colors">
              Data e Hora
            </span>
          </label>

          <div className="flex items-center space-x-3 ml-auto border-l border-slate-200/80 pl-6">
            <label className="text-[10px] text-slate-500 font-extrabold select-none uppercase tracking-wider">Tamanho da Fonte (pt)</label>
            <div className="flex items-center bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setConfigChancela({ ...configChancela, tamanhoFonte: Math.max(6, configChancela.tamanhoFonte - 1) })}
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors font-bold text-sm cursor-pointer"
              >-</button>
              <div className="px-3 py-1.5 font-mono font-bold text-indigo-700 text-xs border-x border-slate-100 bg-indigo-50/30 min-w-[36px] text-center">
                {configChancela.tamanhoFonte}
              </div>
              <button 
                onClick={() => setConfigChancela({ ...configChancela, tamanhoFonte: Math.min(16, configChancela.tamanhoFonte + 1) })}
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors font-bold text-sm cursor-pointer"
              >+</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
