export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${totalSeconds}s`;
}

export function sanitizeFilename(name) {
  const clean = (name || 'transcripcion')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  return clean || 'transcripcion';
}
