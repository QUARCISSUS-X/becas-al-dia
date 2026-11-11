// Datos verificados por Claude (y opcionalmente por tu propia IA): becas, eventos y cursos.
// Funciones puras portadas de la página «Becas al Día» (artefacto): estados, fechas y línea de tiempo.
// Se prueban en Node pasando «hoy».

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const NIVELES = { pregrado: 'Pregrado', posgrado: 'Maestría y doctorado', corto: 'Programas cortos', investigacion: 'Investigación' };
export const ESP = {
  civil: 'Civil y construcción', minas: 'Minas y geología', 'mecanica-electrica': 'Mecánica, eléctrica y energía', sistemas: 'Sistemas, TI e IA',
  industrial: 'Industrial', electronica: 'Electrónica y telecom', ambiental: 'Ambiental', quimica: 'Química y materiales',
  proyectos: 'Proyectos, costos y BIM', ssoma: 'Seguridad y salud (SSOMA)',
};
export const TIPOS = { todo: 'Todo', beca: 'Becas', evento: 'Eventos', curso: 'Cursos' };
export const CERT = { gratis: 'Certificado gratis', pago: 'Certificado de pago', ayuda: 'Certificado con ayuda económica', confirmar: 'Certificado: por confirmar' };
const DIA = 86400000;
const PRONTO = 120;

