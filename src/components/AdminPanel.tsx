/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileText, CheckCircle2, ChevronRight, X, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { TipoProcesso, RequisitoDocumento } from '../types';
import { supabase, isSupabaseConfigured, getLocalData, saveLocalData } from '../supabaseClient';

const INITIAL_TEMPLATES: TipoProcesso[] = [
  {
    id: 'tp-1',
    titulo: 'Processo de Contratação CLT',
    descricao: 'Admissão de novos funcionários em regime de consolidação de leis trabalhistas.',
    dataCriacao: '13/07/2026',
    requisitos: [
      { id: 'req-1', nome: 'RG e CPF', descricao: 'Cópia nítida do documento de identidade frente e verso', obrigatorio: true },
      { id: 'req-2', nome: 'Carteira de Trabalho (CTPS)', descricao: 'Páginas de identificação e contratos de trabalho', obrigatorio: true },
      { id: 'req-3', nome: 'Comprovante de Residência', descricao: 'Conta de luz, água ou gás emitida nos últimos 3 meses', obrigatorio: true },
      { id: 'req-4', nome: 'Certificado de Escolaridade', descricao: 'Diploma ou histórico escolar do último nível de ensino', obrigatorio: false },
    ],
  },
  {
    id: 'tp-2',
    titulo: 'Processo de Reembolso de Despesas',
    descricao: 'Solicitação de ressarcimento de viagens corporativas ou gastos de representação.',
    dataCriacao: '13/07/2026',
    requisitos: [
      { id: 'req-5', nome: 'Relatório de Viagem', descricao: 'Formulário padrão assinado pelo gestor imediato', obrigatorio: true },
      { id: 'req-6', nome: 'Comprovantes / Notas Fiscais', descricao: 'Notas fiscais digitalizadas nítidas dos estabelecimentos', obrigatorio: true },
      { id: 'req-7', nome: 'Comprovante de Conta Bancária', descricao: 'Extrato ou print da conta para transferência do reembolso', obrigatorio: true },
    ],
  },
  {
    id: 'tp-3',
    titulo: 'Homologação de Fornecedores',
    descricao: 'Cadastro de novos fornecedores e prestadores de serviços para a corporação.',
    dataCriacao: '13/07/2026',
    requisitos: [
      { id: 'req-8', nome: 'Contrato Social ou Estatuto', descricao: 'Cópia da última alteração contratual consolidada', obrigatorio: true },
      { id: 'req-9', nome: 'Cartão CNPJ atualizado', descricao: 'Emissão recente no site da Receita Federal', obrigatorio: true },
      { id: 'req-10', nome: 'Certidão Negativa de Débitos Federais', descricao: 'CND conjunta de tributos federais e dívida ativa da união', obrigatorio: true },
      { id: 'req-11', nome: 'Inscrição Estadual / Municipal', descricao: 'Comprovante de cadastro de contribuinte municipal ou estadual', obrigatorio: false },
    ],
  },
];

interface AdminPanelProps {
  onTemplatesChange?: (templates: TipoProcesso[]) => void;
}

