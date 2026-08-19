import React from 'react';
import { downloadTranscriptPDF, downloadSummaryPDF } from '../services/pdf';
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
        <button
          className="btn-ghost btn-download"
          onClick={() => downloadSummaryPDF({ title: analysis.titulo, date: meta?.dateLabel, durationLabel: meta?.durationLabel, secciones, acciones })}
        >
          {t('download_summary_pdf')}
        </button>
        <button
          className="btn-ghost btn-download"
          onClick={() => downloadTranscriptPDF({ title: analysis.titulo, date: meta?.dateLabel, durationLabel: meta?.durationLabel, transcript })}
        >
          {t('download_transcript_pdf')}
        </button>
      </div>

      {/* Sections */}
      {secciones.map((sec, i) => (
        <div className="analysis-section" key={i}>
          <h4 className="analysis-section-title">{sec.encabezado}</h4>
          <ul className="analysis-bullets">
            {(sec.puntos || []).map((p, j) => <li key={j}>{p}</li>)}
          </ul>
        </div>
      ))}

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

      {onNewMeeting && (
        <button className="btn-primary" onClick={onNewMeeting} style={{ width: '100%', marginTop: '0.5rem' }}>
          {t('new_recording')}
        </button>
      )}
    </div>
  );
}
