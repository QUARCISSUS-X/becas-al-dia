// Orquesta la búsqueda de empleo: arma los términos desde el perfil, consulta cada portal
// con pausas cortas, abre el detalle de las ofertas más prometedoras, calcula el % de
// coincidencia y fusiona con la búsqueda anterior (para marcar «nuevas»).
import { PORTALES } from './portales.js';
import { PERFILES, coincidencia, esPractica, esMinera, sinTildes, normalizar, ajuste, claveEmpresa } from './coincidencia.js';

const MAX_DETALLES = 30;     // páginas de detalle (Computrabajo) por búsqueda
const CONSERVAR_DIAS = 30;   // ofertas no vistas se borran a los 30 días
const PAUSA_MS = 600;        // entre consultas al mismo portal
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const hoyIso = (hoy) => hoy.toISOString().slice(0, 10);
const restarDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Términos a buscar en cada portal según los perfiles marcados y las búsquedas extra. */
export function terminosBusqueda(perfil = {}) {
  let sel = (perfil.perfiles || []).filter((p) => PERFILES[p]);
  if (!sel.length) sel = ['ambiental', 'civil'];
  const q = new Set(); const servir = new Set(); const servirPracticas = new Set();
  for (const p of sel) {
    PERFILES[p].q?.forEach((x) => q.add(x));
    PERFILES[p].servir?.forEach((x) => servir.add(x));
    PERFILES[p].servirPracticas?.forEach((x) => servirPracticas.add(x));
  }
  for (const extra of String(perfil.busquedas || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    q.add(extra);
    servir.add(extra.split(/\s+/).sort((a, b) => b.length - a.length)[0]); // SERVIR busca mejor con una palabra
  }
  return { q: [...q].slice(0, 12), servir: [...servir].slice(0, 8), servirPracticas: [...servirPracticas].slice(0, 4) };
}

/** Puntaje rápido solo con el título, para decidir qué detalles abrir primero. */
function prioridad(it, perfil) {
  const t = sinTildes(it.titulo);
  return (perfil.perfiles || []).reduce((s, p) => s + (PERFILES[p]?.re.test(t) ? 1 : 0), 0) + (it.publicado ? 0.01 : 0);
}

/**
 * @param {object} perfil  perfil guardado en la extensión
 * @param {object} anterior  { items: [...] } de la búsqueda previa
 * @param {object} cacheDetalles  { [id]: {descripcion, vence, ...} } (se actualiza in situ)
 * @param {object} dep  { fetch, parsear, alAvanzar?(texto) }
 */
export async function buscarEmpleo({ perfil = {}, anterior = {}, cacheDetalles = {}, dep, hoy = new Date(), portales = PORTALES, aprendizaje = null }) {
  const HOY = hoyIso(hoy);
  const avisar = dep.alAvanzar || (() => {});
  const t = terminosBusqueda(perfil);
  const salud = [];
  const crudos = new Map();
  const agregar = (lista) => lista.forEach((it) => { if (!crudos.has(it.id)) crudos.set(it.id, it); });

  const tareas = [];
  if (portales.computrabajo) tareas.push(['computrabajo', t.q.map((q) => () => portales.computrabajo.buscar(q, dep, hoy))]);
  if (portales.bumeran) tareas.push(['bumeran', t.q.map((q) => () => portales.bumeran.buscar(q, dep))]);
  if (portales.servir) tareas.push(['servir', [
    ...t.servir.map((q) => () => portales.servir.buscar(q, dep)),
    ...t.servirPracticas.map((q) => () => portales.servir.buscar(q, dep, { practicas: true })),
  ]]);

  // Portales en paralelo; dentro de cada portal, una consulta a la vez
  await Promise.all(tareas.map(async ([id, consultas]) => {
    const s = { id, nombre: portales[id].nombre, ok: false, items: 0, consultas: consultas.length, errores: [] };
    for (const c of consultas) {
      try { const r = await c(); agregar(r); s.items += r.length; s.ok = true; } catch (e) { s.errores.push(String(e.message || e)); }
      avisar(`${portales[id].nombre}: ${s.items} ofertas…`);
      await espera(PAUSA_MS);
    }
    s.error = s.ok ? (s.errores.length ? `${s.errores.length} de ${consultas.length} búsquedas fallaron (${s.errores[0]})` : null) : (s.errores[0] || 'sin resultados');
    s.detalleErrores = [...new Set(s.errores)].slice(0, 3); // para «Copiar diagnóstico»
    delete s.errores;
    salud.push(s);
  }));

  // Detalles de Computrabajo: primero las más prometedoras; lo ya descargado sale de la caché
  const pendientes = [...crudos.values()].filter((it) => !it.detalleListo && !cacheDetalles[it.id])
    .sort((a, b) => prioridad(b, perfil) - prioridad(a, perfil)).slice(0, MAX_DETALLES);
  let hechos = 0;
  const trabajadores = Array.from({ length: 2 }, async () => {
    while (pendientes.length) {
      const it = pendientes.shift();
      try { cacheDetalles[it.id] = { ...(await portales[it.id.startsWith('ct-') ? 'computrabajo' : 'bumeran'].detalle(it, dep)), el: HOY }; } catch { /* queda sin detalle */ }
      avisar(`Leyendo ofertas… ${++hechos}`);
      await espera(350);
    }
  });
  await Promise.all(trabajadores);

  // Fusionar con la búsqueda anterior
  const previos = new Map((anterior.items || []).map((i) => [i.id, i]));
  const items = [];
  for (const it of crudos.values()) {
    const det = cacheDetalles[it.id] || {};
    const o = { ...it, descripcion: it.descripcion || det.descripcion || '', vence: it.vence || det.vence || null, publicado: it.publicado || det.publicado || null };
    if (det.tipo && !o.modalidad) o.modalidad = det.tipo;
    o.sinDetalle = !o.descripcion;
    o.primeraVez = previos.get(o.id)?.primeraVez || HOY;
    o.vistoUltimo = HOY;
    items.push(o);
  }
  for (const [id, p] of previos) if (!crudos.has(id) && p.vistoUltimo >= restarDias(HOY, CONSERVAR_DIAS)) items.push(p);

  // La misma oferta publicada en dos portales (o republicada) se muestra una sola vez
  const unicas = fusionarDuplicadas(items, new Set(previos.keys()));

  // Puntuar (con el perfil actual) y etiquetar
  for (const o of unicas) puntuar(o, perfil, aprendizaje);
  const vivos = unicas.filter((o) => !(o.vence && o.vence < HOY));

  // Purga de la caché de detalles
  const ids = new Set(vivos.map((o) => o.id));
  for (const id of Object.keys(cacheDetalles)) if (!ids.has(id)) delete cacheDetalles[id];

  return { generado: new Date().toISOString(), hoy: HOY, terminos: t, total: vivos.length, duplicadas: items.length - unicas.length, items: vivos, salud };
}

/**
 * Agrupa ofertas con el mismo puesto, empresa y ciudad. Se conserva la que ya se había mostrado
 * antes (para no perder guardadas ni postulaciones) o, si no, la de descripción más completa;
 * las demás quedan como enlaces en «tambienEn».
 */
export function fusionarDuplicadas(items, preferidos = new Set()) {
  const grupos = new Map(); const sueltas = [];
  for (const o of items) {
    const emp = claveEmpresa(o.empresa);
    if (o.sectorPublico || !emp) { sueltas.push(o); continue; }
    const ciudad = normalizar(String(o.ubicacion || '').split(',')[0]).trim();
    const k = `${normalizar(o.titulo || '').trim()}|${emp}|${ciudad}`;
    grupos.has(k) ? grupos.get(k).push(o) : grupos.set(k, [o]);
  }
  const res = [...sueltas];
  for (const g of grupos.values()) {
    g.sort((a, b) => (preferidos.has(b.id) - preferidos.has(a.id)) || ((b.descripcion || '').length - (a.descripcion || '').length));
    const [principal, ...otras] = g;
    const enlaces = new Map((principal.tambienEn || []).map((e) => [e.url, e]));
    for (const d of otras) {
      if (d.url !== principal.url) enlaces.set(d.url, { fuente: d.fuente, url: d.url });
      if (!principal.descripcion && d.descripcion) { principal.descripcion = d.descripcion; principal.sinDetalle = false; }
      principal.salario ||= d.salario; principal.vence ||= d.vence;
      if (d.publicado && (!principal.publicado || d.publicado < principal.publicado)) principal.publicado = d.publicado;
    }
    if (enlaces.size) principal.tambienEn = [...enlaces.values()].slice(0, 4);
    res.push(principal);
  }
  return res;
}

/** Recalcula % y etiquetas de una oferta (se usa también al cambiar el perfil, sin volver a buscar). */
export function puntuar(o, perfil, aprendizaje = null) {
  const r = coincidencia(o, perfil);
  o.pctBase = r.pct; o.tope = r.tope;
  o.coinciden = r.coinciden; o.faltan = r.faltan; o.faltanDeseables = r.faltanDeseables; o.notas = r.notas;
  aplicarAprendizaje(o, aprendizaje);
  o.practica = esPractica(o.titulo) || /practic/i.test(o.modalidad || '');
  o.minera = esMinera(`${o.empresa} ${o.titulo} ${o.descripcion.slice(0, 600)}`);
  return o;
}

/** Suma o resta los puntos aprendidos de tus guardadas/ocultas, sin pasar del tope de la oferta. */
export function aplicarAprendizaje(o, aprendizaje) {
  const base = o.pctBase ?? o.pct ?? null;
  o.pctBase = base; // las ofertas guardadas con una versión anterior no lo traían
  o.ajuste = base == null ? 0 : ajuste(o, aprendizaje);
  o.pct = base == null ? null : Math.max(0, Math.min(Math.max(base, o.tope ?? 100), base + o.ajuste));
  return o;
}
