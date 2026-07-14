/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RequisitoDocumento {
  id: string;
  nome: string;
  descricao: string;
  obrigatorio: boolean;
}

export interface TipoProcesso {
  id: string;
  titulo: string;
  descricao: string;
  dataCriacao: string;
  requisitos: RequisitoDocumento[];
}

export interface DocumentoAnexo {
  id: string;
  requisitoId: string;
  requisitoNome: string;
  nomeArquivo: string;
  url: string; // URL do Supabase Storage ou Blob URL local
  extensao: 'pdf' | 'jpg' | 'jpeg' | 'png';
  dataUpload: string;
  tamanho: number; // em bytes
  bytes?: ArrayBuffer; // Armazenado localmente em memória para demonstração offline
}

export interface Processo {
  id: string;
  tipoProcessoId: string;
  tipoProcessoTitulo: string;
  requerenteNome: string;
  cpfCnpj: string;
  status: 'rascunho' | 'unificado' | 'salvo';
  dataCriacao: string;
  documentos: DocumentoAnexo[];
  pdfUnificadoUrl?: string; // URL do PDF final unificado no Supabase Storage ou Blob URL
  pdfUnificadoNome?: string;
  pdfUnificadoBytes?: ArrayBuffer;
}

export interface RubricaConfig {
  texto: string;
  posicao: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left';
  posicaoPagina: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left';
  cor: string; // Hexadecimal ou RGB
  incluirData: boolean;
  incluirPagina: boolean;
  tamanhoFonte: number;
}
