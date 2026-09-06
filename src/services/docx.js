import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { sanitizeFilename } from '../utils/format';

function metaLine(date, durationLabel) {
  return [date, durationLabel].filter(Boolean).join(' • ');
}

function brandFooterParagraphs() {
  return [
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '--- Desarrollado por TranscriptIA ---', size: 16, color: '999999' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '--- Aukai Labs ---', size: 16, color: '999999' })],
    }),
  ];
}

async function saveDocx(doc, filename) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTranscriptDOCX({ title, date, durationLabel, transcript }) {
  const children = [];

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: title || 'Transcripción', bold: true })],
  }));

  const meta = metaLine(date, durationLabel);
  if (meta) {
    children.push(new Paragraph({
      children: [new TextRun({ text: meta, italics: true, color: '777777', size: 20 })],
      spacing: { after: 200 },
    }));
  }

  const paragraphs = (transcript || '(sin contenido)').split(/\n+/).filter(Boolean);
  paragraphs.forEach((p) => {
    children.push(new Paragraph({ text: p, spacing: { after: 120 } }));
  });

  children.push(...brandFooterParagraphs());

  const doc = new Document({ sections: [{ children }] });
  await saveDocx(doc, `${sanitizeFilename(title)}-transcripcion.docx`);
}

export async function downloadSummaryDOCX({
  title, date, durationLabel,
  secciones, acciones,
  puntosClave, puntosImportantes, preguntas, conceptos, resumenFinal,
}) {
  const children = [];

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: title || 'Resumen', bold: true })],
  }));

  const meta = metaLine(date, durationLabel);
  if (meta) {
    children.push(new Paragraph({
      children: [new TextRun({ text: meta, italics: true, color: '777777', size: 20 })],
      spacing: { after: 200 },
    }));
  }

  const addBullets = (items, { level = 0 } = {}) => {
    (items || []).forEach((item) => {
      children.push(new Paragraph({ text: item, bullet: { level }, spacing: { after: 60 } }));
    });
  };

  (secciones || []).forEach((sec) => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: sec.encabezado || '', bold: true })],
      spacing: { before: 200 },
    }));
    addBullets(sec.puntos);

    (sec.subtemas || []).forEach((sub) => {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: sub.encabezado || '', bold: true })],
        spacing: { before: 120 },
      }));
      addBullets(sub.puntos, { level: 1 });
    });
  });

  if (puntosClave && puntosClave.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '⭐ Puntos Clave', spacing: { before: 240 } }));
    addBullets(puntosClave);
  }

  if (puntosImportantes && puntosImportantes.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '🎯 Puntos Importantes', spacing: { before: 240 } }));
    addBullets(puntosImportantes);
  }

  if (preguntas && preguntas.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '❓ Posibles Preguntas', spacing: { before: 240 } }));
    preguntas.forEach((qa) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: qa.pregunta || '', bold: true })],
        spacing: { before: 100 },
      }));
      if (qa.respuesta) {
        children.push(new Paragraph({
          children: [new TextRun({ text: qa.respuesta, color: '555555' })],
          indent: { left: 360 },
          spacing: { after: 100 },
        }));
      }
    });
  }

  if (conceptos && conceptos.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '📚 Conceptos y Términos a Recordar', spacing: { before: 240 } }));
    addBullets(conceptos);
  }

  if (acciones && acciones.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Acciones Sugeridas', spacing: { before: 240 } }));
    addBullets(acciones);
  }

  if (resumenFinal) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '📝 Resumen Final', spacing: { before: 240 } }));
    children.push(new Paragraph({ text: resumenFinal, spacing: { after: 120 } }));
  }

  children.push(...brandFooterParagraphs());

  const doc = new Document({ sections: [{ children }] });
  await saveDocx(doc, `${sanitizeFilename(title)}-resumen.docx`);
}
