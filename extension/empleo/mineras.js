// Portales de carrera de las mineras (Fase 2b). Corren en el navegador del usuario, igual que
// portales.js: una consulta a la vez, sin cookies, y solo lectura (nunca se postula desde aquí).
// Cada minera usa una de tres plataformas: SAP SuccessFactors, Abril HR o HiringRoom.
// MARSA no tiene portal vigente: sus avisos se buscan en Bumeran por el nombre de la empresa.
import { sinHtml, fechaRelativa, bumeran } from './portales.js';

const limpiar = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12 };
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** «9 nov 2026», «09/11/2026», «2026-11-09», «Mon Nov 09 00:00:00 UTC 2026» → «2026-11-09» */
export function fechaIso(txt) {
  const t = limpiar(txt).toLowerCase();
  if (!t) return null;
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return iso(m[3], m[2], m[1]);
  m = t.match(/(\d{1,2})\s+(?:de\s+)?([a-z]{3})[a-z]*\.?\s+(?:de\s+)?(\d{4})/);
  if (m && MESES[m[2]]) return iso(m[3], MESES[m[2]], m[1]);
  m = t.match(/([a-z]{3})[a-z]*\s+(\d{1,2})\s+[\d:]+\s+\w+\s+(\d{4})/); // Mon Nov 09 00:00:00 UTC 2026
  if (m && MESES[m[1]]) return iso(m[3], MESES[m[1]], m[2]);
  return null;
}

