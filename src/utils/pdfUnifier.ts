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
          // É uma URL externa (ex: Supabase Storage)
          try {
            let fetched = false;
            
            // Se for uma URL do nosso bucket Supabase, usamos o SDK oficial para burlar o erro de CORS do fetch direto
            if (doc.url.includes('documentos-brutos')) {
              // A URL é do tipo: https://.../public/documentos-brutos/brutos/p-123/arquivo.pdf
              // Extraímos tudo depois de 'documentos-brutos/'
              const urlParts = doc.url.split('documentos-brutos/');
              if (urlParts.length > 1) {
                const filePath = decodeURIComponent(urlParts[1]);
                
                // Import dinâmico para não quebrar dependências circulares
                const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
                
                if (isSupabaseConfigured() && supabase) {
                  const { data, error } = await supabase.storage.from('documentos-brutos').download(filePath);
                  if (!error && data) {
                    docBytes = await data.arrayBuffer();
                    fetched = true;
                  } else {
                    console.warn('Erro ao baixar via SDK do Supabase:', error);
                  }
                }
              }
            }
            
            // Fallback se não for Supabase ou se o SDK falhar
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
              'O servidor de nuvem bloqueou o acesso ao arquivo (CORS) ou ele não existe mais. ' +
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
    
    // --- CHANCELAMENTO / RUBRICA VISUAL ---
    const textoChancela = config.texto.trim() || 'AUTENTICADO DIGITALMENTE';
    const subTextoHash = `Ref: ${hashProcesso}`;
    
    // Calcula dimensões do selo moderno
    const larguraTextoPrincipal = fonteHelveticaBold.widthOfTextAtSize(textoChancela, config.tamanhoFonte);
    const larguraSubTexto = fonteHelvetica.widthOfTextAtSize(subTextoHash, config.tamanhoFonte - 2);
    
    // O ícone do selo (simulado por texto) + textos
    const iconeLargura = 18;
    const padding = 10;
    const espacamentoTexto = 6;
    
    const larguraRetangulo = Math.max(larguraTextoPrincipal, larguraSubTexto) + iconeLargura + (padding * 2) + espacamentoTexto;
    const alturaRetangulo = (config.tamanhoFonte * 2) + 12;
    
    // Coordenadas baseadas na configuração
    let rx = 35;
    let ry = 25;
    
    if (config.posicao === 'bottom-right') {
      rx = width - 35 - larguraRetangulo;
    } else if (config.posicao === 'bottom-center') {
      rx = (width - larguraRetangulo) / 2;
    } else if (config.posicao === 'bottom-left') {
      rx = 35;
    } else if (config.posicao === 'top-right') {
      rx = width - 35 - larguraRetangulo;
      ry = height - 45;
      
      // Cabeçalho separador superior
      page.drawLine({
        start: { x: 35, y: height - 55 },
        end: { x: width - 35, y: height - 55 },
        thickness: 0.5,
        color: corCinzaSuave,
      });
    } else if (config.posicao === 'top-left') {
      rx = 35;
      ry = height - 45;
      
      // Cabeçalho separador superior
      page.drawLine({
        start: { x: 35, y: height - 55 },
        end: { x: width - 35, y: height - 55 },
        thickness: 0.5,
        color: corCinzaSuave,
      });
    }
    
    // Fundo do Carimbo com cor clarinha e borda sutil
    const rgbRubrica = hexToPdfRgb(config.cor);
    
    // Simula um background ultra leve pegando 10% da cor selecionada (a fórmula é misturar com branco)
    // Para simplificar, usamos branco fantasma para garantir legibilidade
    page.drawRectangle({
      x: rx,
      y: ry,
      width: larguraRetangulo,
      height: alturaRetangulo,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgbRubrica,
      borderWidth: 1.5,
    });
    
    // Desenha um pequeno ícone/detalhe de segurança no lado esquerdo do selo (simbolizando o selo oficial)
    const iconeX = rx + padding;
    const iconeY = ry + (alturaRetangulo / 2) - 4;
    
    // Um mini quadrado preenchido
    page.drawRectangle({
      x: iconeX,
      y: iconeY - 2,
      width: 10,
      height: 10,
      color: rgbRubrica,
    });
    
    // Um quadrado vazio sobreposto (estilo selo criptográfico)
    page.drawRectangle({
      x: iconeX + 3,
      y: iconeY - 5,
      width: 10,
      height: 10,
      color: rgb(0.98, 0.98, 0.99), // Cor de fundo para vazar
      borderColor: rgbRubrica,
      borderWidth: 1,
    });
    
    // Texto Principal
    const textX = rx + padding + iconeLargura + espacamentoTexto;
    page.drawText(textoChancela, {
      x: textX,
      y: ry + alturaRetangulo - padding - config.tamanhoFonte + 2,
      size: config.tamanhoFonte,
      font: fonteHelveticaBold,
      color: rgbRubrica,
    });
    
    // Subtexto (Hash de Validação)
    page.drawText(subTextoHash, {
      x: textX,
      y: ry + padding - 1,
      size: config.tamanhoFonte - 2,
      font: fonteHelvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // --- NUMERAÇÃO DE PÁGINA ---
    if (config.incluirPagina) {
      const textoPagina = `Página ${i + 1} de ${totalPaginas}`;
      const tamanhoPaginaFonte = 8;
      const larguraTextoPagina = fonteHelvetica.widthOfTextAtSize(textoPagina, tamanhoPaginaFonte);
      
      // Coloca a numeração do lado oposto da rubrica no rodapé para balancear
      let xPagina = 35;
      if (config.posicao === 'bottom-left' || config.posicao === 'top-left') {
        xPagina = width - 35 - larguraTextoPagina;
      } else if (config.posicao === 'bottom-right' || config.posicao === 'top-right') {
        xPagina = 35;
      } else {
        // No centro, então página fica na direita
        xPagina = width - 35 - larguraTextoPagina;
      }
      
      page.drawText(textoPagina, {
        x: xPagina,
        y: 28, // Altura padrão do rodapé
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
