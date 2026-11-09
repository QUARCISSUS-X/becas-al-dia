// Orquesta la búsqueda de empleo: arma los términos desde el perfil, consulta cada portal
// con pausas cortas, abre el detalle de las ofertas más prometedoras, calcula el % de
// coincidencia y fusiona con la búsqueda anterior (para marcar «nuevas»).
import { PORTALES } from './portales.js';
import { PERFILES, coincidencia, esPractica, esMinera, sinTildes } from './coincidencia.js';

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
export async function buscarEmpleo({ perfil = {}, anterior = {}, cacheDetalles = {}, dep, hoy = new Date(), portales = PORTALES }) {
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

  // Puntuar (con el perfil actual) y etiquetar
  for (const o of items) puntuar(o, perfil);
  const vivos = items.filter((o) => !(o.vence && o.vence < HOY));

  // Purga de la caché de detalles
  const ids = new Set(vivos.map((o) => o.id));
  for (const id of Object.keys(cacheDetalles)) if (!ids.has(id)) delete cacheDetalles[id];

  return { generado: new Date().toISOString(), hoy: HOY, terminos: t, total: vivos.length, items: vivos, salud };
}

/** Recalcula % y etiquetas de una oferta (se usa también al cambiar el perfil, sin volver a buscar). */
export function puntuar(o, perfil) {
  const r = coincidencia(o, perfil);
  o.pct = r.pct; o.coinciden = r.coinciden; o.faltan = r.faltan; o.notas = r.notas;
  o.practica = esPractica(o.titulo) || /practic/i.test(o.modalidad || '');
  o.minera = esMinera(`${o.empresa} ${o.titulo} ${o.descripcion.slice(0, 600)}`);
  return o;
}