async function texto(dep, url, opciones = {}) {
  const r = await dep.fetch(url, { credentials: 'omit', ...opciones });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
const ultimoNumero = (u) => (String(u).match(/(\d+)\/?(?:[?#].*)?$/) || [])[1];
const ultimoTramo = (u) => String(u).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop();

// ---------------- SAP SuccessFactors (Antamina, Minsur) ----------------
// Lista: tabla tr.data-row. Detalle: microdatos schema.org (itemprop description, datePosted, validThrough).
function successFactors({ clave, nombre, base, ruta = '' }) {
  return {
    id: `min-${clave}`, nombre, clave, origen: `${base}/*`,
    async buscar(dep) {
      const items = []; const vistos = new Set();
      for (let fila = 0; fila < 100; fila += 25) {
        const doc = dep.parsear(await texto(dep, `${base}${ruta}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${fila}`));
        const filas = [...doc.querySelectorAll('tr.data-row')];
        for (const tr of filas) {
          const a = tr.querySelector('a.jobTitle-link');
          if (!a) continue;
          const url = new URL(a.getAttribute('href'), base).href;
          const num = ultimoNumero(url) || ultimoTramo(url);
          if (vistos.has(num)) continue;
          vistos.add(num);
          items.push({
            id: `sf-${clave}-${num}`, portal: `min-${clave}`, portalMinera: clave,
            fuente: nombre, titulo: limpiar(a.textContent), url, empresa: nombre,
            ubicacion: limpiar(tr.querySelector('.jobLocation')?.textContent || ''),
            publicado: fechaIso(tr.querySelector('.jobDate')?.textContent), descripcion: '', detalleListo: false,
          });
        }
        const total = Number((doc.querySelector('.paginationLabel')?.textContent || '').match(/(\d+)\s*$/)?.[1] || 0);
        if (filas.length < 25 || fila + 25 >= total) break;
      }
      return items;
    },
    async detalle(item, dep) {
      const doc = dep.parsear(await texto(dep, item.url));
      const prop = (p) => { const e = doc.querySelector(`[itemprop="${p}"]`); return e ? (e.getAttribute('content') || e.textContent || '') : ''; };
      const desc = doc.querySelector('[itemprop="description"]');
      return {
        descripcion: desc ? sinHtml(desc.innerHTML || desc.textContent) : '',
        publicado: fechaIso(prop('datePosted')),
        vence: fechaIso(prop('validThrough')),
        ubicacion: limpiar(prop('streetAddress') || prop('addressLocality')) || null,
      };
    },
  };
}

// ---------------- Abril HR (Alpayana) ----------------
// API pública del «Site Laboral»: POST /api/v1/empresa/<empresa>/project/ con paginación.
// La lista ya trae el perfil del puesto completo, así que no hace falta abrir el detalle.
const CLAVES_TEXTO = ['name', 'nombre', 'type', 'value', 'valor', 'level', 'label', 'description', 'descripcion', 'text', 'texto'];
const anios = (n, txt) => (Number(n) > 0 ? `${Number(n)} ${txt}` : null);
/** Aplana el perfil de Abril (textos, listas u objetos) a líneas de texto legibles. */
export function aplanar(v) {
  // Un número suelto (p. ej. «0» cursos mínimos) no dice nada sin su etiqueta: se omite
  if (v == null || v === '' || typeof v === 'boolean' || typeof v === 'number') return [];
  if (typeof v === 'string') return sinHtml(v).split('\n').map(limpiar).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(aplanar);
  if (typeof v === 'object') {
    const partes = CLAVES_TEXTO.filter((k) => typeof v[k] === 'string' || typeof v[k] === 'number').map((k) => limpiar(v[k])).filter(Boolean);
    return partes.length ? [partes.join(': ')] : [];
  }
  return [];
}
export function descripcionAbril(pf = {}) {
  const sec = [
    ['', [pf.header]],
    ['Funciones', [pf.functionalities]],
    ['Formación', [pf.educational_level, pf.education_grade, pf.higher_education, pf.extra_studies, pf.continuing_education]],
    ['Experiencia', [pf.experience_background, anios(pf.experience_years_general, 'años de experiencia general'),
      anios(pf.experience_years_specific, 'años de experiencia específica'), anios(pf.experience_years_job, 'años en el puesto')]],
    ['Conocimientos', [pf.knowledge_background, pf.programs_knowledges, pf.minimum_programs_required, pf.ofimatic_knowledges,
      pf.minimum_courses_required, pf.skills, pf.detailed_skills]],
    ['Idiomas', [pf.languages]],
    ['Comentarios', [pf.profile_comment, pf.extra_comment, pf.footer]],
  ];
  return sec.map(([t, vs]) => { const l = [...new Set(vs.flatMap(aplanar))]; return l.length ? (t ? `${t}:\n` : '') + l.join('\n') : ''; })
    .filter(Boolean).join('\n\n');
}
function abril({ clave, nombre, empresa, base = 'https://www.abrilhr.pe' }) {
  return {
    id: `min-${clave}`, nombre, clave, origen: `${base}/*`,
    async buscar(dep) {
      const items = []; const TAM = 50;
      for (let pag = 1; pag <= 4; pag++) {
        const txt = await texto(dep, `${base}/api/v1/empresa/${encodeURIComponent(empresa)}/project/`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ currentPage: pag, size: TAM, params: { type: [], mode: [], job: '' } }),
        });
        let j; try { j = JSON.parse(txt); } catch { throw new Error('Abril HR respondió una página en vez de datos'); }
        const lista = j.jobs || [];
        for (const p of lista) {
          if (p.open === false || !p.job) continue;
          const pf = p.profile_form_new || {};
          const emp = p.company__name || empresa;
          items.push({
            id: `ab-${p.id}`, portal: `min-${clave}`, portalMinera: clave,
            fuente: nombre, titulo: limpiar(p.job), empresa: nombre,
            url: `${base}/api/v1/empresa/${encodeURIComponent(emp)}/puesto/${encodeURIComponent(String(p.job).replace(/ /g, '-'))}-${p.id}`,
            ubicacion: limpiar((String(p.job).match(/\b(UM|U\.M\.|Unidad Minera)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+/) || [])[0] || ''),
            modalidad: limpiar(pf.contract_type || '') || null,
            publicado: fechaIso(p.init_date || p.created_at), vence: fechaIso(p.ending_date),
            descripcion: descripcionAbril(pf), detalleListo: true,
          });
        }
        if (lista.length < TAM || items.length >= (j.jobs_count || 0)) break;
      }
      return items;
    },
  };
}

// ---------------- HiringRoom (Cerro Verde, Poderosa) ----------------
// Portal nuevo (/portal): un bloque JSON-LD «ItemList» con cada JobPosting completo.
// Portal antiguo (/jobs): tarjetas HTML; la descripción se lee en la ficha de cada vacante.
const jsonLd = (doc) => [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
  try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j : [j]; } catch { return []; }
});
const lugar = (loc) => {
  const l = [].concat(loc || [])[0];
  if (!l) return '';
  const a = l.address;
  return limpiar(typeof a === 'string' ? a : [a?.addressLocality, a?.addressRegion, a?.addressCountry].filter(Boolean).join(', '));
};
// `ruta`: el portal nuevo redirige /jobs a http://…/portal, y Firefox bloquea ese salto a http; se pide /portal directo.
function hiringRoom({ clave, nombre, base, ruta = '/jobs' }) {
  const crear = (vid, extra) => ({ id: `hr-${clave}-${vid}`, portal: `min-${clave}`, portalMinera: clave, fuente: nombre, empresa: nombre, ...extra });
  return {
    id: `min-${clave}`, nombre, clave, origen: `${base}/*`,
    async buscar(dep, hoy = new Date()) {
      const doc = dep.parsear(await texto(dep, `${base}${ruta}`));
      const lista = jsonLd(doc).find((x) => x?.['@type'] === 'ItemList');
      if (lista) {
        return (lista.itemListElement || []).map((e) => e.item || e).filter((jp) => jp?.title && jp.url).map((jp) => {
          const publicado = fechaIso(jp.datePosted);
          const vence = fechaIso(jp.validThrough);
          return crear(ultimoTramo(jp.url), {
            titulo: limpiar(jp.title), url: String(jp.url).replace(/^http:/, 'https:'), ubicacion: lugar(jp.jobLocation),
            publicado, vence: vence && (!publicado || vence >= publicado) ? vence : null, // HiringRoom a veces publica un cierre anterior a la publicación
            modalidad: [].concat(jp.employmentType || []).join(', ') || null,
            descripcion: sinHtml(jp.description || ''), detalleListo: true,
          });
        });
      }
      const items = []; const vistos = new Set();
      for (const a of doc.querySelectorAll('a[href*="/jobs/get_vacancy/"]')) {
        const href = a.getAttribute('href');
        if (/candidates/.test(href)) continue;
        const vid = ultimoTramo(href);
        if (vistos.has(vid)) continue;
        vistos.add(vid);
        const pin = a.querySelector('.hr-Location-pin');
        items.push(crear(vid, {
          titulo: limpiar(a.querySelector('h4, h3, h2')?.textContent || ''),
          url: new URL(href, base).href,
          ubicacion: limpiar(pin?.parentElement?.textContent || ''),
          publicado: fechaRelativa(a.querySelector('.vacancy-time')?.textContent || '', hoy),
          descripcion: '', detalleListo: false,
        }));
      }
      return items.filter((i) => i.titulo);
    },
    async detalle(item, dep) {
      const doc = dep.parsear(await texto(dep, item.url));
      const jp = jsonLd(doc).find((x) => x?.['@type'] === 'JobPosting');
      if (jp?.description) return { descripcion: sinHtml(jp.description), publicado: fechaIso(jp.datePosted) };
      const d = doc.querySelector('.main__description');
      return { descripcion: d ? sinHtml(d.innerHTML || d.textContent).replace(/^Descripci[oó]n del puesto\s*/i, '') : '' };
    },
  };
}

