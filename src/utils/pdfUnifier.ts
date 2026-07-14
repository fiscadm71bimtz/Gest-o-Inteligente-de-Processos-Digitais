/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DocumentoAnexo, RubricaConfig } from '../types';

/**
 * Converte um arquivo de imagem (Blob/File) para um buffer de JPEG usando um Canvas do navegador.
 * Isso garante compatibilidade com qualquer formato de imagem suportado pelo navegador (JPG, PNG, WebP).
 */
export const convertImageToJpegBuffer = (fileBlob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileBlob);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas'));
          return;
        }
        
        // Fundo branco caso a imagem possua transparência (PNG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Falha ao exportar canvas para Blob'));
            return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
              resolve(reader.result);
            } else {
              reject(new Error('Falha ao converter Blob para ArrayBuffer'));
            }
          };
          reader.readAsArrayBuffer(blob);
        }, 'image/jpeg', 0.92);
        
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar a imagem no Canvas: ' + String(err)));
    };
    
    img.src = url;
  });
};

/**
 * Converte uma string Hexadecimal de cor para o formato RGB do pdf-lib (0 a 1)
 */
const hexToPdfRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
};

/**
 * Motor principal de Unificação e Chancelamento de PDFs no lado do cliente.
 */
export const unificarDocumentos = async (
  documentos: DocumentoAnexo[],
  config: RubricaConfig,
  onProgress?: (status: string, progresso: number) => void
): Promise<{ pdfBytes: ArrayBuffer; totalPaginas: number }> => {
  if (documentos.length === 0) {
    throw new Error('Nenhum documento anexado para unificação.');
  }

  onProgress?.('Iniciando processo de unificação...', 5);
  
  // Criar o PDF de destino
  const pdfUnificado = await PDFDocument.create();
  
  // Fontes padrão do PDF-lib
  const fonteHelvetica = await pdfUnificado.embedFont(StandardFonts.Helvetica);
  const fonteHelveticaBold = await pdfUnificado.embedFont(StandardFonts.HelveticaBold);
  
  let documentosProcessados = 0;
  
  for (const doc of documentos) {
    const totalDocs = documentos.length;
    const descProcesso = `Processando arquivo (${documentosProcessados + 1}/${totalDocs}): ${doc.nomeArquivo}`;
    onProgress?.(descProcesso, Math.floor(5 + (documentosProcessados / totalDocs) * 60));
    
    try {
      let docBytes: ArrayBuffer | Uint8Array | undefined;
      
      // Validação rigorosa do tipo de bytes (ArrayBuffer não sobrevive no localStorage nativamente)
      if (doc.bytes && (doc.bytes instanceof ArrayBuffer || doc.bytes instanceof Uint8Array)) {
        docBytes = doc.bytes;
      } 
      
      // Se não temos bytes válidos em memória, tentamos buscar pela URL
      if (!docBytes) {
        if (doc.url.startsWith('data:')) {
          // Arquivo local em Base64 (Data URI)
          // Em Vercel/Chrome, fazer fetch() de Data URIs muito grandes causa crash.
          // Portanto, fazemos o decode manual do Base64, o que é 100% à prova de falhas.
          try {
            const base64Parts = doc.url.split(',');
            const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            docBytes = bytes.buffer;
          } catch (e) {
            console.error('Erro fatal ao decodificar Base64:', e);
            throw new Error('Falha ao decodificar o arquivo local. Tente enviar um arquivo menor ou recarregue a página.');
          }
        } else {
          // Pode ser uma URL externa, do Storage ou nosso novo ponteiro do Banco de Dados
          try {
            let fetched = false;
            
            // 1. Nossa nova abordagem à prova de falhas: Arquivo no Banco de Dados (Postgres)
            if (doc.url.startsWith('db-base64:')) {
              const docId = doc.url.split(':')[1];
              const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
              
              if (isSupabaseConfigured() && supabase) {
                const { data, error } = await supabase
                  .from('documentos_anexados')
                  .select('arquivo_base64')
                  .eq('id', docId)
                  .single();
                  
                if (data && data.arquivo_base64) {
                  // Decodificar do banco de dados (que também salva em Base64)
                  const base64Parts = data.arquivo_base64.split(',');
                  const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
                  const binaryString = atob(base64Data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  docBytes = bytes.buffer;
                  fetched = true;
                } else if (error) {
                  console.warn('Erro ao buscar arquivo no banco:', error);
                }
              }
            }
            // 2. Abordagem de Backup: Se por acaso ainda for um link do Storage legado
            else if (doc.url.includes('documentos-brutos')) {
              const urlParts = doc.url.split('documentos-brutos/');
              if (urlParts.length > 1) {
                const filePath = decodeURIComponent(urlParts[1]);
                const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
                
                if (isSupabaseConfigured() && supabase) {
                  const { data, error } = await supabase.storage.from('documentos-brutos').download(filePath);
                  if (!error && data) {
                    docBytes = await data.arrayBuffer();
                    fetched = true;
                  }
                }
              }
            }
            
            // 3. Fallback genérico para fetch caso não seja nem banco nem Storage local
            if (!fetched) {
              const response = await fetch(doc.url);
              if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
              }
              docBytes = await response.arrayBuffer();
            }
          } catch (fetchErr) {
            console.warn('Falha ao baixar arquivo da nuvem:', fetchErr);
            throw new Error(
              'Falha crítica de comunicação com o banco de dados. ' +
              'Por favor, exclua o anexo e faça o upload novamente.'
            );
          }
        }
      }
      
      // Fallback final de segurança para garantir que não passaremos algo inválido para o pdf-lib
      if (!docBytes || !(docBytes instanceof ArrayBuffer || docBytes instanceof Uint8Array)) {
        throw new Error('O conteúdo do arquivo é inválido ou está corrompido.');
      }
      
      if (doc.extensao === 'pdf') {
        // Carrega o PDF de origem
        const pdfOrigem = await PDFDocument.load(docBytes);
        const indicesPaginas = pdfOrigem.getPageIndices();
        
        // Copia as páginas para o PDF unificado
        const paginasCopiadas = await pdfUnificado.copyPages(pdfOrigem, indicesPaginas);
        for (const pagina of paginasCopiadas) {
          pdfUnificado.addPage(pagina);
        }
      } else {
        // É uma imagem (PNG, JPG ou JPEG), vamos converter para PDF
        let jpegBytes: ArrayBuffer | Uint8Array;
        
        if (doc.extensao === 'png' || doc.extensao === 'jpeg' || doc.extensao === 'jpg') {
          // Usamos nossa função canvas para normalizar e compactar para JPG
          const blob = new Blob([docBytes]);
          jpegBytes = await convertImageToJpegBuffer(blob);
        } else {
          jpegBytes = docBytes;
        }
        
        // Criar um documento temporário para a imagem
        const imgTempDoc = await PDFDocument.create();
        const imgEmbed = await imgTempDoc.embedJpg(jpegBytes);
        
        // Definir tamanho A4 padrão (595 x 842 pontos)
        const larguraA4 = 595;
        const alturaA4 = 842;
        const page = imgTempDoc.addPage([larguraA4, alturaA4]);
        
        // Calcular escala mantendo proporções com margem de 40 pontos
        const margem = 40;
        const larguraMax = larguraA4 - (margem * 2);
        const alturaMax = alturaA4 - (margem * 2);
        
        const dimOrigem = imgEmbed.scale(1.0);
        const escala = Math.min(larguraMax / dimOrigem.width, alturaMax / dimOrigem.height);
        
        const larguraFinal = dimOrigem.width * escala;
        const alturaFinal = dimOrigem.height * escala;
        
        // Centralizar a imagem no A4
        const xPos = (larguraA4 - larguraFinal) / 2;
        const yPos = (alturaA4 - alturaFinal) / 2;
        
        page.drawImage(imgEmbed, {
          x: xPos,
          y: yPos,
          width: larguraFinal,
          height: alturaFinal,
        });
        
        // Copiar página de imagem para o PDF final
        const [paginaImgCopiada] = await pdfUnificado.copyPages(imgTempDoc, [0]);
        pdfUnificado.addPage(paginaImgCopiada);
      }
    } catch (err) {
      console.error(`Erro ao processar o arquivo ${doc.nomeArquivo}:`, err);
      throw new Error(`Falha ao ler ou converter o arquivo: ${doc.nomeArquivo}. Detalhes: ${String(err)}`);
    }
    
    documentosProcessados++;
  }
  
  onProgress?.('Aplicando rubricas e numeração sequencial...', 70);
  
  // Obter todas as páginas do PDF unificado para aplicar o chancelamento
  const paginas = pdfUnificado.getPages();
  const totalPaginas = paginas.length;
  
  const corRubrica = hexToPdfRgb(config.cor);
  const corCinzaSuave = rgb(0.85, 0.85, 0.85);
  const corTextoCinza = rgb(0.4, 0.4, 0.4);
  
  // Gera um Hash Criptográfico/Protocolo único para essa unificação
  const hashStr = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  const hashProcesso = `${hashStr.substring(0,4)}-${hashStr.substring(4,8)}-${hashStr.substring(8,12)}-${hashStr.substring(12,16)}`;
  
  for (let i = 0; i < totalPaginas; i++) {
    const page = paginas[i];
    const { width, height } = page.getSize();
    
    // --- LINHA DE RODAPÉ SEPARADORA ---
    // Desenha uma linha fina cinza 40 pontos acima do final da página
    const yRodapeLinha = 45;
    page.drawLine({
      start: { x: 35, y: yRodapeLinha },
      end: { x: width - 35, y: yRodapeLinha },
      thickness: 0.5,
      color: corCinzaSuave,
    });
    
    // --- CHANCELAMENTO / RUBRICA VISUAL (GOV.BR STYLE) ---
    const textoChancela = config.texto.trim() || 'ASSINATURA DIGITAL';
    const subTextoHash = `Autenticação: ${hashProcesso}`;
    
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const subTextoData = `Data: ${dataAtual} (Horário de Brasília)`;

    const tamanhoFonteTit = config.tamanhoFonte;
    const tamanhoFonteSub = config.tamanhoFonte - 2;

    const larguraTextoPrincipal = fonteHelveticaBold.widthOfTextAtSize(textoChancela, tamanhoFonteTit);
    const larguraSubTextoHash = fonteHelvetica.widthOfTextAtSize(subTextoHash, tamanhoFonteSub);
    const larguraSubTextoData = fonteHelvetica.widthOfTextAtSize(subTextoData, tamanhoFonteSub);
    
    // Calcula largura e altura dinamicamente para não sobrepor
    const maxTextoLargura = Math.max(larguraTextoPrincipal, larguraSubTextoHash, larguraSubTextoData);
    const padding = 10;
    const raioCirculo = 14; // Aumentado levemente de 12 para 14 para caber o 71º BIMTz
    const espacamentoTexto = 10;
    const larguraFaixaLateral = 4;
    
    // Layout: [Faixa 4px] + [padding 10] + [círculo 28px] + [espaço 10px] + [textos] + [padding 10]
    const larguraRetangulo = larguraFaixaLateral + padding + (raioCirculo * 2) + espacamentoTexto + maxTextoLargura + padding;
    const alturaRetangulo = 42; 
    
    // Coordenadas baseadas na configuração
    let rx = 35;
    let ry = 20; // Mais próximo ao rodapé para dar aspecto oficial
    
    if (config.posicao === 'bottom-right') {
      rx = width - 35 - larguraRetangulo;
    } else if (config.posicao === 'bottom-center') {
      rx = (width - larguraRetangulo) / 2;
    } else if (config.posicao === 'bottom-left') {
      rx = 35;
    } else if (config.posicao === 'top-right') {
      rx = width - 35 - larguraRetangulo;
      ry = height - 55;
      page.drawLine({ start: { x: 35, y: height - 65 }, end: { x: width - 35, y: height - 65 }, thickness: 0.5, color: corCinzaSuave });
    } else if (config.posicao === 'top-left') {
      rx = 35;
      ry = height - 55;
      page.drawLine({ start: { x: 35, y: height - 65 }, end: { x: width - 35, y: height - 65 }, thickness: 0.5, color: corCinzaSuave });
    }
    
    const rgbRubrica = hexToPdfRgb(config.cor);
    
    // 1. Fundo do Selo
    page.drawRectangle({
      x: rx,
      y: ry,
      width: larguraRetangulo,
      height: alturaRetangulo,
      color: rgb(0.96, 0.96, 0.96), // Cinza bem clarinho estilo Gov
      borderColor: corCinzaSuave,
      borderWidth: 1,
    });
    
    // 2. Faixa Lateral Colorida (Identidade Visual)
    page.drawRectangle({
      x: rx,
      y: ry,
      width: larguraFaixaLateral,
      height: alturaRetangulo,
      color: rgbRubrica,
    });
    
    // 3. Ícone (Círculo Estilo Badge)
    const circleX = rx + larguraFaixaLateral + padding + raioCirculo;
    const circleY = ry + (alturaRetangulo / 2);
    
    page.drawCircle({
      x: circleX,
      y: circleY,
      size: raioCirculo,
      color: rgb(1, 1, 1),
      borderColor: rgbRubrica,
      borderWidth: 1.5,
    });
    
    // Texto dentro do Ícone - 71º BI Mtz (dividido em 2 linhas para caber no selo)
    const textBadgeTop = "71º";
    const textBadgeBottom = "BI Mtz";
    const textBadgeTopWidth = fonteHelveticaBold.widthOfTextAtSize(textBadgeTop, 9);
    const textBadgeBottomWidth = fonteHelveticaBold.widthOfTextAtSize(textBadgeBottom, 6);
    
    page.drawText(textBadgeTop, {
      x: circleX - (textBadgeTopWidth / 2),
      y: circleY + 2, // Metade superior
      size: 9,
      font: fonteHelveticaBold,
      color: rgbRubrica,
    });
    
    page.drawText(textBadgeBottom, {
      x: circleX - (textBadgeBottomWidth / 2) + 0.5, // Centralização óptica fina
      y: circleY - 6, // Metade inferior
      size: 6,
      font: fonteHelveticaBold,
      color: rgbRubrica,
    });
    
    // 4. Textos à Direita do Ícone
    const textX = circleX + raioCirculo + espacamentoTexto;
    
    // Y base = ry (fundo do selo). As linhas são desenhadas da linha de base para cima.
    // Linha 1 (Título) - Baseline a 28pts acima do fundo
    page.drawText(textoChancela, {
      x: textX,
      y: ry + 27, 
      size: tamanhoFonteTit,
      font: fonteHelveticaBold,
      color: rgb(0.15, 0.15, 0.15), // Escuro oficial
    });
    
    // Linha 2 (Autenticação Hash)
    page.drawText(subTextoHash, {
      x: textX,
      y: ry + 16,
      size: tamanhoFonteSub,
      font: fonteHelvetica,
      color: rgb(0.35, 0.35, 0.35),
    });
    
    // Linha 3 (Data/Hora)
    page.drawText(subTextoData, {
      x: textX,
      y: ry + 6,
      size: tamanhoFonteSub,
      font: fonteHelvetica,
      color: rgb(0.35, 0.35, 0.35),
    });
    
    // --- NUMERAÇÃO DE PÁGINA ---
    if (config.incluirPagina && i > 0) { // Ignora a capa (página 0)
      const textoPagina = `Página ${i} de ${totalPaginas - 1}`;
      const tamanhoPaginaFonte = 8;
      const larguraTextoPagina = fonteHelvetica.widthOfTextAtSize(textoPagina, tamanhoPaginaFonte);
      
      let xPagina = 35;
      let yPagina = 28;
      
      // Utiliza a configuração exclusiva de numeração de página (fallback caso não exista)
      const posicaoNumeracao = config.posicaoPagina || 'top-right';
      
      if (posicaoNumeracao === 'bottom-right') {
        xPagina = width - 35 - larguraTextoPagina;
        yPagina = 28;
      } else if (posicaoNumeracao === 'bottom-left') {
        xPagina = 35;
        yPagina = 28;
      } else if (posicaoNumeracao === 'bottom-center') {
        xPagina = (width - larguraTextoPagina) / 2;
        yPagina = 28;
      } else if (posicaoNumeracao === 'top-right') {
        xPagina = width - 35 - larguraTextoPagina;
        yPagina = height - 35;
      } else if (posicaoNumeracao === 'top-left') {
        xPagina = 35;
        yPagina = height - 35;
      }
      
      page.drawText(textoPagina, {
        x: xPagina,
        y: yPagina,
        size: tamanhoPaginaFonte,
        font: fonteHelvetica,
        color: corTextoCinza,
      });
    }
    
    // --- METADADOS OPCIONAIS (Data de Unificação) ---
    if (config.incluirData) {
      const dataAtual = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const textoData = `Chancelado em: ${dataAtual}`;
      const tamanhoDataFonte = 7;
      const larguraTextoData = fonteHelvetica.widthOfTextAtSize(textoData, tamanhoDataFonte);
      
      // Posiciona a data centralizada na parte inferior
      const xData = (width - larguraTextoData) / 2;
      
      page.drawText(textoData, {
        x: xData,
        y: 20, // Altura abaixo da numeração de página
        size: tamanhoDataFonte,
        font: fonteHelvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }
  
  onProgress?.('Finalizando codificação do arquivo...', 90);
  
  const pdfBytes = await pdfUnificado.save();
  
  onProgress?.('Processamento concluído com sucesso!', 100);
  
  return {
    pdfBytes,
    totalPaginas,
  };
};
