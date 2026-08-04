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

  doc.save(`${sanitizeFilename(title)}-transcripcion.pdf`);
}

export function downloadSummaryPDF({ title, date, durationLabel, secciones, acciones }) {
  const { doc, pageHeight } = newDoc();
  let y = 60;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
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

  (secciones || []).forEach((sec) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const headLines = doc.splitTextToSize(sec.encabezado || '', MAX_WIDTH);
    ensureSpace(headLines.length * 18 + 4);
    doc.text(headLines, MARGIN_X, y);
    y += headLines.length * 18 + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    (sec.puntos || []).forEach((p) => {
      const bulletLines = doc.splitTextToSize(`•  ${p}`, MAX_WIDTH - 10);
      ensureSpace(bulletLines.length * 15);
      doc.text(bulletLines, MARGIN_X + 10, y);
      y += bulletLines.length * 15 + 3;
    });
    y += 12;
  });

  if (acciones && acciones.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Acciones Sugeridas', MARGIN_X, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    acciones.forEach((a) => {
      const lines = doc.splitTextToSize(`☐  ${a}`, MAX_WIDTH - 10);
      ensureSpace(lines.length * 15);
      doc.text(lines, MARGIN_X + 10, y);
      y += lines.length * 15 + 3;
    });
  }

  doc.save(`${sanitizeFilename(title)}-resumen.pdf`);
}