export default function AdminPanel({ onTemplatesChange }: AdminPanelProps) {
  const [templates, setTemplates] = useState<TipoProcesso[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TipoProcesso | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('checking');

  // Estado dos inputs do formulário de criação/edição
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formRequisitos, setFormRequisitos] = useState<RequisitoDocumento[]>([]);

  // Carregar dados
  useEffect(() => {
    const fetchTemplates = async () => {
      const isConfig = isSupabaseConfigured();
      if (isConfig && supabase) {
        setDbStatus('supabase');
        try {
          // Tentar carregar do Supabase
          const { data, error } = await supabase
            .from('tipos_processo')
            .select('*, requisitos:requisitos_documento(*)');
          
          if (error) {
            throw error;
          }
          
          if (data && data.length > 0) {
            // Mapear campos snake_case para camelCase
            const mapped: TipoProcesso[] = data.map((tp: any) => ({
              id: tp.id,
              titulo: tp.titulo,
              descricao: tp.descricao,
              dataCriacao: new Date(tp.created_at).toLocaleDateString('pt-BR'),
              requisitos: (tp.requisitos || []).map((req: any) => ({
                id: req.id,
                nome: req.nome,
                descricao: req.descricao || '',
                obrigatorio: req.obrigatorio,
              })),
            }));
            setTemplates(mapped);
            onTemplatesChange?.(mapped);
          } else {
            // Se o Supabase estiver limpo, seed com os templates iniciais
            setTemplates(INITIAL_TEMPLATES);
            onTemplatesChange?.(INITIAL_TEMPLATES);
          }
        } catch (err) {
          console.error('Erro ao ler do Supabase, usando local:', err);
          loadLocal();
        }
      } else {
        setDbStatus('local');
        loadLocal();
      }
    };

    const loadLocal = () => {
      const local = getLocalData<TipoProcesso[]>('tipos_processo_checklist', INITIAL_TEMPLATES);
      setTemplates(local);
      onTemplatesChange?.(local);
    };

    fetchTemplates();
  }, []);

  // Sincronizar modificações locais com o callback externo
  useEffect(() => {
    if (templates.length > 0) {
      onTemplatesChange?.(templates);
    }
  }, [templates]);

  const openNewForm = () => {
    setEditingTemplate(null);
    setFormTitulo('');
    setFormDescricao('');
    setFormRequisitos([
      { id: 'r-new-1', nome: 'RG ou CNH', descricao: 'Cópia nítida colorida', obrigatorio: true }
    ]);
    setIsAddingNew(true);
  };

  const openEditForm = (tp: TipoProcesso) => {
    setEditingTemplate(tp);
    setFormTitulo(tp.titulo);
    setFormDescricao(tp.descricao);
    setFormRequisitos([...tp.requisitos]);
    setIsAddingNew(true);
  };

  const handleAddRequisitoRow = () => {
    const newId = `r-new-${Date.now()}`;
    setFormRequisitos([
      ...formRequisitos,
      { id: newId, nome: '', descricao: '', obrigatorio: true }
    ]);
  };

  const handleRemoveRequisitoRow = (id: string) => {
    setFormRequisitos(formRequisitos.filter(r => r.id !== id));
  };

  const handleMoveRequisito = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formRequisitos.length - 1) return;

    const newRequisitos = [...formRequisitos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newRequisitos[index];
    newRequisitos[index] = newRequisitos[targetIndex];
    newRequisitos[targetIndex] = temp;
    
    setFormRequisitos(newRequisitos);
  };

  const handleRequisitoChange = (id: string, field: keyof RequisitoDocumento, value: any) => {
    setFormRequisitos(formRequisitos.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) return;

    // Validar requisitos
    const validRequisitos = formRequisitos.filter(r => r.nome.trim() !== '');
    if (validRequisitos.length === 0) {
      alert('Por favor, adicione pelo menos um requisito de documento com nome.');
      return;
    }

    const templateId = editingTemplate ? editingTemplate.id : `tp-${Date.now()}`;
    const dataCriacao = editingTemplate ? editingTemplate.dataCriacao : new Date().toLocaleDateString('pt-BR');

    const updatedTemplate: TipoProcesso = {
      id: templateId,
      titulo: formTitulo,
      descricao: formDescricao,
      dataCriacao,
      requisitos: validRequisitos.map((r, index) => ({
        id: r.id.startsWith('r-new-') ? `req-${Date.now()}-${index}` : r.id,
        nome: r.nome,
        descricao: r.descricao,
        obrigatorio: r.obrigatorio
      }))
    };

    let newTemplates = [...templates];

    if (editingTemplate) {
      newTemplates = templates.map(t => t.id === editingTemplate.id ? updatedTemplate : t);
    } else {
      newTemplates = [updatedTemplate, ...templates];
    }

    // Persistir dados
    setTemplates(newTemplates);
    saveLocalData('tipos_processo_checklist', newTemplates);

    // Salvar no Supabase se disponível
    if (dbStatus === 'supabase' && supabase) {
      try {
        const payload = {
          id: templateId,
          titulo: formTitulo,
          descricao: formDescricao,
          created_at: new Date().toISOString()
        };

        // Upsert do tipo de processo
        const { error: tpErr } = await supabase
          .from('tipos_processo')
          .upsert(payload);

        if (!tpErr) {
          // Deletar os requisitos antigos para recriar
          await supabase.from('requisitos_documento').delete().eq('tipo_processo_id', templateId);
          
          // Inserir os novos requisitos
          const reqPayload = updatedTemplate.requisitos.map(r => ({
            id: r.id,
            tipo_processo_id: templateId,
            nome: r.nome,
            descricao: r.descricao,
            obrigatorio: r.obrigatorio,
            created_at: new Date().toISOString()
          }));

          const { error: reqErr } = await supabase
            .from('requisitos_documento')
            .insert(reqPayload);
            
          if (reqErr) console.warn('Erro ao inserir requisitos no Supabase:', reqErr);
        } else {
          console.warn('Erro ao atualizar TipoProcesso no Supabase:', tpErr);
        }
      } catch (err) {
        console.error('Falha de rede Supabase:', err);
      }
    }

    setIsAddingNew(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este checklist de processo? Todos os processos associados serão afetados.')) {
      return;
    }

    const filtered = templates.filter(t => t.id !== id);
    setTemplates(filtered);
    saveLocalData('tipos_processo_checklist', filtered);

    if (dbStatus === 'supabase' && supabase) {
      try {
        await supabase.from('tipos_processo').delete().eq('id', id);
      } catch (err) {
        console.error('Erro de exclusão no Supabase:', err);
      }
    }
  };

  return (
    <div className="bg-transparent" id="admin-panel-container">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Gestão de Checklists Administrativos
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Crie checklists de documentos obrigatórios vinculados a diferentes tipos de processos da organização.
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center justify-center space-x-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-600/10 transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Checklist</span>
          </button>
        </div>

        {/* Database Indicator Status */}
        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200/60 text-xs shadow-sm shadow-slate-100/50">
          <div className="flex items-center space-x-2 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="font-medium text-slate-500">Persistência ativa:</span>
            <span className="font-bold text-slate-800">
              {dbStatus === 'supabase' ? 'Supabase Database Ativo (Real)' : 'Sandbox Local (Modo Demonstração Offline)'}
            </span>
          </div>
          <span className="text-[9px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-lg font-mono font-bold tracking-wide">
            SUPABASE v1
          </span>
        </div>

        {/* Form Overlay Modal / Card */}
        {isAddingNew && (
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_30px_-4px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="px-6 py-4.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {editingTemplate ? `Editar Checklist: ${editingTemplate.titulo}` : 'Criar Novo Tipo de Processo'}
              </h3>
              <button
                onClick={() => setIsAddingNew(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Título do Checklist *</label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ex: Reembolso de Despesas de Viagem"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Descrição Resumida</label>
                  <input
                    type="text"
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Descreva o propósito deste fluxo de documentos"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Requisitos Checklist Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-800 tracking-tight">Requisitos de Documentos</h4>
                  <button
                    type="button"
                    onClick={handleAddRequisitoRow}
                    className="flex items-center space-x-1.5 text-xs text-indigo-600 font-bold hover:text-indigo-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Documento</span>
                  </button>
                </div>

                {formRequisitos.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    Nenhum requisito de documento inserido. Clique em adicionar para começar.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {formRequisitos.map((req, index) => (
                      <div key={req.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                        <div className="col-span-1 flex flex-col items-center justify-center gap-1 font-mono text-xs font-extrabold text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleMoveRequisito(index, 'up')}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 p-0.5 rounded-md hover:bg-indigo-50 transition-all cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span>#{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleMoveRequisito(index, 'down')}
                            disabled={index === formRequisitos.length - 1}
                            className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 p-0.5 rounded-md hover:bg-indigo-50 transition-all cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            required
                            placeholder="Nome do Documento (ex: CNH)"
                            value={req.nome}
                            onChange={(e) => handleRequisitoChange(req.id, 'nome', e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Instrução / Detalhes (Opcional)"
                            value={req.descricao}
                            onChange={(e) => handleRequisitoChange(req.id, 'descricao', e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-center space-x-1.5">
                          <input
                            type="checkbox"
                            id={`obrigatorio-${req.id}`}
                            checked={req.obrigatorio}
                            onChange={(e) => handleRequisitoChange(req.id, 'obrigatorio', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <label htmlFor={`obrigatorio-${req.id}`} className="text-[11px] font-bold text-slate-500 select-none cursor-pointer">
                            Obrigatório
                          </label>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRequisitoRow(req.id)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {editingTemplate ? 'Salvar Alterações' : 'Gravar Checklist'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Checklists */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tp) => (
            <div
              key={tp.id}
              className="bg-white rounded-3xl border border-slate-200/60 p-6 flex flex-col justify-between hover:border-slate-350 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-2xl border border-indigo-100/30">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center space-x-1 bg-slate-50 border border-slate-100/60 px-2.5 py-1 rounded-xl text-[9px] text-slate-400 font-mono font-bold">
                    <span>Criado: {tp.dataCriacao}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-snug">
                    {tp.titulo}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 h-8 font-medium">
                    {tp.descricao || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                {/* Itens do Checklist Resumido */}
                <div className="space-y-2 pt-2">
                  <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase block">
                    Documentos Exigidos ({tp.requisitos.length})
                  </span>
                  <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                    {tp.requisitos.map((req) => (
                      <div key={req.id} className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${req.obrigatorio ? 'text-indigo-500' : 'text-slate-300'}`} />
                        <span className="truncate">{req.nome}</span>
                        {req.obrigatorio && (
                          <span className="text-[8px] text-rose-500 font-extrabold font-mono px-1.5 py-0.2 bg-rose-50 border border-rose-100/30 rounded uppercase tracking-wide">
                            OBR
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end space-x-2 pt-4 mt-5 border-t border-slate-100">
                <button
                  onClick={() => handleDeleteTemplate(tp.id)}
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer"
                  title="Excluir Tipo de Processo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditForm(tp)}
                  className="flex items-center space-x-1.5 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3 px-6 text-center">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-3xl border border-slate-100/50">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-extrabold text-slate-850 text-sm">Nenhum Checklist Cadastrado</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Crie seu primeiro checklist dinâmico clicando no botão "Novo Checklist" acima.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
