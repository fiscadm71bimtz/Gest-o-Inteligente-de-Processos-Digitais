/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, Database, FolderTree, Code2, ShieldAlert } from 'lucide-react';

export default function IntegrationGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlScript = `-- 1. TABELA DE TIPOS DE PROCESSO (CHECKLISTS MASTER)
CREATE TABLE tipos_processo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. TABELA DE REQUISITOS DE DOCUMENTOS DO CHECKLIST
CREATE TABLE requisitos_documento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_processo_id UUID REFERENCES tipos_processo(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. TABELA DE PROCESSOS (INSTÂNCIAS DE USUÁRIOS)
CREATE TABLE processos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_processo_id UUID REFERENCES tipos_processo(id) ON DELETE SET NULL,
  requerente_nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'rascunho' NOT NULL CHECK (status IN ('rascunho', 'unificado', 'salvo')),
  pdf_unificado_url TEXT,
  pdf_unificado_nome VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. TABELA DE DOCUMENTOS ANEXADOS
CREATE TABLE documentos_anexados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE NOT NULL,
  requisito_id UUID REFERENCES requisitos_documento(id) ON DELETE SET NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  url_storage TEXT NOT NULL, -- URL pública ou privada gerada pelo Supabase Storage
  extensao VARCHAR(10) NOT NULL,
  tamanho INTEGER NOT NULL, -- tamanho em bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. POLÍTICAS DE SEGURANÇA (RLS) - EXEMPLO DE ATIVAÇÃO
ALTER TABLE tipos_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitos_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_anexados ENABLE ROW LEVEL SECURITY;

-- Exemplo de política de leitura pública de checklists
CREATE POLICY "Leitura pública de tipos de processos" ON tipos_processo
  FOR SELECT TO public USING (true);

CREATE POLICY "Leitura pública de requisitos" ON requisitos_documento
  FOR SELECT TO public USING (true);

-- Exemplo de política para Processos (Apenas criadores podem gerenciar - adaptável com Auth)
CREATE POLICY "Gerenciamento livre de processos por qualquer usuário" ON processos
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Gerenciamento livre de anexos" ON documentos_anexados
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. CONFIGURAÇÃO DO BUCKET NO SUPABASE STORAGE
-- Certifique-se de criar dois buckets no Supabase Storage via painel web ou SQL:
--   a) 'documentos-brutos' (para arquivos individuais enviados)
--   b) 'processos-unificados' (para armazenar os PDFs consolidados finais)
-- Configure as políticas de acesso do storage para permitir leitura/escrita pública ou autenticada.
`;

  const structureText = `meu-projeto-unificador/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/            # Componentes reutilizáveis
│   │   ├── AdminPanel.tsx     # Gerenciamento de checklists pelo administrador
│   │   ├── UserPanel.tsx      # Preenchimento de processos e upload pelo usuário
│   │   └── UnifierEngine.tsx  # Motor de controle de unificação visual
│   ├── lib/
│   │   └── supabase.ts        # Inicialização do cliente Supabase
│   ├── utils/
│   │   └── pdfUnifier.ts      # Motor de chancelamento e mesclagem (pdf-lib)
│   ├── types/
│   │   └── index.ts           # Interfaces e Enums do TypeScript
│   ├── App.tsx                # Layout principal e gerenciador de abas
│   ├── index.css              # Estilos globais (Tailwind CSS)
│   └── main.tsx               # Ponto de entrada do React
├── supabase/                  # Migrações e configurações locais do Supabase
│   └── migrations/
│       └── 20260713_create_tables.sql
├── .env.local                 # Chaves de acesso privadas (Supabase URL, Anon Key, etc)
├── package.json               # Dependências do projeto (pdf-lib, @supabase/supabase-js)
├── tsconfig.json              # Configurações do TypeScript
└── vite.config.ts             # Configuração do Vite (ou next.config.js se Next.js)
`;

  const serverlessCode = `// Rota Serverless (Exemplo em Next.js API Route: /pages/api/unificar.ts ou /app/api/unificar/route.ts)
// Também aplicável a ambientes Node.js (Express, Fastify) rodando na Vercel

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Recomenda-se a chave service_role no backend para ignorar RLS se necessário
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { processoId, configChancela } = req.body;

  if (!processoId) {
    return res.status(400).json({ error: 'O ID do processo é obrigatório' });
  }

  try {
    // 1. Buscar dados do processo e seus anexos ordenados
    const { data: processo, error: errProc } = await supabase
      .from('processos')
      .select(\`
        *,
        documentos_anexados (
          id,
          nome_arquivo,
          url_storage,
          extensao,
          tamanho
        )
      \`)
      .eq('id', processoId)
      .single();

    if (errProc || !processo) {
      throw new Error('Processo não encontrado ou erro na busca.');
    }

    const anexos = processo.documentos_anexados;
    if (!anexos || anexos.length === 0) {
      throw new Error('Nenhum documento anexado a este processo.');
    }

    // 2. Criar o PDF unificado mestre no servidor
    const pdfUnificado = await PDFDocument.create();
    const fonteHelvetica = await pdfUnificado.embedFont(StandardFonts.Helvetica);
    const fonteHelveticaBold = await pdfUnificado.embedFont(StandardFonts.HelveticaBold);

    // 3. Iterar e fazer download de cada anexo do Supabase Storage
    for (const anexo of anexos) {
      // Extrair o path do arquivo no bucket do storage
      // Exemplo de URL: https://xyz.supabase.co/storage/v1/object/public/documentos-brutos/nome-arquivo.pdf
      // Extraímos o path relativo para baixar do storage
      const bucketName = 'documentos-brutos';
      const filePath = anexo.url_storage.split(\`/\${bucketName}/\`)[1];

      if (!filePath) continue;

      const { data: fileBlob, error: errDown } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (errDown || !fileBlob) {
        throw new Error(\`Falha ao baixar do Storage: \${anexo.nome_arquivo}\`);
      }

      const fileBuffer = await fileBlob.arrayBuffer();

      if (anexo.extensao === 'pdf') {
        const pdfOrigem = await PDFDocument.load(fileBuffer);
        const indices = pdfOrigem.getPageIndices();
        const paginasCopiadas = await pdfUnificado.copyPages(pdfOrigem, indices);
        paginasCopiadas.forEach((pag) => pdfUnificado.addPage(pag));
      } else {
        // Converte imagem para PDF de forma simples no servidor
        // Nota: No Node, você pode incorporar imagens diretamente via pdf-lib
        let imgEmbed;
        if (anexo.extensao === 'png') {
          imgEmbed = await pdfUnificado.embedPng(fileBuffer);
        } else {
          imgEmbed = await pdfUnificado.embedJpg(fileBuffer);
        }

        const larguraA4 = 595;
        const alturaA4 = 842;
        const page = pdfUnificado.addPage([larguraA4, alturaA4]);

        const maxW = larguraA4 - 80;
        const maxH = alturaA4 - 80;
        const scale = Math.min(maxW / imgEmbed.width, maxH / imgEmbed.height);

        page.drawImage(imgEmbed, {
          x: (larguraA4 - imgEmbed.width * scale) / 2,
          y: (alturaA4 - imgEmbed.height * scale) / 2,
          width: imgEmbed.width * scale,
          height: imgEmbed.height * scale,
        });
      }
    }

    // 4. Aplicar chancela e paginação sequencial
    const paginas = pdfUnificado.getPages();
    const totalPaginas = paginas.length;
    const corRubrica = rgb(0.1, 0.3, 0.7); // ou derivado da config

    for (let i = 0; i < totalPaginas; i++) {
      const page = paginas[i];
      const { width } = page.getSize();

      // Linha separadora de rodapé
      page.drawLine({
        start: { x: 35, y: 45 },
        end: { x: width - 35, y: 45 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Desenhar texto de rubrica
      const textoRubrica = configChancela.texto || 'CHANCELA DIGITAL';
      page.drawText(textoRubrica, {
        x: 35,
        y: 30,
        size: 9,
        font: fonteHelveticaBold,
        color: corRubrica,
      });

      // Desenhar página
      const textoPagina = \`Página \${i + 1} de \${totalPaginas}\`;
      page.drawText(textoPagina, {
        x: width - 35 - fonteHelvetica.widthOfTextAtSize(textoPagina, 8),
        y: 30,
        size: 8,
        font: fonteHelvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    // 5. Salvar o arquivo PDF unificado final
    const pdfBytes = await pdfUnificado.save();

    // 6. Fazer upload do PDF final unificado de volta para o Supabase Storage
    const finalFileName = \`unificados/processo_\${processoId}_\${Date.now()}.pdf\`;
    const { data: uploadData, error: errUp } = await supabase.storage
      .from('processos-unificados')
      .upload(finalFileName, Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (errUp || !uploadData) {
      throw new Error(\`Falha no upload do PDF unificado final: \${errUp?.message}\`);
    }

    // Obter URL pública do arquivo final
    const { data: { publicUrl } } = supabase.storage
      .from('processos-unificados')
      .getPublicUrl(finalFileName);

    // 7. Atualizar o registro do processo com o link do PDF unificado
    const { error: errUpdate } = await supabase
      .from('processos')
      .update({
        status: 'unificado',
        pdf_unificado_url: publicUrl,
        pdf_unificado_name: finalFileName.split('/').pop()
      })
      .eq('id', processoId);

    if (errUpdate) {
      throw new Error(\`Erro ao atualizar o status do processo: \${errUpdate.message}\`);
    }

    // Retorna com sucesso
    return res.status(200).json({
      success: true,
      message: 'Processo unificado e chancelado com sucesso!',
      pdfUrl: publicUrl,
      fileName: finalFileName.split('/').pop()
    });

  } catch (error: any) {
    console.error('Erro na unificação:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro desconhecido durante a unificação.'
    });
  }
}
`;

  return (
    <div className="bg-transparent" id="integration-guide-container">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Banner de Boas-vindas à Integração (Bento Premium Style) */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] rounded-3xl p-7 md:p-9 text-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] border border-slate-800">
          <div className="flex items-center space-x-3 mb-3">
            <div className="bg-indigo-500/10 p-2 rounded-2xl border border-indigo-500/20">
              <Database className="w-8 h-8 text-indigo-300" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">Guia de Implantação Real (Supabase & Vercel)</h2>
          </div>
          <p className="text-slate-300 max-w-3xl text-sm leading-relaxed font-medium">
            Aqui estão os artefatos técnicos completos necessários para implantar a aplicação na sua infraestrutura real de produção no Supabase e hospedar na Vercel de forma serverless.
          </p>
        </div>

        {/* Alerta de Segurança (Bento Rounded Style) */}
        <div className="bg-amber-50/60 border border-amber-200/60 p-5 rounded-3xl flex items-start space-x-4">
          <div className="bg-amber-100/80 p-2 rounded-xl text-amber-600">
            <ShieldAlert className="w-5 h-5 shrink-0" />
          </div>
          <div className="text-sm text-amber-800 leading-relaxed font-medium">
            <span className="font-extrabold uppercase text-xs tracking-wider block mb-1">Modo Sandbox Ativo:</span>
            Atualmente, esta aplicação funciona em um sandbox de simulação local na ausência das chaves no <code className="bg-amber-100/70 px-1.5 py-0.5 rounded-md font-mono text-xs font-bold">.env</code>. Adicione <code className="bg-amber-100/70 px-1.5 py-0.5 rounded-md font-mono text-xs font-bold">VITE_SUPABASE_URL</code> e <code className="bg-amber-100/70 px-1.5 py-0.5 rounded-md font-mono text-xs font-bold">VITE_SUPABASE_ANON_KEY</code> para conectar diretamente à sua infraestrutura Supabase real!
          </div>
        </div>

        {/* Grid com SQL Script e Estrutura de Pastas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Coluna SQL Script (Left - 7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[650px]">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100/80 mb-4 shrink-0">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">1. Script SQL do Banco de Dados</h3>
              </div>
              <button
                onClick={() => handleCopy(sqlScript, 'sql')}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {copiedSection === 'sql' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 shrink-0 font-medium leading-relaxed">
              Execute este script SQL no Editor de Queries do Supabase para criar as tabelas com relacionamentos, chaves estrangeiras, chaves primárias UUID e políticas de segurança RLS básicas.
            </p>
            <div className="flex-1 overflow-auto bg-slate-950 rounded-2xl p-4.5 font-mono text-xs text-slate-300 leading-relaxed border border-slate-900 select-all scrollbar-thin">
              <pre className="whitespace-pre">{sqlScript}</pre>
            </div>
          </div>

          {/* Coluna Estrutura de Pastas (Right - 5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[650px]">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100/80 mb-4 shrink-0">
              <div className="flex items-center space-x-2">
                <FolderTree className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">2. Estrutura de Pastas</h3>
              </div>
              <button
                onClick={() => handleCopy(structureText, 'struct')}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {copiedSection === 'struct' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 shrink-0 font-medium leading-relaxed">
              Arquitetura de diretórios recomendada para organizar este projeto em uma aplicação modular baseada em Vite ou Next.js.
            </p>
            <div className="flex-1 overflow-auto bg-slate-950 rounded-2xl p-4.5 font-mono text-xs text-indigo-300 leading-relaxed border border-slate-900 scrollbar-thin">
              <pre className="whitespace-pre">{structureText}</pre>
            </div>
          </div>
        </div>

        {/* Rota Serverless */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100/80">
            <div className="flex items-center space-x-2">
              <Code2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">3. Código da Rota Serverless / API de Unificação</h3>
            </div>
            <button
              onClick={() => handleCopy(serverlessCode, 'serverless')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {copiedSection === 'serverless' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-600">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Rota</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Se você preferir realizar a unificação pesada de arquivos no servidor para aliviar a banda do cliente, esta é a implementação completa de uma rota de API baseada em Node.js (Vercel Serverless / Next.js API Routes). Ela faz download de cada arquivo do Supabase Storage, processa as chancelas usando a biblioteca <code className="bg-slate-100 px-1.5 py-0.5 rounded-lg font-mono text-xs text-indigo-600 font-bold">pdf-lib</code> e atualiza o processo de volta no banco de dados.
          </p>
          <div className="bg-slate-950 rounded-2xl p-4.5 font-mono text-xs text-slate-300 leading-relaxed border border-slate-900 overflow-x-auto max-h-[400px] scrollbar-thin">
            <pre className="whitespace-pre">{serverlessCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
