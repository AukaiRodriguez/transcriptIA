import jsPDF from 'jspdf';
import { sanitizeFilename } from '../utils/format';

const MARGIN_X = 48;
const PAGE_WIDTH = 595.28; // A4 en pt
const MAX_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function newDoc() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  return { doc, pageHeight: doc.internal.pageSize.getHeight() };
}

function metaLine(date, durationLabel) {
  return [date, durationLabel].filter(Boolean).join(' • ');
}

// Firma de marca centrada al final de la última página del documento. Si no
// queda espacio suficiente debajo del último contenido, agrega una página
// nueva para no superponerse con texto existente.
function addBrandFooter(doc, pageHeight, lastContentY) {
  let footerY = pageHeight - 26;
  if (lastContentY > footerY - 14) {
    doc.addPage();
    footerY = pageHeight - 26;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('--- Desarrollado por TranscriptIA ---', PAGE_WIDTH / 2, footerY, { align: 'center' });
  doc.text('--- Aukai Labs ---', PAGE_WIDTH / 2, footerY + 12, { align: 'center' });
  doc.setTextColor(0);
}

export function downloadTranscriptPDF({ title, date, durationLabel, transcript }) {
  const { doc, pageHeight } = newDoc();
  let y = 60;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(title || 'Transcripción', MAX_WIDTH);
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 20 + 4;

  const meta = metaLine(date, durationLabel);
  if (meta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(meta, MARGIN_X, y);
    doc.setTextColor(0);
    y += 24;
  } else {
    y += 10;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(transcript || '(sin contenido)', MAX_WIDTH);
  const lineHeight = 15;
  for (const line of lines) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
    doc.text(line, MARGIN_X, y);
    y += lineHeight;
  }

  addBrandFooter(doc, pageHeight, y);
  doc.save(`${sanitizeFilename(title)}-transcripcion.pdf`);
}

export function downloadSummaryPDF({
  title, date, durationLabel,
  secciones, acciones,
  puntosClave, puntosImportantes, preguntas, conceptos, resumenFinal,
}) {
  const { doc, pageHeight } = newDoc();
  let y = 60;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  const drawSectionTitle = (text) => {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(text, MARGIN_X, y);
    y += 20;
  };

  const drawBullets = (items, { indent = 10, marker = '•', maxWidth = MAX_WIDTH - 10 } = {}) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    (items || []).forEach((item) => {
      const lines = doc.splitTextToSize(`${marker}  ${item}`, maxWidth);
      ensureSpace(lines.length * 15);
      doc.text(lines, MARGIN_X + indent, y);
      y += lines.length * 15 + 3;
    });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(title || 'Resumen', MAX_WIDTH);
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 22;

  const meta = metaLine(date, durationLabel);
  if (meta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(meta, MARGIN_X, y);
    doc.setTextColor(0);
    y += 22;
  }
  y += 8;

  // Temas y subtemas
  (secciones || []).forEach((sec) => {
    const headLines = doc.splitTextToSize(sec.encabezado || '', MAX_WIDTH);
    ensureSpace(headLines.length * 18 + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(headLines, MARGIN_X, y);
    y += headLines.length * 18 + 6;

    drawBullets(sec.puntos);

    (sec.subtemas || []).forEach((sub) => {
      const subLines = doc.splitTextToSize(sub.encabezado || '', MAX_WIDTH - 10);
      ensureSpace(subLines.length * 16 + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text(subLines, MARGIN_X + 10, y);
      y += subLines.length * 16 + 4;
      drawBullets(sub.puntos, { indent: 20 });
    });

    y += 10;
  });

  // Puntos clave
  if (puntosClave && puntosClave.length > 0) {
    drawSectionTitle('⭐ Puntos Clave');
    drawBullets(puntosClave);
    y += 10;
  }

  // Puntos importantes / énfasis del hablante
  if (puntosImportantes && puntosImportantes.length > 0) {
    drawSectionTitle('🎯 Puntos Importantes');
    drawBullets(puntosImportantes);
    y += 10;
  }

  // Posibles preguntas de repaso/examen
  if (preguntas && preguntas.length > 0) {
    drawSectionTitle('❓ Posibles Preguntas');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    preguntas.forEach((qa) => {
      const qLines = doc.splitTextToSize(`•  ${qa.pregunta || ''}`, MAX_WIDTH - 10);
      ensureSpace(qLines.length * 15);
      doc.setFont('helvetica', 'bold');
      doc.text(qLines, MARGIN_X + 10, y);
      y += qLines.length * 15 + 2;

      if (qa.respuesta) {
        const aLines = doc.splitTextToSize(qa.respuesta, MAX_WIDTH - 24);
        ensureSpace(aLines.length * 14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90);
        doc.text(aLines, MARGIN_X + 24, y);
        doc.setTextColor(0);
        y += aLines.length * 14 + 6;
      }
    });
    y += 10;
  }

  // Conceptos, autores y términos a recordar
  if (conceptos && conceptos.length > 0) {
    drawSectionTitle('📚 Conceptos y Términos a Recordar');
    drawBullets(conceptos);
    y += 10;
  }

  // Acciones sugeridas / pendientes
  if (acciones && acciones.length > 0) {
    drawSectionTitle('Acciones Sugeridas');
    drawBullets(acciones, { marker: '☐' });
    y += 10;
  }

  // Resumen final
  if (resumenFinal) {
    drawSectionTitle('📝 Resumen Final');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(resumenFinal, MAX_WIDTH);
    ensureSpace(lines.length * 15);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 15;
  }

  addBrandFooter(doc, pageHeight, y);
  doc.save(`${sanitizeFilename(title)}-resumen.pdf`);
}
