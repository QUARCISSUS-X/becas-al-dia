// Formato del archivo data/curado.json (el mismo que los bloques JSON de la página «Becas al Día»)
// y validación compartida por el script del repositorio, la extensión y la importación desde tu IA.

export const URL_CURADO_DEFECTO = 'https://raw.githubusercontent.com/QUARCISSUS-X/becas-al-dia/main/data/curado.json';
export const TIPOS_VALIDOS = ['beca', 'evento', 'curso'];
export const MODOS_VALIDOS = ['fija', 'por_programa', 'continua'];
const FECHA = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const URL_OK = /^https?:\/\/\S+$/;

export const fechaValida = (s) => s === '' || s == null || FECHA.test(String(s));

/** Devuelve la lista de problemas de un registro (vacía si está bien). */
export function problemasDe(b) {
  const p = [];
  const id = b?.id || '(sin id)';
  if (!b || typeof b !== 'object') return ['registro que no es un objeto'];
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(String(b.id || ''))) p.push(`${id}: id inválido (solo minúsculas, números y guiones)`);
  if (!String(b.nombre || '').trim()) p.push(`${id}: falta nombre`);
  if (b.tipo && !TIPOS_VALIDOS.includes(b.tipo)) p.push(`${id}: tipo «${b.tipo}» no válido`);
  if (b.modo && !MODOS_VALIDOS.includes(b.modo)) p.push(`${id}: modo «${b.modo}» no válido`);
  if (!URL_OK.test(String(b.postular?.url || ''))) p.push(`${id}: falta el enlace oficial para postular`);
  for (const w of b.ventanas || []) {
    if (!fechaValida(w.inicio) || !fechaValida(w.fin) || !w.fin) p.push(`${id}: ventana con fecha inválida (${w.inicio} → ${w.fin})`);
  }
  for (const f of b.fechas || []) if (!fechaValida(f.fecha)) p.push(`${id}: fecha clave inválida «${f.fecha}»`);
  if (b.evento && (!fechaValida(b.evento.inicio) || !fechaValida(b.evento.fin))) p.push(`${id}: fechas del evento inválidas`);
  if (b.verificado && !fechaValida(b.verificado)) p.push(`${id}: «verificado» inválido`);
  for (const f of b.fuentes || []) if (!URL_OK.test(String(f.u || ''))) p.push(`${id}: fuente sin enlace válido`);
  return p;
}

/** Valida un archivo completo. @returns {{ok:boolean, problemas:string[]}} */
export function validarCurado(d) {
  const p = [];
  if (!d || typeof d !== 'object') return { ok: false, problemas: ['no es un objeto JSON'] };
  if (!FECHA.test(String(d.actualizado || ''))) p.push('falta «actualizado» (AAAA-MM-DD)');
  if (!Array.isArray(d.becas) || !d.becas.length) p.push('falta la lista «becas»');
  const ids = new Set();
  for (const b of d.becas || []) {
    p.push(...problemasDe(b));
    if (ids.has(b.id)) p.push(`${b.id}: id repetido`);
    ids.add(b.id);
  }
  return { ok: !p.length, problemas: p };
}

/** De la página HTML del artefacto a un objeto curado.json. */
export function extraerDeHtml(html) {
  const bloque = (id) => {
    const m = String(html).match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`));
    if (!m) throw new Error(`No se encontró el bloque ${id}`);
    return JSON.parse(m[1]);
  };
  const becas = bloque('becas-data');
  let empleo = null;
  try { empleo = bloque('empleo-data'); } catch { /* opcional */ }
  return { ...becas, empleo, origen: 'claude' };
}

/** Elige qué datos mostrar: los más recientes entre los de Claude (repo) y los de tu IA. */
export function elegirCurado(claude, propio) {
  if (!propio) return claude || null;
  if (!claude) return propio;
  return String(propio.actualizado) > String(claude.actualizado) ? propio : claude;
}
