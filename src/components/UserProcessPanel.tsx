/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, UploadCloud, CheckCircle2, AlertCircle, Play, Download, 
  Trash2, FileDown, Layers, ChevronRight, Stamp, Check, RefreshCw, Eye
} from 'lucide-react';
import { TipoProcesso, Processo, DocumentoAnexo, RubricaConfig } from '../types';
import { unificarDocumentos } from '../utils/pdfUnifier';
import { supabase, isSupabaseConfigured, getLocalData, saveLocalData } from '../supabaseClient';

interface UserProcessPanelProps {
  templates: TipoProcesso[];
}

export default function UserProcessPanel({ templates }: UserProcessPanelProps) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [activeProcesso, setActiveProcesso] = useState<Processo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [requerenteNome, setRequerenteNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  
  // Configurações de Rubrica/Chancela
  const [configChancela, setConfigChancela] = useState<RubricaConfig>({
    texto: 'AUTENTICADO DIGITALMENTE',
    posicao: 'bottom-right',
    cor: '#1d4ed8', // Azul corporativo
    incluirData: true,
    incluirPagina: true,
    tamanhoFonte: 9,
  });

  // Estados de Unificação
  const [unificandoStatus, setUnificandoStatus] = useState<string>('');
  const [unificandoProgresso, setUnificandoProgresso] = useState<number>(0);
  const [isUnificando, setIsUnificando] = useState<boolean>(false);
  const [pdfUnificadoUrl, setPdfUnificadoUrl] = useState<string | null>(null);
  
  // Drag and Drop dragover states
  const [dragSlotId, setDragSlotId] = useState<string | null>(null);
  
  // Forçar atualização do input file
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Carregar processos já cadastrados
  useEffect(() => {
    const fetchProcessos = async () => {
      const isConfig = isSupabaseConfigured();
      if (isConfig && supabase) {
        try {
          const { data, error } = await supabase
            .from('processos')
            .select('*, documentos:documentos_anexados(*)');
          
          if (error) throw error;
          
          if (data && data.length > 0) {
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
              documentos: (p.documentos || []).map((d: any) => ({
                id: d.id,
                requisitoId: d.requisito_id,
                requisitoNome: d.requisito_nome || 'Documento',
                nomeArquivo: d.nome_arquivo,
                url: d.url_storage,
                extensao: d.extensao,
                dataUpload: new Date(d.created_at).toLocaleDateString('pt-BR'),
                tamanho: d.tamanho,
              })),
            }));
            setProcessos(mapped);
          } else {
            loadLocal();
          }
        } catch (err) {
          console.warn('Erro ao ler processos do Supabase, usando local:', err);
          loadLocal();
        }
      } else {
        loadLocal();
      }
    };

    const loadLocal = () => {
      const local = getLocalData<Processo[]>('processos_usuario', []);
      setProcessos(local);
    };

    fetchProcessos();
  }, [templates]);

  const handleStartCreate = () => {
    if (templates.length === 0) {
      alert('Nenhum tipo de processo foi configurado pelo administrador ainda.');
      return;
    }
    setIsCreating(true);
    setSelectedTemplateId(templates[0]?.id || '');
    setRequerenteNome('');
    setCpfCnpj('');
    setPdfUnificadoUrl(null);
  };

  const handleCreateProcessoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requerenteNome.trim() || !selectedTemplateId) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const novoProcesso: Processo = {
      id: `p-${Date.now()}`,
      tipoProcessoId: template.id,
      tipoProcessoTitulo: template.titulo,
      requerenteNome,
      cpfCnpj,
      status: 'rascunho',
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      documentos: []
    };

    const novosProcessos = [novoProcesso, ...processos];
    setProcessos(novosProcessos);
    saveLocalData('processos_usuario', novosProcessos);

    // Salvar no Supabase se ativo
    saveProcessoToSupabase(novoProcesso);

    setActiveProcesso(novoProcesso);
    setIsCreating(false);
  };

  const saveProcessoToSupabase = async (proc: Processo) => {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('processos').insert({
          id: proc.id,
          tipo_processo_id: proc.tipoProcessoId,
          requerente_nome: proc.requerenteNome,
          cpf_cnpj: proc.cpfCnpj,
          status: proc.status,
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Falha de inserção Supabase:', err);
      }
    }
  };

  const handleFileChange = (requisitoId: string, requisitoNome: string, files: FileList | null) => {
    if (!files || files.length === 0 || !activeProcesso) return;
    const file = files[0];
    
    // Validar tipo de arquivo
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    
    if (!isPdf && !isImage) {
      alert('Formato inválido! Por favor, faça upload apenas de arquivos PDF, JPG, JPEG ou PNG.');
      return;
    }

    const ext = isPdf ? 'pdf' : (file.name.split('.').pop()?.toLowerCase() as any || 'jpg');

    const reader = new FileReader();
    reader.onload = async () => {
      if (reader.result instanceof ArrayBuffer) {
        const novoDoc: DocumentoAnexo = {
          id: `doc-${Date.now()}`,
          requisitoId,
          requisitoNome,
          nomeArquivo: file.name,
          url: URL.createObjectURL(file), // Local Blob URL para visualização imediata
          extensao: ext,
          dataUpload: new Date().toLocaleDateString('pt-BR'),
          tamanho: file.size,
          bytes: reader.result // bytes armazenados localmente na memória para o unificador
        };

        const listAtualizada = [...activeProcesso.documentos, novoDoc];
        const procAtualizado = { ...activeProcesso, documentos: listAtualizada };
        
        setActiveProcesso(procAtualizado);
        
        const novosProcs = processos.map(p => p.id === activeProcesso.id ? procAtualizado : p);
        setProcessos(novosProcs);
        saveLocalData('processos_usuario', novosProcs);

        // Upload para Supabase Storage se conectado
        if (isSupabaseConfigured() && supabase) {
          try {
            // Upload do arquivo bruno no Storage
            const finalPath = `brutos/${activeProcesso.id}/${novoDoc.id}_${file.name}`;
            const { data, error } = await supabase.storage
              .from('documentos-brutos')
              .upload(finalPath, file, {
                contentType: file.type,
                upsert: true
              });
              
            if (!error && data) {
              const { data: { publicUrl } } = supabase.storage
                .from('documentos-brutos')
                .getPublicUrl(finalPath);
                
              // Atualizar banco de dados do anexo
              await supabase.from('documentos_anexados').insert({
                id: novoDoc.id,
                processo_id: activeProcesso.id,
                requisito_id: requisitoId,
                nome_arquivo: file.name,
                url_storage: publicUrl,
                extensao: ext,
                tamanho: file.size,
                created_at: new Date().toISOString()
              });
            } else {
              console.warn('Erro ao salvar no Storage do Supabase:', error);
            }
          } catch (err) {
            console.error('Supabase Storage erro:', err);
          }
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragSlotId(id);
  };

  const handleDragLeave = () => {
    setDragSlotId(null);
  };

  const handleDrop = (e: React.DragEvent, reqId: string, reqNome: string) => {
    e.preventDefault();
    setDragSlotId(null);
    if (e.dataTransfer.files) {
      handleFileChange(reqId, reqNome, e.dataTransfer.files);
    }
  };

  const handleRemoveAnexo = async (docId: string) => {
    if (!activeProcesso) return;
    
    const filt = activeProcesso.documentos.filter(d => d.id !== docId);
    const procAtualizado = { ...activeProcesso, documentos: filt };
    
    setActiveProcesso(procAtualizado);
    const novosProcs = processos.map(p => p.id === activeProcesso.id ? procAtualizado : p);
    setProcessos(novosProcs);
    saveLocalData('processos_usuario', novosProcs);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('documentos_anexados').delete().eq('id', docId);
      } catch (err) {
        console.error('Erro de exclusão no Supabase:', err);
      }
    }
  };

  const handleDeleteProcesso = async (procId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Excluir este processo e todos os seus anexos definitivamente?')) return;

    const filt = processos.filter(p => p.id !== procId);
    setProcessos(filt);
    saveLocalData('processos_usuario', filt);
    
    if (activeProcesso?.id === procId) {
      setActiveProcesso(null);
      setPdfUnificadoUrl(null);
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('processos').delete().eq('id', procId);
      } catch (err) {
        console.error('Erro de exclusão do processo no Supabase:', err);
      }
    }
  };

  // Executar motor de unificação com pdf-lib
  const handleUnificarProcesso = async () => {
    if (!activeProcesso || activeProcesso.documentos.length === 0) return;
    
    // Validar se documentos obrigatórios estão presentes
    const template = templates.find(t => t.id === activeProcesso.tipoProcessoId);
    if (template) {
      const obrigatoriosFaltando = template.requisitos
        .filter(r => r.obrigatorio)
        .filter(r => !activeProcesso.documentos.some(d => d.requisitoId === r.id));
        
      if (obrigatoriosFaltando.length > 0) {
        const nomesFaltantes = obrigatoriosFaltando.map(r => r.nome).join(', ');
        if (!window.confirm(`Atenção! Faltam documentos obrigatórios exigidos no checklist: [${nomesFaltantes}]. Deseja continuar com a unificação mesmo assim?`)) {
          return;
        }
      }
    }

    setIsUnificando(true);
    setUnificandoProgresso(10);
    setUnificandoStatus('Lendo e compilando documentos anexados...');

    try {
      // Executa o motor client-side pdfUnifier
      const { pdfBytes, totalPaginas } = await unificarDocumentos(
        activeProcesso.documentos,
        configChancela,
        (status, prog) => {
          setUnificandoStatus(status);
          setUnificandoProgresso(prog);
        }
      );

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUnificadoUrl(url);

      // Atualiza estado do processo como unificado
      const procAtualizado: Processo = {
        ...activeProcesso,
        status: 'unificado',
        pdfUnificadoUrl: url,
        pdfUnificadoNome: `PROCESSO_UNIFICADO_${activeProcesso.requerenteNome.replace(/\s+/g, '_').toUpperCase()}_${Date.now().toString().slice(-4)}.pdf`,
        pdfUnificadoBytes: pdfBytes
      };

      setActiveProcesso(procAtualizado);
      const novosProcs = processos.map(p => p.id === activeProcesso.id ? procAtualizado : p);
      setProcessos(novosProcs);
      saveLocalData('processos_usuario', novosProcs);

      // Salvar no Supabase Storage se configurado
      if (isSupabaseConfigured() && supabase && procAtualizado.pdfUnificadoNome) {
        setUnificandoStatus('Salvando PDF unificado final no Supabase Storage...');
        setUnificandoProgresso(95);

        const filePath = `unificados/${activeProcesso.id}/${procAtualizado.pdfUnificadoNome}`;
        const { data, error } = await supabase.storage
          .from('processos-unificados')
          .upload(filePath, blob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('processos-unificados')
            .getPublicUrl(filePath);

          // Atualizar o registro no Banco de Dados
          await supabase.from('processos')
            .update({
              status: 'salvo',
              pdf_unificado_url: publicUrl,
              pdf_unificado_name: procAtualizado.pdfUnificadoNome
            })
            .eq('id', activeProcesso.id);

          const procSalvo: Processo = {
            ...procAtualizado,
            status: 'salvo',
            pdfUnificadoUrl: publicUrl
          };

          setActiveProcesso(procSalvo);
          setProcessos(processos.map(p => p.id === activeProcesso.id ? procSalvo : p));
        } else {
          console.warn('Erro ao salvar PDF final no Supabase:', error);
        }
      }

    } catch (error: any) {
      console.error(error);
      alert('Ocorreu um erro durante a unificação dos PDFs: ' + error.message);
    } finally {
      setIsUnificando(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Buscar template ativo
  const templateAtivo = activeProcesso ? templates.find(t => t.id === activeProcesso.tipoProcessoId) : null;

  return (
    <div className="bg-transparent" id="user-process-container">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Lado Esquerdo - Lista de Processos e Criador (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100/80">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Processos Ativos
              </h3>
              <button
                onClick={handleStartCreate}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-md shadow-indigo-600/10 active:scale-95 flex items-center gap-1"
              >
                <span>Novo</span>
              </button>
            </div>

            {/* Criador de Processo */}
            {isCreating && (
              <form onSubmit={handleCreateProcessoSubmit} className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/50 space-y-4.5 animate-in fade-in slide-in-from-top-3 duration-250">
                <h4 className="text-xs font-extrabold text-slate-800 tracking-tight">Criar Novo Processo</h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Nome do Requerente *</label>
                  <input
                    type="text"
                    required
                    value={requerenteNome}
                    onChange={(e) => setRequerenteNome(e.target.value)}
                    placeholder="Nome completo ou Razão Social"
                    className="w-full text-xs px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="Apenas números"
                    className="w-full text-xs px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Checklist Exigido</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.titulo}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all"
                  >
                    Criar
                  </button>
                </div>
              </form>
            )}

            {/* Listagem */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {processos.map((p) => {
                const isActive = activeProcesso?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActiveProcesso(p);
                      setPdfUnificadoUrl(p.pdfUnificadoUrl || null);
                    }}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex justify-between items-start group/item ${
                      isActive 
                        ? 'bg-gradient-to-br from-indigo-50/60 to-indigo-50/20 border-indigo-200 shadow-sm shadow-indigo-600/5' 
                        : 'bg-white hover:bg-slate-50 border-slate-200/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5 max-w-[85%]">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-bold text-slate-900 text-xs truncate block">{p.requerenteNome}</span>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-mono font-extrabold shrink-0 uppercase tracking-wide border ${
                          p.status === 'salvo' 
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : (p.status === 'unificado' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100')
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate font-medium">{p.tipoProcessoTitulo}</span>
                      <div className="flex items-center space-x-2 text-[9px] text-slate-400 font-medium">
                        <span>CNPJ/CPF: {p.cpfCnpj || 'Não Inf.'}</span>
                        <span>•</span>
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-mono font-semibold">Docs: {p.documentos?.length || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProcesso(p.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {processos.length === 0 && !isCreating && (
                <div className="text-center py-14 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs px-4">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-500 mb-0.5">Nenhum processo gerado</p>
                  <p className="text-[10px] text-slate-450">Clique em "Novo Processo" para começar.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito - Detalhes, Checklist de Envio e Chancelamento (8 cols) */}
        <div className="lg:col-span-8">
          {activeProcesso ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* Processo Header Card (Bento Big Box) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 gap-2">
                  <div>
                    <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100/20 inline-block mb-1.5">
                      Processo Selecionado
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 leading-tight">
                      Requerente: {activeProcesso.requerenteNome}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Checklist Associado: <span className="font-semibold text-slate-850 underline decoration-indigo-500/30">{activeProcesso.tipoProcessoTitulo}</span>
                    </p>
                  </div>
                  <div className="text-left md:text-right flex flex-row md:flex-col gap-2 md:gap-0.5 font-mono text-[9px] text-slate-400 font-semibold bg-slate-50 p-2 rounded-xl md:bg-transparent md:p-0">
                    <span>Criado em: {activeProcesso.dataCriacao}</span>
                    <span className="hidden md:inline">ID: {activeProcesso.id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block">Documentos</span>
                    <span className="font-extrabold text-slate-900 text-base mt-0.5 block">{activeProcesso.documentos.length}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block">Chancela Ativa</span>
                    <span className="font-extrabold text-slate-900 text-xs mt-1.5 block truncate max-w-full px-1">
                      {configChancela.texto ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center col-span-2">
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block">Status do Arquivo Final</span>
                    <span className="font-extrabold mt-1 block">
                      {activeProcesso.status === 'rascunho' && (
                        <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">RASCUNHO BRUTO</span>
                      )}
                      {activeProcesso.status === 'unificado' && (
                        <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">UNIFICADO LOCAL</span>
                      )}
                      {activeProcesso.status === 'salvo' && (
                        <span className="text-green-600 bg-green-50 border border-green-100 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">SALVO NO SUPABASE</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload Checklist Grid (Bento Box) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Documentos Exigidos no Checklist
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Faça o upload de cada item para habilitar a consolidação final.</p>
                </div>

                {templateAtivo ? (
                  <div className="space-y-4.5">
                    {templateAtivo.requisitos.map((req) => {
                      // Buscar se já tem anexo para esse requisito
                      const anexo = activeProcesso.documentos.find(d => d.requisitoId === req.id);

                      return (
                        <div key={req.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="space-y-1 max-w-full md:max-w-[55%]">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-bold text-slate-900 text-xs">{req.nome}</span>
                              {req.obrigatorio && (
                                <span className="text-[8px] bg-rose-50 text-rose-500 font-extrabold border border-rose-100 px-1.5 py-0.2 rounded-full font-mono uppercase tracking-wide">
                                  OBRIGATÓRIO
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{req.descricao || 'Faça upload do documento solicitado.'}</p>
                          </div>

                          {/* Slot de Upload ou Status do Arquivo Anexado */}
                          <div className="w-full md:w-auto min-w-[250px] md:max-w-[320px]">
                            {anexo ? (
                              <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-sm/5">
                                <div className="flex items-center space-x-2.5 truncate max-w-[80%]">
                                  <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="truncate">
                                    <span className="text-xs font-bold text-slate-850 truncate block">{anexo.nomeArquivo}</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-medium block">
                                      {anexo.extensao.toUpperCase()} • {formatSize(anexo.tamanho)}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveAnexo(anexo.id)}
                                  className="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                  title="Remover anexo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onDragOver={(e) => handleDragOver(e, req.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, req.id, req.nome)}
                                onClick={() => fileInputRefs.current[req.id]?.click()}
                                className={`border-2 border-dashed rounded-2xl p-3.5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-1.5 ${
                                  dragSlotId === req.id
                                    ? 'border-indigo-500 bg-indigo-50/50'
                                    : 'border-slate-200/70 hover:border-indigo-400 hover:bg-white bg-white'
                                }`}
                              >
                                <UploadCloud className="w-5 h-5 text-indigo-500" />
                                <div className="text-[11px] text-slate-600 font-medium">
                                  <span className="font-bold text-indigo-600">Arraste ou clique</span> para enviar
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono font-medium">PDF, PNG ou JPG</span>
                                <input
                                  type="file"
                                  ref={(el) => { fileInputRefs.current[req.id] = el; }}
                                  onChange={(e) => handleFileChange(req.id, req.nome, e.target.files)}
                                  accept="application/pdf, image/jpeg, image/jpg, image/png"
                                  className="hidden"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    Template de checklist não configurado. Adicione-o no Painel Administrativo.
                  </div>
                )}
              </div>

              {/* PDF Unification / Stamp Customizer Pane (Bento Box) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-6">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
                    <Stamp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Selo de Chancela & Autenticação Digital
                    </h3>
                    <p className="text-[11px] text-slate-400">Configure as informações que serão gravadas sequencialmente em cada página do PDF.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Texto de Autenticação</label>
                    <input
                      type="text"
                      value={configChancela.texto}
                      onChange={(e) => setConfigChancela({ ...configChancela, texto: e.target.value })}
                      placeholder="Ex: COPIA FIEL DO ORIGINAL"
                      className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Posição na Página</label>
                    <select
                      value={configChancela.posicao}
                      onChange={(e) => setConfigChancela({ ...configChancela, posicao: e.target.value as any })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                    >
                      <option value="bottom-right">Rodapé Direito</option>
                      <option value="bottom-left">Rodapé Esquerdo</option>
                      <option value="bottom-center">Rodapé Centralizado</option>
                      <option value="top-right">Cabeçalho Direito</option>
                      <option value="top-left">Cabeçalho Esquerdo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Cor do Selo</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={configChancela.cor}
                        onChange={(e) => setConfigChancela({ ...configChancela, cor: e.target.value })}
                        className="w-9 h-9 rounded-xl border border-slate-200 p-0 cursor-pointer overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={configChancela.cor}
                        onChange={(e) => setConfigChancela({ ...configChancela, cor: e.target.value })}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-mono font-semibold text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-5 items-center bg-slate-50/60 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="incluirPagina"
                      checked={configChancela.incluirPagina}
                      onChange={(e) => setConfigChancela({ ...configChancela, incluirPagina: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500/10 cursor-pointer"
                    />
                    <label htmlFor="incluirPagina" className="text-xs text-slate-600 font-bold select-none cursor-pointer">
                      Páginas Numeradas ("Página X de Y")
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="incluirData"
                      checked={configChancela.incluirData}
                      onChange={(e) => setConfigChancela({ ...configChancela, incluirData: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500/10 cursor-pointer"
                    />
                    <label htmlFor="incluirData" className="text-xs text-slate-600 font-bold select-none cursor-pointer">
                      Incluir Data/Hora de Chancela
                    </label>
                  </div>

                  <div className="flex items-center space-x-2 ml-auto">
                    <label className="text-xs text-slate-500 font-extrabold select-none uppercase tracking-wider">Tamanho (pt):</label>
                    <input
                      type="number"
                      min="6"
                      max="14"
                      value={configChancela.tamanhoFonte}
                      onChange={(e) => setConfigChancela({ ...configChancela, tamanhoFonte: parseInt(e.target.value) || 9 })}
                      className="w-14 px-2 py-1 border border-slate-250 rounded-xl text-center font-mono font-bold"
                    />
                  </div>
                </div>

                {/* BOTÃO UNIFICAR */}
                <div className="pt-2 flex justify-center md:justify-end">
                  <button
                    onClick={handleUnificarProcesso}
                    disabled={activeProcesso.documentos.length === 0}
                    className={`flex items-center space-x-2 px-7 py-3.5 text-white text-xs font-bold rounded-2xl shadow-md transition-all ${
                      activeProcesso.documentos.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-600/10 active:scale-[0.98] cursor-pointer'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Gerar Processo Unificado e Chancelado</span>
                  </button>
                </div>
              </div>

              {/* Progress and status indicator */}
              {isUnificando && (
                <div className="bg-white p-6 rounded-3xl border border-indigo-150 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                      {unificandoStatus}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{unificandoProgresso}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${unificandoProgresso}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Preview e Download Section (Bento Box Green Accent) */}
              {pdfUnificadoUrl && (
                <div className="bg-white p-6 rounded-3xl border border-emerald-100 bg-emerald-50/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 gap-4 flex-wrap">
                    <div className="flex items-center space-x-3">
                      <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">PDF Unificado Gerado com Sucesso!</h3>
                        <p className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">{activeProcesso.pdfUnificadoNome}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={pdfUnificadoUrl}
                        download={activeProcesso.pdfUnificadoNome || 'processo_unificado.pdf'}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/10 cursor-pointer transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </a>
                    </div>
                  </div>

                  {/* Visualizer Frame */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Visualização do Documento Consolidado</span>
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-100/60 flex items-center justify-center h-[550px] shadow-inner">
                      <iframe
                        src={`${pdfUnificadoUrl}#toolbar=0`}
                        title="Visualização do PDF"
                        className="w-full h-full border-none"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white py-28 rounded-3xl border border-slate-200/60 flex flex-col items-center justify-center text-center space-y-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] px-6">
              <div className="bg-slate-50 text-indigo-400 p-4 rounded-3xl border border-slate-100/50">
                <FileDown className="w-10 h-10" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="font-extrabold text-slate-900 text-sm">Nenhum Processo Ativo</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Selecione um processo cadastrado na lista lateral esquerda para carregar o checklist de envio de documentos e gerar o PDF final unificado, ou crie um novo.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
