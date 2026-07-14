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
        try {
          const response = await fetch(doc.url);
          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
          }
          docBytes = await response.arrayBuffer();
        } catch (fetchErr) {
          console.warn('Falha ao buscar doc.url:', fetchErr);
          throw new Error(
            'Arquivo indisponível na memória. Se você recarregou a página sem salvar na nuvem, ' +
            'o arquivo temporário foi perdido. Por favor, remova este anexo e faça o upload novamente.'
          );
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
    // Monta o texto de chancela
    const textoChancela = config.texto.trim() || 'PROCESSO UNIFICADO';
    
    // Desenhar a chancela de acordo com a posição configurada
    let xChancela = 35;
    let yChancela = 30; // Abaixo da linha do rodapé
    
    if (config.posicao === 'bottom-right') {
      const larguraTexto = fonteHelveticaBold.widthOfTextAtSize(textoChancela, config.tamanhoFonte);
      xChancela = width - 35 - larguraTexto;
    } else if (config.posicao === 'bottom-center') {
      const larguraTexto = fonteHelveticaBold.widthOfTextAtSize(textoChancela, config.tamanhoFonte);
      xChancela = (width - larguraTexto) / 2;
    } else if (config.posicao === 'bottom-left') {
      xChancela = 35;
    } else if (config.posicao === 'top-right') {
      const larguraTexto = fonteHelveticaBold.widthOfTextAtSize(textoChancela, config.tamanhoFonte);
      xChancela = width - 35 - larguraTexto;
      yChancela = height - 30;
      
      // Desenha linha de cabeçalho também para ficar simétrico
      page.drawLine({
        start: { x: 35, y: height - 40 },
        end: { x: width - 35, y: height - 40 },
        thickness: 0.5,
        color: corCinzaSuave,
      });
    } else if (config.posicao === 'top-left') {
      xChancela = 35;
      yChancela = height - 30;
      
      // Desenha linha de cabeçalho
      page.drawLine({
        start: { x: 35, y: height - 40 },
        end: { x: width - 35, y: height - 40 },
        thickness: 0.5,
        color: corCinzaSuave,
      });
    }
    
    // Carimbo Visual (um pequeno retângulo estilizado de fundo para dar aspecto oficial de chancela)
    const larguraRetangulo = fonteHelveticaBold.widthOfTextAtSize(textoChancela, config.tamanhoFonte) + 12;
    const alturaRetangulo = config.tamanhoFonte + 8;
    
    // Desenha o fundo da chancela como uma etiqueta sutil
    const rx = config.posicao.endsWith('right') ? width - 35 - larguraRetangulo : (config.posicao.endsWith('center') ? (width - larguraRetangulo)/2 : 35);
    const ry = yChancela - 4;
    
    page.drawRectangle({
      x: rx,
      y: ry,
      width: larguraRetangulo,
      height: alturaRetangulo,
      color: rgb(0.97, 0.98, 1.0),
      borderColor: corRubrica,
      borderWidth: 1,
    });
    
    // Desenha o texto de chancela em negrito
    page.drawText(textoChancela, {
      x: rx + 6,
      y: yChancela,
      size: config.tamanhoFonte,
      font: fonteHelveticaBold,
      color: corRubrica,
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
