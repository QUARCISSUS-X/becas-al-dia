// Lectores de portales de empleo. Corren en el navegador del usuario (panel de la extensión),
// así que cada portal ve una visita normal y no hay servidores ni costos.
// Dependencias inyectables para poder probarlos en Node: { fetch, parsear(html) → Document }.

const limpiar = (s = '') => String(s).replace(/\s+/g, ' ').trim();
// Quita el HTML pero conserva los saltos de línea: sirven para separar «Requisitos» de «Deseable»
export const sinHtml = (s = '') => String(s).replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr|\/ul|\/ol)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '\n• ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .split('\n').map(limpiar).filter((l) => l && l !== '•').join('\n');
export const slug = (q) => q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isoDeDMY = (s = '') => { const m = String(s).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/** "Hace 2 días", "Hace 5 horas", "Ayer", "Hoy" → fecha ISO */
export function fechaRelativa(txt, hoy = new Date()) {
  const t = String(txt || '').toLowerCase();
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  let n = 0;
  const m = t.match(/hace\s+(\d+)\s+(minuto|hora|d[ií]a|semana|mes)/);
  if (m) n = { minuto: 0, hora: 0, 'día': Number(m[1]), dia: Number(m[1]), semana: 7 * m[1], mes: 30 * m[1] }[m[2]] ?? 0;
  else if (/ayer/.test(t)) n = 1;
  else if (!/hoy|hace/.test(t)) return null;
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function texto(dep, url, opciones = {}) {
  const r = await dep.fetch(url, { credentials: 'omit', ...opciones });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const TIPOS = { FULL_TIME: 'Tiempo completo', PART_TIME: 'Medio tiempo', CONTRACTOR: 'Por contrato', TEMPORARY: 'Temporal', INTERN: 'Prácticas', PER_DIEM: 'Por día', OTHER: 'Otro' };

// ---------------- Computrabajo ----------------
export const computrabajo = {
  id: 'computrabajo',
  nombre: 'Computrabajo',
  base: 'https://pe.computrabajo.com',
  async buscar(q, dep, hoy = new Date()) {
    const url = `${this.base}/trabajo-de-${slug(q)}`;
    const doc = dep.parsear(await texto(dep, url));
    const items = [];
    for (const art of doc.querySelectorAll('article.box_offer')) {
      const a = art.querySelector('a.js-o-link');
      if (!a) continue;
      const href = new URL(a.getAttribute('href'), this.base).href.replace(/#.*$/, '');
      const ps = [...art.querySelectorAll('p')];
      const empresa = limpiar(art.querySelector('[offer-grid-article-company-url]')?.textContent || '');
      const ubic = ps.map((p) => limpiar(p.querySelector('span.mr10')?.textContent || '')).find((x) => x && !/\d,\d/.test(x)) || '';
      const salario = limpiar(art.querySelector('.i_salary')?.parentElement?.textContent || '');
      const cuando = limpiar(ps.find((p) => /hace|ayer|hoy/i.test(p.textContent) && p.classList.contains('fc_aux'))?.textContent || '');
      items.push({
        id: 'ct-' + (art.getAttribute('data-id') || hash(href)),
        fuente: this.nombre,
        titulo: limpiar(a.textContent),
        url: href,
        empresa: empresa || 'Empresa no indicada',
        ubicacion: ubic,
        salario: salario || null,
        publicado: fechaRelativa(cuando, hoy),
        descripcion: '',
        detalleListo: false,
      });
    }
    return items;
  },
  // La página de cada oferta trae un bloque schema.org JobPosting con la descripción completa
  async detalle(item, dep) {
    const doc = dep.parsear(await texto(dep, item.url));
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let j; try { j = JSON.parse(s.textContent); } catch { continue; }
      const nodos = Array.isArray(j) ? j : j['@graph'] || [j];
      const jp = nodos.find((n) => n && n['@type'] === 'JobPosting');
      if (jp) {
        return {
          descripcion: sinHtml(jp.description || ''),
          vence: (jp.validThrough || '').slice(0, 10) || null,
          publicado: (jp.datePosted || '').slice(0, 10) || null,
          tipo: [].concat(jp.employmentType || []).map((t) => TIPOS[t] || t).join(', ') || null,
        };
      }
    }
    // Plan B: el bloque de descripción visible
    const bloque = [...doc.querySelectorAll('div.mb40')].find((d) => /Descripci[oó]n de la oferta/.test(d.textContent));
    return { descripcion: limpiar(bloque?.textContent || '').replace(/^Descripci[oó]n de la oferta\s*/, '') };
  },
};

// ---------------- Bumeran ----------------
export const bumeran = {
  id: 'bumeran',
  nombre: 'Bumeran',
  base: 'https://www.bumeran.com.pe',
  async buscar(q, dep) {
    const pedir = (credentials) => dep.fetch(`${this.base}/api/avisos/searchV2?pageSize=20&page=0&sort=RELEVANTES`, {
      method: 'POST',
      credentials,
      headers: { 'content-type': 'application/json', 'x-site-id': 'BMPE' },
      body: JSON.stringify({ filtros: [], busquedaExtendida: false, tipoDetalle: 'full', withHome: false, query: q, internacional: false }),
    });
    // Primero sin cookies; si Bumeran rechaza (antibots), se reintenta con las cookies de tu
    // propia visita a bumeran.com.pe (el navegador las envía, la extensión no las lee).
    let r = await pedir('omit');
    if ([401, 403, 429].includes(r.status)) r = await pedir('include');
    if (!r.ok) throw new Error(r.status === 403 ? 'HTTP 403 (abre bumeran.com.pe una vez en este navegador y vuelve a buscar)' : `HTTP ${r.status}`);
    const tipo = r.headers?.get?.('content-type') || 'application/json';
    if (!/json/.test(tipo)) throw new Error('Bumeran respondió una página en vez de datos (posible verificación antibots: abre bumeran.com.pe y reintenta)');
    const j = await r.json();
    return (j.content || []).map((a) => ({
      id: 'bm-' + a.id,
      fuente: this.nombre,
      titulo: limpiar(a.titulo),
      url: `${this.base}/empleos/aviso-${a.id}.html`, // Bumeran redirige a la URL completa
      empresa: a.confidencial ? 'Confidencial' : limpiar(a.empresa || 'Empresa no indicada'),
      ubicacion: limpiar(a.localizacion || ''),
      modalidad: [a.modalidadTrabajo, a.tipoTrabajo].filter(Boolean).join(' · ') || null,
      salario: null,
      publicado: isoDeDMY(a.fechaPublicacion),
      descripcion: sinHtml(a.detalle || ''),
      detalleListo: true,
    }));
  },
};

// ---------------- Talento Perú (SERVIR) ----------------
// Es una aplicación JSF: primero se abre la página (sesión + ViewState) y luego se envía
// el formulario de búsqueda. Solo se lee la primera página de resultados por término.
export const servir = {
  id: 'servir',
  nombre: 'Talento Perú (SERVIR)',
  paginas: {
    laboral: { url: 'https://app.servir.gob.pe/DifusionOfertasExterno/faces/consultas/ofertas_laborales.xhtml', campo: 'txtPuesto' },
    practicas: { url: 'https://app.servir.gob.pe/DifusionOfertasExterno/faces/consultas/modalidades_formativas.xhtml', campo: 'txtCriterio' },
  },
  async buscar(q, dep, { practicas = false } = {}) {
    const pag = this.paginas[practicas ? 'practicas' : 'laboral'];
    const doc0 = dep.parsear(await texto(dep, pag.url, { credentials: 'include' }));
    const form = doc0.querySelector('form[id^="frm"]');
    if (!form) throw new Error('No se encontró el formulario (¿cambió la web?)');
    const fid = form.getAttribute('id');
    const cuerpo = new URLSearchParams();
    for (const el of form.querySelectorAll('input[name], select[name]')) {
      if (['checkbox', 'radio', 'submit', 'button'].includes(el.getAttribute('type'))) continue;
      cuerpo.set(el.getAttribute('name'), el.getAttribute('value') || '');
    }
    cuerpo.set(fid, fid);
    const campo = [...form.querySelectorAll('input[name]')].find((i) => i.getAttribute('name').endsWith(':' + pag.campo));
    if (!campo) throw new Error(`No se encontró el campo de búsqueda ${pag.campo}`);
    cuerpo.set(campo.getAttribute('name'), q);
    const btn = [...form.querySelectorAll('button[id]')].find((b) => /buscar/i.test(b.textContent));
    if (btn) cuerpo.set(btn.getAttribute('id'), btn.getAttribute('id'));
    const html = await texto(dep, pag.url, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: cuerpo.toString(),
    });
    return this.leerResultados(dep.parsear(html), pag.url, practicas);
  },
  leerResultados(doc, url, practicas) {
    const items = [];
    for (const c of doc.querySelectorAll('.cuadro-vacantes')) {
      const titulo = limpiar(c.querySelector('.titulo-vacante')?.textContent || '');
      if (!titulo) continue;
      const entidad = limpiar(c.querySelector('.nombre-entidad')?.textContent || '').replace(/^UNIDAD EJECUTORA:\s*/i, '').replace(/^"|"$/g, '');
      const campos = {};
      for (const st of c.querySelectorAll('.sub-titulo')) {
        const k = limpiar(st.textContent).replace(/:$/, '');
        const v = st.parentElement.querySelector('.detalle-sp');
        if (v) campos[k] = limpiar(v.textContent);
      }
      const nro = campos['Número de Convocatoria'] || '';
      items.push({
        id: 'sv-' + hash(`${titulo}|${entidad}|${nro}|${campos['Ubicación'] || ''}`),
        fuente: this.nombre,
        titulo,
        url, // la ficha requiere sesión: se abre la búsqueda y se ubica por número de convocatoria
        empresa: entidad || 'Entidad pública',
        ubicacion: campos['Ubicación'] || '',
        salario: campos['Remuneración'] || null,
        modalidad: practicas ? (campos['Tipo de Modalidad'] || 'Prácticas') : 'Sector público',
        convocatoria: nro || null,
        publicado: isoDeDMY(campos['Fecha Inicio de Publicación']),
        vence: isoDeDMY(campos['Fecha Fin de Publicación']),
        descripcion: `${titulo}. ${entidad}. ${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('. ')}`,
        detalleListo: true,
        sectorPublico: true,
      });
    }
    return items;
  },
};

export const PORTALES = { computrabajo, bumeran, servir };
