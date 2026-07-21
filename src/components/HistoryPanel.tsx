import React, { useState, useEffect } from 'react';
import { History, FileDown, Layers, Search, Trash2 } from 'lucide-react';
import { Processo } from '../types';
import { supabase, isSupabaseConfigured, getLocalData, saveLocalData } from '../supabaseClient';

export default function HistoryPanel() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('processos')
          .select('*')
          .in('status', ['unificado', 'salvo'])
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          const mapped: Processo[] = data.map((p: any) => ({
            id: p.id,
            tipoProcessoId: p.tipo_processo_id,
            tipoProcessoTitulo: p.tipos_processo?.titulo || 'Processo Personalizado',
            requerenteNome: p.requerente_nome,
            cpfCnpj: p.cpf_cnpj,
            status: p.status,
            dataCriacao: new Date(p.created_at).toLocaleDateString('pt-BR'),
            pdfUnificadoUrl: p.pdf_unificado_url,
            pdfUnificadoNome: p.pdf_unificado_name,
            documentos: []
          }));
          setProcessos(mapped);
        }
      } catch (err) {
        console.warn('Erro ao carregar histórico do Supabase', err);
        loadLocalHistory();
      }
    } else {
      loadLocalHistory();
    }
  };

  const loadLocalHistory = () => {
    const local = getLocalData<Processo[]>('processos_usuario', []);
    const completed = local.filter(p => p.status === 'unificado' || p.status === 'salvo');
    setProcessos(completed);
  };

  const handleDeleteHistory = async (procId: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este registro do histórico? (Isso excluirá o processo)')) return;
    
    // Deletar localmente se aplicável
    const local = getLocalData<Processo[]>('processos_usuario', []);
    const updatedLocal = local.filter(p => p.id !== procId);
    saveLocalData('processos_usuario', updatedLocal);
    
    setProcessos(processos.filter(p => p.id !== procId));
    
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('processos').delete().eq('id', procId);
      } catch (err) {
        console.error('Erro ao deletar histórico no Supabase', err);
      }
    }
  };

  const filteredProcessos = processos.filter(p => 
    p.requerenteNome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.cpfCnpj && p.cpfCnpj.includes(searchTerm))
  );

  return (
    <div className="bg-transparent" id="history-container">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100/80 pb-4 gap-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Histórico de Processos Unificados
              </h3>
              <p className="text-xs text-slate-500 mt-1">Consulte e faça o download de todos os processos que já foram consolidados.</p>
            </div>
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProcessos.map((p) => (
              <div key={p.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/70 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-1 max-w-[80%]">
                    <h4 className="font-bold text-slate-850 text-sm truncate" title={p.requerenteNome}>{p.requerenteNome}</h4>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                      <span>{p.cpfCnpj || 'Sem CPF/CNPJ'}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteHistory(p.id)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Apagar Processo">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-500 font-medium truncate" title={p.tipoProcessoTitulo}>{p.tipoProcessoTitulo}</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                  <span className="text-[10px] text-slate-400 font-semibold">{p.dataCriacao}</span>
                  {p.pdfUnificadoUrl ? (
                    <a
                      href={p.pdfUnificadoUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={p.pdfUnificadoNome || `Processo_${p.id}.pdf`}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Baixar PDF
                    </a>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-md font-bold">Arquivo não salvo</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredProcessos.length === 0 && (
            <div className="text-center py-12">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum processo unificado encontrado.</p>
              {searchTerm && <p className="text-sm text-slate-400 mt-1">Tente ajustar a sua busca.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