// ---------------- MARSA: avisos en Bumeran ----------------
function enBumeran({ clave, nombre, consulta, empresaRe }) {
  return {
    id: `min-${clave}`, nombre: `${nombre} (vía Bumeran)`, clave, origen: 'https://www.bumeran.com.pe/*',
    async buscar(dep) {
      const r = await bumeran.buscar(consulta, dep);
      return r.filter((o) => empresaRe.test(`${o.empresa} ${o.titulo}`)).map((o) => ({ ...o, portalMinera: clave }));
    },
  };
}

/** Las mineras de interés, en el orden en que se muestran en «Mi perfil». */
export const MINERAS_INTERES = {
  antamina: successFactors({ clave: 'antamina', nombre: 'Antamina', base: 'https://mastalento.antamina.com' }),
  minsur: successFactors({ clave: 'minsur', nombre: 'Minsur', base: 'https://oportunidades-laborales.com', ruta: '/minsur' }),
  alpayana: abril({ clave: 'alpayana', nombre: 'Alpayana', empresa: 'Alpayana' }),
  marsa: enBumeran({ clave: 'marsa', nombre: 'MARSA', consulta: 'Minera Aurifera Retamas', empresaRe: /retamas|\bmarsa\b/i }),
  poderosa: hiringRoom({ clave: 'poderosa', nombre: 'Poderosa', base: 'https://minerapoderosa.hiringroom.com' }),
  cerroverde: hiringRoom({ clave: 'cerroverde', nombre: 'Cerro Verde', base: 'https://cerroverde.hiringroom.com', ruta: '/portal' }),
};

/** Mineras elegidas en el perfil; si nunca se eligieron, todas. */
export const minerasDe = (perfil = {}) => (Array.isArray(perfil.mineras) ? perfil.mineras : Object.keys(MINERAS_INTERES)).filter((k) => MINERAS_INTERES[k]);
/** Orígenes que hay que permitir para leer esas mineras. */
export const origenesMineras = (claves) => [...new Set(claves.map((k) => MINERAS_INTERES[k]?.origen).filter(Boolean))];