export const hoyLocal = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** «2026-11», «2026-11-13» o «2027» → Date (inicio o fin del periodo). */
export function parse(s, fin) {
  if (!s) return null;
  const p = String(s).split('-').map(Number);
  if (p.some((n) => !Number.isFinite(n))) return null;
  if (p.length === 1) return fin ? new Date(p[0], 11, 31) : new Date(p[0], 0, 1);
  if (p.length === 2) return fin ? new Date(p[0], p[1], 0) : new Date(p[0], p[1] - 1, 1);
  return new Date(p[0], p[1] - 1, p[2]);
}
const partes = (s) => (s ? String(s).split('-').length : 0);
export const esMes = (s) => partes(s) === 2;
export function fmt(s) {
  if (!s) return '';
  const p = String(s).split('-').map(Number);
  if (p.length === 1) return String(p[0]);
  if (p.length === 2) return `${MESES[p[1] - 1]} ${p[0]}`;
  return `${p[2]} ${MESES[p[1] - 1]} ${p[0]}`;
}
export function fmtRango(e) {
  if (!e || !e.inicio) return 'Fecha por confirmar';
  if (!e.fin || e.fin === e.inicio) return fmt(e.inicio);
  const a = String(e.inicio).split('-'); const b = String(e.fin).split('-');
  if (a.length === 3 && b.length === 3 && a[0] === b[0] && a[1] === b[1]) return `${Number(a[2])}–${Number(b[2])} ${MESES[Number(a[1]) - 1]} ${a[0]}`;
  return `${fmt(e.inicio)} – ${fmt(e.fin)}`;
}
const enPrep = (s) => (esMes(s) || partes(s) === 1 ? 'en ' : 'el ');
const dias = (a, b) => Math.round((b - a) / DIA);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const cuando = (d) => (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${plural(d, 'día')}`);
const ventanas = (b) => (b.ventanas || []).map((w) => ({ w, ini: parse(w.inicio, false), fin: parse(w.fin, true) })).filter((x) => x.fin);

function estadoBeca(b, hoy) {
  if (b.modo === 'continua') return { k: 'abierta', lbl: 'Abierta', main: 'Todo el año', sub: 'Sin fecha de cierre', orden: [0, 900] };
  const ws = ventanas(b);
  for (const x of ws) {
    if (x.ini && x.ini <= hoy && hoy <= x.fin) {
      const quedan = dias(hoy, x.fin);
      if (b.modo === 'por_programa') return { k: 'abierta', lbl: 'Abierta', main: 'Plazos según programa', sub: `La mayoría cierra hacia ${fmt(x.w.fin)}`, orden: [0, 500 + quedan], cierra: null };
      return { k: 'abierta', lbl: 'Abierta', main: `Cierra ${fmt(x.w.fin)}`, sub: quedan === 0 ? 'Último día' : `Faltan ${plural(quedan, 'día')}`, orden: [0, quedan], cierra: x.w.fin, quedan };
    }
  }
  const fut = ws.filter((x) => (x.ini && x.ini > hoy) || (!x.ini && x.fin >= hoy)).sort((a, c) => (a.ini || a.fin) - (c.ini || c.fin));
  const pasadas = ws.filter((x) => x.fin < hoy).sort((a, c) => c.fin - a.fin);
  if (fut.length) {
    const f = fut[0]; const d = dias(hoy, f.ini || f.fin);
    const sigTxt = f.ini ? `se espera que abra ${enPrep(f.w.inicio)}${fmt(f.w.inicio)}` : `cierre esperado ${enPrep(f.w.fin)}${fmt(f.w.fin)}`;
    if (f.w.estimada && d > PRONTO && pasadas.length) return { k: 'cerrada', lbl: 'Cerrada', main: `Cerró ${fmt(pasadas[0].w.fin)}`, sub: b.proxima || `Próxima edición: ${sigTxt}`, orden: [2, d] };
    if (!f.ini) return { k: 'porabrir', lbl: 'Por abrir', main: `Cierre esperado ${fmt(f.w.fin)}`, sub: f.w.estimada ? 'Fecha estimada' : `Faltan ${plural(d, 'día')}`, orden: [1, d] };
    if (f.w.estimada) return { k: 'porabrir', lbl: 'Por abrir', main: `Se espera ${fmt(f.w.inicio)}`, sub: `Fecha estimada · ${f.w.etiqueta || ''}`, orden: [1, d] };
    return { k: 'porabrir', lbl: 'Por abrir', main: `Abre ${fmt(f.w.inicio)}`, sub: `${cuando(d)} · ${f.w.etiqueta || ''}`, orden: [1, d] };
  }
  return { k: 'cerrada', lbl: 'Cerrada', main: pasadas.length ? `Cerró ${fmt(pasadas[0].w.fin)}` : 'Cerrada', sub: b.proxima || 'Próxima edición por confirmar', orden: [2, 99999] };
}

function estadoEvento(b, hoy) {
  if (b.modo === 'continua') return { k: 'abierta', lbl: 'Permanente', main: b.recurrencia || 'Permanente', sub: b.gratis ? 'Gratuito' : b.modalidad || '', orden: [0, 950] };
  const e = b.evento; const ei = e ? parse(e.inicio, false) : null; const ef = e ? parse(e.fin || e.inicio, true) : null;
  if (ef && ef < hoy) return { k: 'cerrada', lbl: 'Finalizado', main: `Finalizó ${fmt(e.fin || e.inicio)}`, sub: b.proxima || 'Próxima edición por confirmar', orden: [2, 99999] };
  if (ei && ei <= hoy) return { k: 'abierta', lbl: 'En curso', main: `Hasta ${fmt(e.fin || e.inicio)}`, sub: 'En curso', orden: [0, dias(hoy, ef)] };
  const ws = ventanas(b);
  for (const x of ws) {
    if ((!x.ini || x.ini <= hoy) && hoy <= x.fin) {
      const quedan = dias(hoy, x.fin);
      return { k: 'abierta', lbl: 'Inscripción abierta', main: `${x.w.etiqueta || 'Inscripción'} hasta ${fmt(x.w.fin)}`, sub: e ? `Evento: ${fmtRango(e)}` : quedan === 0 ? 'Último día' : `Faltan ${plural(quedan, 'día')}`, orden: [0, quedan], cierra: x.w.fin, quedan };
    }
  }
  const fut = ws.filter((x) => x.ini && x.ini > hoy).sort((a, c) => a.ini - c.ini);
  if (fut.length) { const d0 = dias(hoy, fut[0].ini); return { k: 'porabrir', lbl: 'Próximo', main: `Inscripción abre ${fmt(fut[0].w.inicio)}`, sub: e ? `Evento: ${fmtRango(e)}` : cuando(d0), orden: [1, d0] }; }
  if (ei) { const d = dias(hoy, ei); return { k: 'porabrir', lbl: 'Próximo', main: fmtRango(e), sub: `${cuando(d)} · inscripción con el organizador`, orden: [1, d], cierra: e.inicio, quedan: d }; }
  return { k: 'porabrir', lbl: 'Próximo', main: 'Fecha por confirmar', sub: '', orden: [1, 9999] };
}

function estadoCurso(b, hoy) {
  const ws = ventanas(b);
  for (const x of ws) {
    if ((!x.ini || x.ini <= hoy) && hoy <= x.fin) {
      const quedan = dias(hoy, x.fin);
      return { k: 'abierta', lbl: 'Inscripción abierta', main: `Inscríbete hasta ${fmt(x.w.fin)}`, sub: quedan === 0 ? 'Último día' : `Faltan ${plural(quedan, 'día')}`, orden: [0, quedan], cierra: x.w.fin, quedan };
    }
  }
  if (b.modo === 'continua') return { k: 'abierta', lbl: 'Disponible', main: 'A tu ritmo', sub: CERT[b.cert] || '', orden: [0, b.cert === 'gratis' ? 700 : 800] };
  const fut = ws.filter((x) => x.ini && x.ini > hoy).sort((a, c) => a.ini - c.ini);
  if (fut.length) { const d = dias(hoy, fut[0].ini); return { k: 'porabrir', lbl: 'Próxima edición', main: `Abre ${fmt(fut[0].w.inicio)}`, sub: `${cuando(d)} · inscripción hasta ${fmt(fut[0].w.fin)}`, orden: [1, d] }; }
  const pasadas = ws.filter((x) => x.fin < hoy).sort((a, c) => c.fin - a.fin);
  return { k: 'cerrada', lbl: 'Cerrado', main: pasadas.length ? `Cerró ${fmt(pasadas[0].w.fin)}` : 'Cerrado', sub: b.proxima || 'Próxima edición por confirmar', orden: [2, 99999] };
}

/** Estado de un registro: {k: abierta|porabrir|cerrada, lbl, main, sub, orden, cierra?, quedan?} */
export function estadoDe(b, hoy = hoyLocal()) {
  const t = b.tipo || 'beca';
  return t === 'evento' ? estadoEvento(b, hoy) : t === 'curso' ? estadoCurso(b, hoy) : estadoBeca(b, hoy);
}

/** Normaliza y ordena: abiertas primero (las que cierran antes), luego próximas, luego cerradas. */
export function preparar(datos, hoy = hoyLocal()) {
  const items = (datos?.becas || []).map((b) => {
    const x = { ...b, tipo: b.tipo || 'beca', esp: b.esp || [], nivel: b.nivel || [], fuentes: b.fuentes || [], postular: b.postular || { url: '', texto: 'Ver convocatoria' } };
    x.st = estadoDe(x, hoy);
    return x;
  });
  items.sort((a, b) => a.st.orden[0] - b.st.orden[0] || a.st.orden[1] - b.st.orden[1]);
  return items;
}

/** Marcas de la línea de tiempo (próximos 6 meses) en % del ancho. */
export function marcasLinea(b, hoy = hoyLocal()) {
  const ini0 = hoy; const fin0 = new Date(hoy.getFullYear(), hoy.getMonth() + 6, hoy.getDate());
  const pct = (d) => Math.max(0, Math.min(100, ((d - ini0) / (fin0 - ini0)) * 100));
  const m = [];
  if (b.modo === 'continua' && b.tipo !== 'curso') m.push({ cls: b.tipo === 'evento' ? 'evc' : 'abierta', l: 0, r: 100, tip: `${b.corto}: ${b.tipo === 'evento' ? b.recurrencia || 'permanente' : 'postulación todo el año'}` });
  for (const w of b.ventanas || []) {
    let ini = parse(w.inicio, false); const fin = parse(w.fin, true);
    if (!fin || fin < ini0) continue;
    if (!ini && b.tipo === 'curso') ini = ini0;
    if (!ini) { if (fin <= fin0) m.push({ pin: true, l: pct(fin), tip: `${b.corto}: ${w.etiqueta || ''} · ${fmt(w.fin)}${w.estimada ? ' (estimada)' : ''}` }); continue; }
    if (ini > fin0) continue;
    const abierta = ini <= hoy;
    const cls = b.tipo === 'curso' ? (abierta ? 'cur' : 'curf') : abierta ? (b.modo === 'por_programa' ? 'prog' : 'abierta') : w.estimada ? 'est' : 'porabrir';
    m.push({ cls, l: pct(ini), r: pct(fin), tip: `${b.corto}: ${w.etiqueta || ''} · ${fmt(w.inicio)} – ${fmt(w.fin)}${w.estimada && !abierta ? ' (estimada)' : ''}` });
  }
  if (b.evento?.inicio) {
    const ei = parse(b.evento.inicio, false); const ef = parse(b.evento.fin || b.evento.inicio, true);
    if (ef >= ini0 && ei <= fin0) m.push({ cls: 'ev', l: pct(ei), r: pct(new Date(ef.getTime() + DIA)), tip: `${b.corto}: evento · ${fmtRango(b.evento)}` });
  }
  return m;
}

/** Meses visibles en el eje de la línea de tiempo. */
export function ejeMeses(hoy = hoyLocal()) {
  const fin0 = new Date(hoy.getFullYear(), hoy.getMonth() + 6, hoy.getDate());
  const pct = (d) => ((d - hoy) / (fin0 - hoy)) * 100;
  const out = [];
  for (let m = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1); m <= fin0; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    out.push({ l: pct(m), txt: MESES[m.getMonth()] + (m.getMonth() === 0 ? ` ${String(m.getFullYear()).slice(2)}` : '') });
  }
  return out;
}

/** Fechas clave con marca de pasada / siguiente / estimada. */
export function fechasClave(b, hoy = hoyLocal()) {
  let marcada = false;
  return (b.fechas || []).map((f) => {
    let cls = '';
    if (f.fecha && parse(f.fecha, true) < hoy) cls = 'pasada';
    if (!cls && !marcada && f.fecha) { cls = 'siguiente'; marcada = true; }
    const estimada = esMes(f.fecha) && parse(f.fecha, true) >= hoy && b.tipo !== 'evento';
    return { cuando: f.fecha ? fmt(f.fecha) : '—', que: f.evento, cls, estimada };
  });
}

export const linkedinUrl = (tipo, q) => `https://www.linkedin.com/search/results/${tipo}/?keywords=${encodeURIComponent(q || '')}`;

const sinTildes = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Filtro de la lista: tipo, estado, especialidad, nivel, texto, favoritas. */
export function filtrarCurado(items, f = {}, favoritas = new Set()) {
  const q = sinTildes((f.q || '').trim());
  return items.filter((b) => {
    if (f.tipo && f.tipo !== 'todo' && b.tipo !== f.tipo) return false;
    if (f.esp && !b.esp.includes(f.esp) && !b.esp.includes('todas')) return false;
    if (f.estado && b.st.k !== f.estado) return false;
    if (f.nivel && (b.tipo !== 'beca' || !b.nivel.includes(f.nivel))) return false;
    if (f.favs && !favoritas.has(b.id)) return false;
    if (q) {
      const hay = [b.nombre, b.entidad, b.destino, b.area, b.resumen, b.formato, b.modalidad, b.plataforma, b.idioma, b.certificado,
        b.tipo === 'curso' ? `curso ${CERT[b.cert] || ''}` : '', ...b.nivel.map((n) => NIVELES[n]), ...b.esp.map((k) => ESP[k] || '')].join(' ');
      if (!sinTildes(hay).includes(q)) return false;
    }
    return true;
  });
}
