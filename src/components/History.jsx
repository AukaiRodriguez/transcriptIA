import React, { useCallback, useEffect, useState } from 'react';
import { getTranscriptions, deleteTranscription } from '../services/db';
import { downloadTranscriptPDF, downloadSummaryPDF } from '../services/pdf';
import { formatDuration } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

export default function History({ userId, onBack }) {
  const { t, locale } = useLanguage();
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  function formatDate(iso) {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTranscriptions(userId);
      setRecords(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm(t('history_delete_confirm'))) return;
    setDeleting(id);
    try {
      await deleteTranscription(id);
      setRecords(r => r.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally {
      setDeleting(null);
    }
  }

  const secciones = selected?.insights?.secciones || [];
  const acciones = selected?.insights?.acciones || [];
  const durationLabel = selected ? formatDuration(selected.duration_seconds) : null;

  return (
    <div className="history-container">
      <div className="history-header">
        <button onClick={onBack} className="btn-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('history_back')}
        </button>
        <h2>{t('history_title')}</h2>
        <span className="text-muted" style={{fontSize:'0.85rem'}}>{records.length} {t('history_count')}</span>
      </div>

      {loading ? (
        <div className="history-loading">
          <div className="spinner"/>
          <p className="text-muted">{t('history_loading')}</p>
        </div>
      ) : records.length === 0 ? (
        <div className="history-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-muted)'}}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-muted">{t('history_empty')}</p>
          <button className="btn-primary" onClick={onBack}>{t('history_start_new')}</button>
        </div>
      ) : (
        <div className="history-layout">
          {/* List */}
          <div className="history-list">
            {records.map(r => (
              <div
                key={r.id}
                className={`history-item ${selected?.id === r.id ? 'active' : ''}`}
                onClick={() => setSelected(r)}
              >
                <div className="history-item-main">
                  <span className="history-item-title">{r.title}</span>
                  <span className="history-item-date text-muted">{formatDate(r.created_at)}</span>
                </div>
                <button
                  className="btn-delete"
                  onClick={(e) => handleDelete(r.id, e)}
                  disabled={deleting === r.id}
                  title={t('history_delete_title')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="history-detail glass-panel">
              <h3 className="detail-title">{selected.title}</h3>
              <p className="text-muted" style={{fontSize:'0.8rem', marginBottom:'1rem'}}>
                {[formatDate(selected.created_at), durationLabel].filter(Boolean).join(' • ')}
              </p>

              <div className="analysis-downloads" style={{marginBottom: '1.25rem'}}>
                <button
                  className="btn-ghost btn-download"
                  onClick={() => downloadSummaryPDF({ title: selected.title, date: formatDate(selected.created_at), durationLabel, secciones, acciones })}
                >
                  {t('download_summary_pdf')}
                </button>
                <button
                  className="btn-ghost btn-download"
                  onClick={() => downloadTranscriptPDF({ title: selected.title, date: formatDate(selected.created_at), durationLabel, transcript: selected.raw_transcript })}
                >
                  {t('download_transcript_pdf')}
                </button>
              </div>

              {secciones.map((sec, i) => (
                <div className="detail-section" key={i}>
                  <h4>{sec.encabezado}</h4>
                  <ul className="analysis-bullets">
                    {(sec.puntos || []).map((p, j) => <li key={j}>{p}</li>)}
                  </ul>
                </div>
              ))}

              {acciones.length > 0 && (
                <div className="detail-section">
                  <h4>{t('suggested_actions')}</h4>
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

              <div className="detail-section">
                <h4>{t('history_full_transcript')}</h4>
                <pre className="detail-transcript">{selected.raw_transcript}</pre>
              </div>
            </div>
          ) : (
            <div className="history-detail-placeholder glass-panel">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-muted)'}}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p className="text-muted">{t('history_select_hint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
