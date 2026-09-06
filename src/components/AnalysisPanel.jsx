import React from 'react';
import { downloadTranscriptPDF, downloadSummaryPDF } from '../services/pdf';
import { downloadTranscriptDOCX, downloadSummaryDOCX } from '../services/docx';
import { useLanguage } from '../i18n/LanguageContext';

export default function AnalysisPanel({ analysis, transcript, meta, onNewMeeting }) {
  const { t } = useLanguage();

  if (!analysis) return (
    <div className="sidebar-placeholder">
      <div className="sidebar-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </div>
      <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
        {t('analysis_placeholder')}
      </p>
    </div>
  );

  const secciones = analysis.secciones || [];
  const acciones = analysis.acciones || [];
  const puntosClave = analysis.puntosClave || [];
  const puntosImportantes = analysis.puntosImportantes || [];
  const preguntas = analysis.preguntas || [];
  const conceptos = analysis.conceptos || [];
  const resumenFinal = analysis.resumenFinal || '';

  const summaryPayload = {
    title: analysis.titulo, date: meta?.dateLabel, durationLabel: meta?.durationLabel,
    secciones, acciones, puntosClave, puntosImportantes, preguntas, conceptos, resumenFinal,
  };
  const transcriptPayload = { title: analysis.titulo, date: meta?.dateLabel, durationLabel: meta?.durationLabel, transcript };

  return (
    <div className="analysis-panel">
      {/* Title */}
      <div className="analysis-title-block">
        <span className="badge badge-blue">{t('analysis_badge_title')}</span>
        <h3 className="analysis-title">{analysis.titulo}</h3>
        {(meta?.dateLabel || meta?.durationLabel) && (
          <p className="analysis-meta text-muted">
            {[meta.dateLabel, meta.durationLabel].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>

      {/* Download buttons */}
      <div className="analysis-downloads">
        <button className="btn-ghost btn-download" onClick={() => downloadSummaryPDF(summaryPayload)}>
          {t('download_summary_pdf')}
        </button>
        <button className="btn-ghost btn-download" onClick={() => downloadSummaryDOCX(summaryPayload)}>
          {t('download_summary_docx')}
        </button>
        <button className="btn-ghost btn-download" onClick={() => downloadTranscriptPDF(transcriptPayload)}>
          {t('download_transcript_pdf')}
        </button>
        <button className="btn-ghost btn-download" onClick={() => downloadTranscriptDOCX(transcriptPayload)}>
          {t('download_transcript_docx')}
        </button>
      </div>

      {/* Sections */}
      {secciones.map((sec, i) => (
        <div className="analysis-section" key={i}>
          <h4 className="analysis-section-title">{sec.encabezado}</h4>
          <ul className="analysis-bullets">
            {(sec.puntos || []).map((p, j) => <li key={j}>{p}</li>)}
          </ul>
          {(sec.subtemas || []).map((sub, k) => (
            <div className="analysis-subsection" key={k} style={{ marginLeft: '1rem' }}>
              <h5 className="analysis-subsection-title">{sub.encabezado}</h5>
              <ul className="analysis-bullets">
                {(sub.puntos || []).map((p, j) => <li key={j}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {/* Key points */}
      {puntosClave.length > 0 && (
        <div className="analysis-section">
          <h4 className="analysis-section-title">⭐ {t('key_points')}</h4>
          <ul className="analysis-bullets">
            {puntosClave.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {/* Emphasized points */}
      {puntosImportantes.length > 0 && (
        <div className="analysis-section">
          <h4 className="analysis-section-title">🎯 {t('important_points')}</h4>
          <ul className="analysis-bullets">
            {puntosImportantes.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {/* Review questions */}
      {preguntas.length > 0 && (
        <div className="analysis-section">
          <h4 className="analysis-section-title">❓ {t('possible_questions')}</h4>
          <ul className="analysis-bullets">
            {preguntas.map((qa, i) => (
              <li key={i}><strong>{qa.pregunta}</strong>{qa.respuesta ? ` — ${qa.respuesta}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Concepts to remember */}
      {conceptos.length > 0 && (
        <div className="analysis-section">
          <h4 className="analysis-section-title">📚 {t('concepts_to_remember')}</h4>
          <ul className="analysis-bullets">
            {conceptos.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Action items */}
      {acciones.length > 0 && (
        <div className="analysis-section analysis-actions">
          <h4 className="analysis-section-title">{t('suggested_actions')}</h4>
          <ul className="analysis-actions-list">
            {acciones.map((a, i) => (
              <li key={i}>
                <span className="action-checkbox" aria-hidden="true" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final summary */}
      {resumenFinal && (
        <div className="analysis-section">
          <h4 className="analysis-section-title">📝 {t('final_summary')}</h4>
          <p className="text-muted">{resumenFinal}</p>
        </div>
      )}

      {onNewMeeting && (
        <button className="btn-primary" onClick={onNewMeeting} style={{ width: '100%', marginTop: '0.5rem' }}>
          {t('new_recording')}
        </button>
      )}
    </div>
  );
}
