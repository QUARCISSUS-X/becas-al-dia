// Puente extensión → carpeta de postulaciones (Claude Code).
// Exporta una oferta como JSON con el contrato de PLAN.md («Oferta», versión 1).
// El archivo solo lleva datos de la oferta y el análisis automático: nunca el CV ni el perfil.
import { coincidencia } from './coincidencia.js';

export const VERSION_OFERTA = 1;
export const CARPETA_DESCARGA = 'becas-al-dia';

/** Nombre de archivo seguro: oferta_<id>.json */
export function nombreOferta(oferta) {
  const id = String(oferta?.id || 'sin-id').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'sin-id';
  return `oferta_${id}.json`;
}

/** Objeto de la oferta según el contrato. Usa el análisis ya calculado en la oferta o lo calcula. */
export function ofertaParaClaude(oferta, perfil = {}, ahora = new Date()) {
  const res = oferta.pct != null ? oferta : coincidencia(oferta, perfil);
  return {
    version: VERSION_OFERTA,
    id: String(oferta.id || ''),
    titulo: oferta.titulo || '',
    empresa: oferta.empresa || '',
    ubicacion: oferta.ubicacion || '',
    fuente: oferta.fuente || '',
    url: oferta.url || '',
    descripcion: String(oferta.descripcion || '').trim(),
    coincidencia: {
      pct: res.pct ?? null,
      coinciden: [...(res.coinciden || [])],
      faltan: [...(res.faltan || [])],
      faltanDeseables: [...(res.faltanDeseables || [])],
    },
    exportado: ahora.toISOString(),
  };
}

export const ofertaAJson = (oferta, perfil, ahora) => JSON.stringify(ofertaParaClaude(oferta, perfil, ahora), null, 2) + '\n';
