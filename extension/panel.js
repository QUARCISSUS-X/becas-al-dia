// Becas al Día — panel lateral con dos pestañas: Becas y Empleo.
import { buscarEmpleo, puntuar, aplicarAprendizaje } from './empleo/buscador.js';
import { promptCv, aprender } from './empleo/coincidencia.js';
import { ESTADOS, marcar, aCsv } from './empleo/seguimiento.js';
import { PROVEEDORES, configurada, origenDe, generar, probar, FUNCIONES, funcionActiva, algunaActiva } from './ia/ia.js';
import { TAREAS, armar, leerAnalisis, analisisATexto, aWord, nombreArchivo } from './ia/tareas.js';
const URL_DATOS_DEFECTO = 'https://raw.githubusercontent.com/QUARCISSUS-X/becas-al-dia/main/data/becas.json';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const ext = globalThis.chrome?.storage?.local ? chrome : null;
const almacen = {
  get: (k) => ext ? ext.storage.local.get(k) : Promise.resolve(globalThis.__almacenPrueba || {}),
  set: (o) => ext ? ext.storage.local.set(o) : Promise.resolve(Object.assign(globalThis.__almacenPrueba ||= {}, o)),
};
const mensaje = (m) => ext ? ext.runtime.sendMessage(m) : Promise.resolve({ ok: true });

const NIVEL = { pregrado: 'Pregrado', maestria: 'Maestría', doctorado: 'Doctorado', posdoc: 'Posdoc', curso: 'Curso', investigacion: 'Investigación' };
const AREA = { ingenieria: 'Ingeniería', ambiental: 'Ambiental', civil: 'Civil', mineria: 'Minería', gestion: 'Gestión' };

const estado = {
  datos: null, favoritas: new Set(), vistos: new Set(), vistosAntes: new Set(),
  filtros: { q: '', estado: 'vigentes', nivel: '', pais: '', areas: new Set(), completa: false, peru: false, favs: false, nuevas: false },
};

const sinTildes = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + 'T00:00:00') - hoy) / 86400000);
}
const fechaCorta = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
const mesCorto = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
// Si la web solo da el mes ("cierra en marzo 2027") se muestra "~mar 2027"
const fechaTxt = (iso, aprox) => (aprox ? `~${mesCorto(iso)}` : fechaCorta(iso));
function hace(isoDT) {
  if (!isoDT) return 'nunca';
  const min = Math.round((Date.now() - new Date(isoDT)) / 60000);
  if (min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
const esNueva = (it) => !estado.vistosAntes.has(it.id) || diasHasta(it.primeraVez) >= -3;

// ---------- Carga ----------
async function cargar() {
  const g = await almacen.get(['datos', 'favoritas', 'vistos', 'ultimaDescarga', 'errorDescarga', 'perfil', 'config']);
  estado.datos = g.datos || null;
  estado.favoritas = new Set(g.favoritas || []);
  estado.vistosAntes = new Set(g.vistos || []);
  estado.vistos = new Set(g.vistos || []);
  pintarEstadoDatos(g);
  poblarPaises();
  pintarBecas();
  pintarSalud();
  $('#urlDatos').value = g.config?.urlDatos || URL_DATOS_DEFECTO;
  // Al abrir el panel, todo lo visible pasa a "visto" (el ícono deja de mostrar el número)
  if (estado.datos) {
    estado.datos.items.forEach((i) => estado.vistos.add(i.id));
    await almacen.set({ vistos: [...estado.vistos] });
    mensaje({ tipo: 'insignia' });
  }
}

function pintarEstadoDatos(g) {
  const el = $('#estadoDatos');
  if (g.errorDescarga && !g.datos) { el.textContent = `No se pudo descargar: ${g.errorDescarga}`; return; }
  if (!g.datos) { el.textContent = 'Aún sin datos. Pulsa ↻ para descargar.'; return; }
  if (!g.datos.generado) { el.textContent = 'Esperando la primera recolección en GitHub.'; return; }
  el.textContent = `Fechas verificadas ${hace(g.datos.generado)}${g.errorDescarga ? ' · sin conexión' : ''}`;
}

function poblarPaises() {
  const sel = $('#fPais');
  const actual = sel.value;
  const paises = [...new Set((estado.datos?.items || []).map((i) => i.pais).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  sel.replaceChildren(new Option('Todo país', ''), ...paises.map((p) => new Option(p, p)));
  sel.value = paises.includes(actual) ? actual : '';
}

// ---------- Becas ----------
function filtrar(items) {
  const f = estado.filtros;
  const q = sinTildes(f.q.trim());
  return items.filter((it) => {
    if (f.estado === 'vigentes' && it.estado === 'vencida') return false;
    if (f.estado === 'abierta' && it.estado !== 'abierta') return false;
    if (f.nivel && !(it.niveles || []).includes(f.nivel)) return false;
    if (f.pais && it.pais !== f.pais) return false;
    if (f.areas.size && !(it.areas || []).some((a) => f.areas.has(a))) return false;
    if (f.completa && it.cobertura !== 'completa') return false;
    if (f.peru && !it.paraPeru && it.pais !== 'Perú') return false;
    if (f.favs && !estado.favoritas.has(it.id)) return false;
    if (f.nuevas && !esNueva(it)) return false;
    if (q && !sinTildes(`${it.titulo} ${it.resumen} ${it.fuenteNombre} ${it.pais}`).includes(q)) return false;
    return true;
  });
}

function cierre(it) {
  const d = diasHasta(it.fechaLimite);
  const ap = !!it.fechaAprox;
  if (it.estado === 'vencida') return ['gris', `Venció ${ap ? 'en' : 'el'} ${fechaTxt(it.fechaLimite, ap)}`];
  if (d != null) {
    const clase = d <= 7 ? 'urgente' : d <= 21 ? 'pronto' : 'ok';
    if (ap) return [clase, `Cierra a fines de ${mesCorto(it.fechaLimite)} · confirmar día en la web oficial`];
    const txt = d === 0 ? 'Cierra HOY' : d === 1 ? 'Cierra mañana' : `Cierra en ${d} días`;
    return [clase, `${txt} · ${fechaCorta(it.fechaLimite)}`];
  }
  if (it.estado === 'cerrada') return ['gris', `Convocatoria cerrada (${fechaTxt(it.ultimaPasada, ap)}) · próxima por anunciar`];
  return ['gris', 'Fecha por confirmar · revisar web oficial'];
}

function pintarBecas() {
  const lista = $('#lista');
  const vacio = $('#vacio');
  const items = estado.datos?.items || [];
  const vis = filtrar(items);
  const vigentes = items.filter((i) => i.estado !== 'vencida').length;
  $('#contBecas').textContent = vigentes || '';
  $('#resumen').textContent = items.length
    ? `${vis.length} de ${items.length} · ${estado.datos.abiertas} con fecha abierta`
    : '';

  lista.replaceChildren();
  if (!items.length) {
    vacio.hidden = false;
    vacio.innerHTML = '<strong>Todavía no hay becas</strong>El recolector de GitHub corre cada mañana. Si acabas de crear el repositorio, ejecútalo una vez desde la pestaña Actions.';
    return;
  }
  if (!vis.length) {
    vacio.hidden = false;
    vacio.innerHTML = '<strong>Nada con esos filtros</strong>Prueba quitando alguno.';
    return;
  }
  vacio.hidden = true;

  const tpl = $('#tplBeca');
  const frag = document.createDocumentFragment();
  for (const it of vis) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    if (it.estado === 'vencida') li.classList.add('vencida');
    const a = li.querySelector('.titulo');
    a.textContent = it.titulo; a.href = it.url;
    li.querySelector('.meta').textContent = [it.fuenteNombre, it.pais].filter(Boolean).join(' · ');
    li.querySelector('.resumen-beca').textContent = it.resumen || '';

    const tags = li.querySelector('.etiquetas');
    const tag = (txt, cls = '') => { const s = document.createElement('span'); s.className = `tag ${cls}`; s.textContent = txt; tags.append(s); };
    if (esNueva(it)) tag('NUEVA', 'nueva');
    if (it.cambioFecha) tag(`Fecha cambió (antes ${fechaCorta(it.cambioFecha.antes)})`, 'cambio');
    (it.niveles || []).slice(0, 2).forEach((n) => tag(NIVEL[n] || n));
    if (it.cobertura === 'completa') tag('Financiamiento completo');
    else if (it.cobertura === 'parcial') tag('Parcial');
    (it.areas || []).slice(0, 2).forEach((x) => tag(AREA[x] || x));

    const [cls, txt] = cierre(it);
    const c = li.querySelector('.cierre'); c.className = `cierre ${cls}`; c.textContent = txt;
    if (it.verificado) c.title = `Verificado el ${fechaCorta(it.verificado)}`;

    const fav = li.querySelector('.fav');
    const pintarFav = () => { const on = estado.favoritas.has(it.id); fav.classList.toggle('on', on); fav.textContent = on ? '★' : '☆'; fav.setAttribute('aria-pressed', on); };
    pintarFav();
    fav.addEventListener('click', async () => {
      estado.favoritas.has(it.id) ? estado.favoritas.delete(it.id) : estado.favoritas.add(it.id);
      pintarFav();
      await almacen.set({ favoritas: [...estado.favoritas] });
      if (estado.filtros.favs) pintarBecas();
    });
    frag.append(li);
  }
  lista.append(frag);
}

function pintarSalud() {
  const salud = estado.datos?.salud || [];
  const ul = $('#saludLista');
  ul.replaceChildren();
  const malas = salud.filter((s) => !s.ok || s.error).length;
  $('#saludResumen').textContent = salud.length ? `(${salud.length - malas}/${salud.length} OK)` : '';
  for (const s of salud) {
    const li = document.createElement('li');
    const ok = s.ok && !s.error;
    li.textContent = `${ok ? '✔' : '✖'} ${s.nombre} — ${ok ? `${s.items} enlaces${s.via ? ' (vía fuente alternativa)' : ''}` : s.error}`;
    if (!ok) li.className = 'error';
    ul.append(li);
  }
}

// ---------- Empleo ----------
const BUSCAR_CADA_H = 6;
const emp = {
  datos: null, perfil: {}, guardadas: new Set(), ocultas: new Set(), vistasAntes: new Set(), buscando: false,
  seguimiento: {}, ia: {}, iaCache: {},
  f: { q: '', minimo: 60, fuente: '', orden: 'pct', practicas: false, empleos: false, mineras: false, publico: false, guardadas: false, postuladas: false, nuevas: false },
};

// Lo que guardas o a lo que postulas sube ofertas parecidas; lo que ocultas las baja (sin IA)
function modeloAprendizaje() {
  const positivas = new Set([...emp.guardadas, ...Object.entries(emp.seguimiento).filter(([, s]) => s.estado !== 'rechazada').map(([id]) => id)]);
  return aprender(emp.datos?.items || [], positivas, emp.ocultas);
}
async function reaprender() {
  if (!emp.datos) return;
  const m = modeloAprendizaje();
  emp.datos.items.forEach((o) => aplicarAprendizaje(o, m));
  await almacen.set({ empleo: emp.datos });
}

async function cargarEmpleo() {
  const g = await almacen.get(['empleo', 'perfil', 'empleoGuardadas', 'empleoOcultas', 'empleoVistas', 'empleoSeguimiento', 'ia', 'empleoIA']);
  emp.seguimiento = g.empleoSeguimiento || {};
  emp.ia = g.ia || {};
  emp.iaCache = g.empleoIA || {};
  cargarAjustesIa();
  emp.datos = g.empleo || null;
  emp.perfil = g.perfil || {};
  emp.guardadas = new Set(g.empleoGuardadas || []);
  emp.ocultas = new Set(g.empleoOcultas || []);
  emp.vistasAntes = new Set(g.empleoVistas || []);
  cargarPerfil(emp.perfil);
  avisoPerfil();
  poblarFuentes();
  pintarEmpleo();
  pintarSaludEmpleo();
}

function avisoPerfil() {
  const p = emp.perfil;
  const falta = [];
  if (!p.cvTexto) falta.push('pega tu CV');
  if (!p.perfiles?.length) falta.push('marca perfiles');
  if (p.experiencia === '' || p.experiencia == null) falta.push('años de experiencia');
  $('#perfilAviso').textContent = falta.length ? `— falta: ${falta.join(', ')}` : '— completo ✔';
  if (falta.length && !emp.datos) $('#perfilBloque').open = true;
}

function poblarFuentes() {
  const sel = $('#eFuente'); const actual = sel.value;
  const fuentes = [...new Set((emp.datos?.items || []).map((i) => i.fuente))].sort();
  sel.replaceChildren(new Option('Todo portal', ''), ...fuentes.map((f) => new Option(f, f)));
  sel.value = fuentes.includes(actual) ? actual : '';
}

function pintarEstadoEmpleo() {
  const d = emp.datos;
  $('#empleoEstado').textContent = !d ? 'Aún no se ha buscado. Completa tu perfil y pulsa «Buscar ofertas».'
    : `Última búsqueda ${hace(d.generado)} · ${d.total} ofertas vigentes`;
}

function filtrarOfertas() {
  const f = emp.f;
  const q = sinTildes(f.q.trim());
  let base = emp.datos?.items || [];
  if (f.postuladas) {
    // Incluye postulaciones cuya oferta ya fue retirada del portal (se guardó una copia)
    const ids = new Set(base.map((o) => o.id));
    base = [...base, ...Object.entries(emp.seguimiento).filter(([id]) => !ids.has(id)).map(([id, s]) => ({ id, ...s, pct: null, retirada: true }))];
  }
  return base.filter((o) => {
    const seg = emp.seguimiento[o.id];
    if (f.postuladas && !seg) return false;
    if (emp.ocultas.has(o.id) && !f.guardadas && !f.postuladas) return false;
    if (f.guardadas && !emp.guardadas.has(o.id)) return false;
    if (f.minimo && (o.pct ?? 0) < f.minimo && !emp.guardadas.has(o.id) && !seg) return false;
    if (f.fuente && o.fuente !== f.fuente) return false;
    if (f.practicas && !o.practica) return false;
    if (f.empleos && o.practica) return false;
    if (f.mineras && !o.minera) return false;
    if (f.publico && !o.sectorPublico) return false;
    if (f.nuevas && emp.vistasAntes.has(o.id) && diasHasta(o.primeraVez) < -2) return false;
    if (q && !sinTildes(`${o.titulo} ${o.empresa} ${o.ubicacion}`).includes(q)) return false;
    return true;
  }).sort((a, b) => {
    if (f.orden === 'recientes') return (b.publicado || b.primeraVez || '').localeCompare(a.publicado || a.primeraVez || '');
    if (f.orden === 'cierre') return (a.vence || '9999').localeCompare(b.vence || '9999');
    return (b.pct ?? -1) - (a.pct ?? -1) || (b.publicado || '').localeCompare(a.publicado || '');
  });
}

function clasePct(p) { return p == null ? 'gris' : p >= 75 ? 'ok' : p >= 50 ? 'pronto' : 'urgente'; }

function pintarEmpleo() {
  pintarEstadoEmpleo();
  const lista = $('#eLista'); lista.replaceChildren();
  const vacio = $('#eVacio');
  const total = emp.datos?.items.length || 0;
  const vis = filtrarOfertas();
  emp.visibles = vis;
  const dup = emp.datos?.duplicadas ? ` · ${emp.datos.duplicadas} repetidas unidas` : '';
  $('#eResumen').textContent = total ? `${vis.length} de ${total} ofertas${dup}` : '';
  const nSeg = Object.keys(emp.seguimiento).length;
  $('#ePostuladasN').textContent = nSeg || '';
  $('#eSegN').textContent = nSeg;
  $('#eIaBarra').hidden = !configurada(emp.ia) || !funcionActiva(emp.ia, 'lote') || !vis.length;
  const ap = modeloAprendizaje();
  $('#eAprende').textContent = ap.activo ? `El orden ya se afina con tus ${ap.senales} decisiones (guardadas, postuladas y ocultas): hasta ±8 puntos.`
    : 'Guarda u oculta al menos 3 ofertas y el % empezará a afinarse con tus decisiones.';
  if (!total) {
    vacio.hidden = false;
    vacio.textContent = emp.buscando ? 'Buscando en los portales…' : 'Sin ofertas todavía. Pulsa «Buscar ofertas».';
    return;
  }
  vacio.hidden = vis.length > 0;
  if (!vis.length) vacio.textContent = 'Ninguna oferta con estos filtros. Prueba bajar la coincidencia mínima.';
  const tpl = $('#tplOferta');
  const frag = document.createDocumentFragment();
  for (const o of vis.slice(0, 150)) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    const a = li.querySelector('.titulo'); a.href = o.url; a.textContent = o.titulo;
    const cuando = o.publicado ? `publicada ${hace(o.publicado + 'T12:00:00')}` : '';
    li.querySelector('.meta').textContent = [o.empresa, o.ubicacion, o.fuente, cuando].filter(Boolean).join(' · ');
    const pct = li.querySelector('.pct');
    pct.textContent = o.pct == null ? '—' : `${o.pct}%`;
    pct.classList.add(clasePct(o.pct));
    if (o.sinDetalle) pct.title = 'Calculado solo con el título (sin descripción disponible)';

    const et = li.querySelector('.etiquetas');
    const tag = (txt, cls = '') => { const s = document.createElement('span'); s.className = 'tag ' + cls; s.textContent = txt; et.append(s); };
    if (!emp.vistasAntes.has(o.id) || diasHasta(o.primeraVez) >= -2) tag('Nueva', 'nueva');
    if (o.practica) tag('Prácticas', 'acento');
    if (o.minera) tag('Minera');
    if (o.salario) tag(o.salario);
    if (o.modalidad && !o.practica) tag(o.modalidad);
    if (o.vence) { const d = diasHasta(o.vence); tag(d <= 0 ? 'Cierra hoy' : `Cierra en ${d} día${d === 1 ? '' : 's'}`, d <= 3 ? 'urgente' : ''); }
    if (o.convocatoria) tag(`Conv. ${o.convocatoria}`);
    const ia = emp.iaCache[o.id]?.analisis;
    if (ia?.pct != null && funcionActiva(emp.ia, 'analisis')) tag(`IA ${ia.pct}%`, 'ia');
    if (o.retirada) { tag('Ya no aparece en el portal'); li.classList.add('retirada'); }

    const m = li.querySelector('.match');
    const partes = [];
    if (o.coinciden?.length) partes.push(`✔ ${o.coinciden.slice(0, 8).join(', ')}`);
    if (o.faltan?.length) partes.push(`✖ ${o.faltan.slice(0, 6).join(', ')}`);
    if (o.faltanDeseables?.length) partes.push(`○ deseable: ${o.faltanDeseables.slice(0, 4).join(', ')}`);
    m.textContent = partes.join('   ');
    m.hidden = !partes.length;
    const n = li.querySelector('.notas');
    n.textContent = [...(o.notas || []), o.sinDetalle ? 'Sin descripción: el % usa solo el título.' : '',
      o.ajuste ? `${o.ajuste > 0 ? '+' : ''}${o.ajuste} por tus decisiones anteriores` : ''].filter(Boolean).join(' · ');
    n.hidden = !n.textContent;
    if (o.tambienEn?.length) {
      const t = li.querySelector('.tambien'); t.append('También en: ');
      o.tambienEn.forEach((e, i) => { const x = document.createElement('a'); x.href = e.url; x.target = '_blank'; x.rel = 'noopener'; x.textContent = e.fuente; t.append(i ? ', ' : '', x); });
    }

    const sel = li.querySelector('.seg');
    sel.append(new Option('Sin postular', ''), ...Object.entries(ESTADOS).map(([k, v]) => new Option(v, k)));
    sel.value = emp.seguimiento[o.id]?.estado || '';
    sel.classList.toggle('activa', !!sel.value);
    if (emp.seguimiento[o.id]) sel.title = `Postulé el ${fechaCorta(emp.seguimiento[o.id].desde)}`;
    sel.addEventListener('change', async () => {
      emp.seguimiento = marcar(emp.seguimiento, o, sel.value);
      await almacen.set({ empleoSeguimiento: emp.seguimiento });
      await reaprender(); pintarEmpleo();
    });
    const bIa = li.querySelector('.btn-ia');
    // Sin IA conectada el botón invita a conectarla; con IA pero todas las funciones apagadas, se oculta
    bIa.hidden = configurada(emp.ia) && !algunaActiva(emp.ia);
    bIa.addEventListener('click', () => abrirIa(o));

    const fav = li.querySelector('.fav');
    const pintarFav = () => { const on = emp.guardadas.has(o.id); fav.classList.toggle('on', on); fav.textContent = on ? '★' : '☆'; fav.setAttribute('aria-pressed', on); };
    pintarFav();
    fav.addEventListener('click', async () => {
      emp.guardadas.has(o.id) ? emp.guardadas.delete(o.id) : emp.guardadas.add(o.id);
      pintarFav(); await almacen.set({ empleoGuardadas: [...emp.guardadas] });
      await reaprender();
    });
    li.querySelector('.btn-prompt').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(promptCv(o, emp.perfil)); b.textContent = '✔ Copiado'; } catch { b.textContent = 'No se pudo copiar'; }
      setTimeout(() => { b.textContent = '📋 Prompt'; }, 2200);
    });
    const oc = li.querySelector('.btn-ocultar');
    oc.textContent = emp.ocultas.has(o.id) ? 'Mostrar' : 'Ocultar';
    oc.addEventListener('click', async () => {
      emp.ocultas.has(o.id) ? emp.ocultas.delete(o.id) : emp.ocultas.add(o.id);
      await almacen.set({ empleoOcultas: [...emp.ocultas] });
      await reaprender(); pintarEmpleo();
    });
    frag.append(li);
  }
  lista.append(frag);
  $('#eOcultasN').textContent = emp.ocultas.size;
}

function pintarSaludEmpleo() {
  const salud = emp.datos?.salud || [];
  const ul = $('#eSaludLista'); ul.replaceChildren();
  const malas = salud.filter((s) => !s.ok || s.error).length;
  $('#eSaludResumen').textContent = salud.length ? `(${salud.length - malas}/${salud.length} OK)` : '';
  for (const s of salud) {
    const li = document.createElement('li');
    const ok = s.ok && !s.error;
    li.textContent = `${ok ? '✔' : s.ok ? '⚠' : '✖'} ${s.nombre} — ${s.items} ofertas en ${s.consultas} búsquedas${s.error ? ` · ${s.error}` : ''}`;
    if (!s.ok) li.className = 'error';
    ul.append(li);
  }
}

async function copiarDiagnostico(e) {
  const b = e.currentTarget;
  const d = emp.datos || {};
  const info = {
    version: ext?.runtime.getManifest().version,
    navegador: navigator.userAgent,
    busqueda: d.generado || null,
    terminos: d.terminos || null,
    total: d.total ?? null,
    porFuente: (d.items || []).reduce((a, o) => ((a[o.fuente] = (a[o.fuente] || 0) + 1), a), {}),
    sinDescripcion: (d.items || []).filter((o) => o.sinDetalle).length,
    portales: d.salud || [],
  };
  try { await navigator.clipboard.writeText('Diagnóstico Becas al Día\n' + JSON.stringify(info, null, 2)); b.textContent = '✔ Copiado'; } catch { b.textContent = 'No se pudo copiar'; }
  setTimeout(() => { b.textContent = '📋 Copiar diagnóstico'; }, 2200);
}

async function ejecutarBusqueda() {
  if (emp.buscando) return;
  emp.buscando = true;
  const btn = $('#btnBuscarEmpleo'); btn.disabled = true; btn.textContent = 'Buscando…';
  pintarEmpleo();
  try {
    const { empleoDetalles = {} } = await almacen.get('empleoDetalles');
    const parser = new DOMParser();
    const datos = await buscarEmpleo({
      perfil: emp.perfil,
      anterior: emp.datos || {},
      cacheDetalles: empleoDetalles,
      aprendizaje: modeloAprendizaje(),
      dep: {
        fetch: (u, o) => fetch(u, o),
        parsear: (html) => parser.parseFromString(html, 'text/html'),
        alAvanzar: (t) => { $('#empleoProgreso').textContent = t; },
      },
    });
    // Las vistas de la búsqueda anterior dejan de ser «nuevas»
    const vistas = new Set([...emp.vistasAntes, ...(emp.datos?.items || []).map((i) => i.id)]);
    // Los análisis de IA de ofertas que ya no existen se borran (salvo los de postulaciones)
    const vivas = new Set(datos.items.map((i) => i.id));
    for (const id of Object.keys(emp.iaCache)) if (!vivas.has(id) && !emp.seguimiento[id]) delete emp.iaCache[id];
    await almacen.set({ empleo: datos, empleoDetalles, empleoVistas: [...vistas].slice(-3000), empleoIA: emp.iaCache });
    emp.datos = datos; emp.vistasAntes = vistas;
    $('#empleoProgreso').textContent = '';
  } catch (e) {
    $('#empleoProgreso').textContent = `Error en la búsqueda: ${e.message || e}`;
  } finally {
    emp.buscando = false; btn.disabled = false; btn.textContent = 'Buscar ofertas';
    poblarFuentes(); pintarEmpleo(); pintarSaludEmpleo();
  }
}

function busquedaVencida() {
  const g = emp.datos?.generado;
  return !g || (Date.now() - new Date(g)) / 3600000 >= BUSCAR_CADA_H;
}

// ---------- Empleo: perfil ----------
function cargarPerfil(p) {
  const form = $('#perfil');
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') el.checked = (p[el.name] || []).includes(el.value);
    else if (p[el.name] != null) el.value = p[el.name];
  }
}
$('#perfil').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const p = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') { (p[el.name] ||= []); if (el.checked) p[el.name].push(el.value); }
    else p[el.name] = el.value.trim();
  }
  const cambianBusquedas = JSON.stringify([emp.perfil.perfiles, emp.perfil.busquedas]) !== JSON.stringify([p.perfiles, p.busquedas]);
  emp.perfil = p;
  // Recalcular el % de lo ya encontrado con el perfil nuevo (sin volver a buscar)
  if (emp.datos) { const m = modeloAprendizaje(); emp.datos.items.forEach((o) => puntuar(o, p, m)); await almacen.set({ empleo: emp.datos }); }
  await almacen.set({ perfil: p });
  $('#perfilEstado').textContent = 'Perfil guardado ✔ (solo en este navegador)';
  avisoPerfil(); pintarEmpleo();
  if (cambianBusquedas && emp.datos) $('#empleoProgreso').textContent = 'Cambiaste los perfiles: pulsa «Buscar ofertas» para traer ofertas nuevas.';
});
$('#cvArchivo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $('#perfil').elements.cvTexto.value = await f.text();
  $('#perfilEstado').textContent = 'CV cargado: pulsa «Guardar perfil».';
});

// Firefox permite al usuario negar el acceso a los portales: se vuelve a pedir en el mismo clic
const PORTALES_ORIGEN = ['https://pe.computrabajo.com/*', 'https://www.bumeran.com.pe/*', 'https://app.servir.gob.pe/*'];
$('#btnBuscarEmpleo').addEventListener('click', () => {
  if (!ext?.permissions) return ejecutarBusqueda();
  ext.permissions.request({ origins: PORTALES_ORIGEN }).catch(() => false).then(() => ejecutarBusqueda());
});
$('#eBuscar').addEventListener('input', (e) => { emp.f.q = e.target.value; pintarEmpleo(); });
$('#eMinimo').addEventListener('change', (e) => { emp.f.minimo = Number(e.target.value); pintarEmpleo(); });
$('#eFuente').addEventListener('change', (e) => { emp.f.fuente = e.target.value; pintarEmpleo(); });
$('#eOrden').addEventListener('change', (e) => { emp.f.orden = e.target.value; pintarEmpleo(); });
for (const [id, k] of [['#ePracticas', 'practicas'], ['#eEmpleos', 'empleos'], ['#eMineras', 'mineras'], ['#ePublico', 'publico'], ['#eGuardadas', 'guardadas'], ['#ePostuladas', 'postuladas'], ['#eNuevas', 'nuevas']]) {
  $(id).addEventListener('click', (e) => { emp.f[k] = !emp.f[k]; e.currentTarget.classList.toggle('on'); pintarEmpleo(); });
}
$('#eDiagnostico').addEventListener('click', copiarDiagnostico);
$('#eRestaurar').addEventListener('click', async () => { emp.ocultas.clear(); await almacen.set({ empleoOcultas: [] }); await reaprender(); pintarEmpleo(); });
$('#eExportar').addEventListener('click', () => descargar(aCsv(emp.seguimiento), `Postulaciones_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv'));

function descargar(contenido, nombre, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- IA opcional ----------
const depIa = { fetch: (u, o) => fetch(u, o) };
const iaDlg = { oferta: null, tarea: '', texto: '' };

function abrirIa(o) {
  iaDlg.oferta = o; iaDlg.tarea = ''; iaDlg.texto = '';
  const on = configurada(emp.ia);
  $('#iaTitulo').textContent = `✨ ${o.titulo}`;
  $('#iaSub').textContent = on ? `${o.empresa || ''} · con ${PROVEEDORES[emp.ia.proveedor].nombre}${emp.ia.modelo ? ` (${emp.ia.modelo})` : ''}` : o.empresa || '';
  $('#iaSin').hidden = on; $('#iaCon').hidden = !on;
  $('#iaPregunta').value = '';
  $$('#iaDlg [data-tarea]').forEach((b) => { if (b.closest('.ia-tareas')) b.hidden = !funcionActiva(emp.ia, b.dataset.tarea); });
  $('[data-funcion-bloque=pregunta]').hidden = !funcionActiva(emp.ia, 'pregunta');
  $('#iaAviso').textContent = emp.perfil.cvTexto ? '' : 'Aún no pegaste tu CV en «Mi perfil y CV»: los resultados serán genéricos.';
  const previo = funcionActiva(emp.ia, 'analisis') ? emp.iaCache[o.id]?.analisis : null;
  mostrarSalida(previo ? analisisATexto(previo) : '', previo ? 'analisis' : '');
  $('#iaDlg').showModal();
}
function mostrarSalida(texto, tarea) {
  iaDlg.texto = texto; iaDlg.tarea = tarea;
  const s = $('#iaSalida'); s.textContent = texto; s.hidden = !texto; s.scrollTop = 0;
  $('#iaCopiar').hidden = !texto;
  $('#iaDescargar').hidden = !texto || !['cv', 'carta'].includes(tarea);
}
async function ejecutarIa(tarea, o, extra = '') {
  const txt = await generar(emp.ia, armar(tarea, o, emp.perfil, extra), depIa);
  if (tarea !== 'analisis') return txt;
  const a = leerAnalisis(txt);
  emp.iaCache[o.id] = { ...(emp.iaCache[o.id] || {}), analisis: { ...a, el: new Date().toISOString().slice(0, 10) } };
  await almacen.set({ empleoIA: emp.iaCache });
  return analisisATexto(a);
}
$$('#iaDlg [data-tarea]').forEach((b) => b.addEventListener('click', async () => {
  const tarea = b.dataset.tarea; const o = iaDlg.oferta;
  if (!funcionActiva(emp.ia, tarea)) return;
  const extra = $('#iaPregunta').value.trim();
  if (tarea === 'pregunta' && !extra) { $('#iaAviso').textContent = 'Pega primero la pregunta del formulario.'; return; }
  const botones = $$('#iaDlg [data-tarea]'); botones.forEach((x) => { x.disabled = true; });
  $('#iaAviso').textContent = `${TAREAS[tarea].nombre}: consultando a la IA…`;
  try {
    const txt = await ejecutarIa(tarea, o, extra);
    if (iaDlg.oferta === o) { mostrarSalida(txt, tarea); $('#iaAviso').textContent = 'Revisa antes de usar: la IA puede equivocarse.'; }
    if (tarea === 'analisis') pintarEmpleo();
  } catch (e) { $('#iaAviso').textContent = `No se pudo: ${e.message || e}`; }
  botones.forEach((x) => { x.disabled = false; });
}));
$('#iaCopiar').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(iaDlg.texto); b.textContent = '✔ Copiado'; } catch { b.textContent = 'No se pudo copiar'; }
  setTimeout(() => { b.textContent = 'Copiar'; }, 2000);
});
$('#iaDescargar').addEventListener('click', () => {
  const nombre = nombreArchivo(iaDlg.tarea, iaDlg.oferta);
  descargar(aWord(iaDlg.texto, nombre), `${nombre}.doc`, 'application/msword');
});
$('#iaCerrar').addEventListener('click', () => $('#iaDlg').close());
$('#iaCerrar0').addEventListener('click', () => $('#iaDlg').close());
$('#iaConfigurar').addEventListener('click', () => { $('#iaDlg').close(); $('#ajustes').showModal(); $('#iaProveedor').focus(); });

// Segunda opinión en lote: una consulta cada 4,5 s para respetar los límites gratuitos
$('#eIaLote').addEventListener('click', async (e) => {
  const b = e.currentTarget; if (b.disabled || !funcionActiva(emp.ia, 'lote')) return;
  const pend = (emp.visibles || []).filter((o) => !o.retirada && !emp.iaCache[o.id]?.analisis).slice(0, 10);
  const est = $('#eIaLoteEstado');
  if (!pend.length) { est.textContent = '· las primeras ya están analizadas'; return; }
  b.disabled = true; let hechas = 0;
  for (const o of pend) {
    est.textContent = `· ${hechas + 1} de ${pend.length}…`;
    try { await ejecutarIa('analisis', o); hechas++; } catch (err) { est.textContent = `· se detuvo en ${hechas} de ${pend.length}: ${err.message || err}`; b.disabled = false; pintarEmpleo(); return; }
    if (o !== pend.at(-1)) await new Promise((ok) => setTimeout(ok, 4500));
  }
  b.disabled = false; pintarEmpleo();
  est.textContent = `· ${hechas} analizadas: mira la etiqueta «IA %» de cada oferta`;
});

// ---------- IA: ajustes ----------
function leerAjustesIa() {
  const proveedor = $('#iaProveedor').value;
  const funciones = Object.fromEntries($$('[data-funcion]').map((c) => [c.dataset.funcion, c.checked]));
  return proveedor ? { proveedor, clave: $('#iaClave').value.trim(), modelo: $('#iaModelo').value.trim(), base: $('#iaBase').value.trim(), funciones } : {};
}
function pintarCamposIa() {
  const p = $('#iaProveedor').value; const info = PROVEEDORES[p];
  $('#iaCampos').hidden = !p;
  if (!p) return;
  $('#iaBaseFila').hidden = p !== 'compatible';
  $('#iaClaveFila').hidden = p === 'local';
  $('#iaModeloFila').hidden = p === 'local';
  $('#iaAyuda').textContent = p === 'local' ? 'Usa el modelo que Chrome descarga en tu PC (unos 4 GB la primera vez). Es más limitado que los modelos en la nube.'
    : p === 'compatible' ? 'Ejemplos: https://api.groq.com/openai/v1 · https://openrouter.ai/api/v1 · http://localhost:11434/v1 (Ollama, sin clave).'
    : `${info.nombre}: ${info.costo}. Consigue tu clave en ${info.claveEn.replace('https://', '')}`;
}
function cargarAjustesIa() {
  const c = emp.ia || {};
  $('#iaProveedor').value = c.proveedor || '';
  $('#iaClave').value = c.clave || ''; $('#iaModelo').value = c.modelo || ''; $('#iaBase').value = c.base || '';
  $$('[data-funcion]').forEach((x) => { x.checked = funcionActiva(c, x.dataset.funcion); });
  $('#iaEstado').textContent = '';
  pintarCamposIa();
}
// El permiso para llamar al proveedor se pide en el mismo clic (Chrome lo exige así)
function pedirPermisoIa(cfg) {
  const origen = origenDe(cfg);
  if (!origen || !ext?.permissions) return Promise.resolve(true);
  return ext.permissions.request({ origins: [origen] }).catch(() => false);
}
$('#iaProveedor').addEventListener('change', () => {
  // Al cambiar de proveedor, la clave y el modelo del anterior no sirven
  if ($('#iaProveedor').value !== (emp.ia.proveedor || '')) { $('#iaClave').value = ''; $('#iaModelo').value = ''; }
  else cargarAjustesIa();
  $('#iaEstado').textContent = ''; pintarCamposIa();
});
$('#iaProbar').addEventListener('click', async () => {
  const cfg = leerAjustesIa(); const est = $('#iaEstado');
  const permiso = pedirPermisoIa(cfg);
  if (!configurada({ ...cfg, modelo: cfg.modelo || 'x' })) { est.textContent = cfg.proveedor === 'compatible' ? '· escribe la dirección del servicio' : '· escribe tu clave'; return; }
  est.textContent = '· probando…';
  if (!(await permiso)) { est.textContent = '· sin permiso para conectar con el proveedor'; return; }
  const r = await probar(cfg, depIa);
  if (!r.ok) { est.textContent = `· ✖ ${r.error}`; return; }
  $('#iaModelos').replaceChildren(...r.modelos.map((m) => new Option(m, m)));
  $('#iaModelo').value = r.modelo;
  est.textContent = `· ✔ funciona${r.modelos.length > 1 ? ` (${r.modelos.length} modelos; puedes elegir otro)` : ''}. Pulsa «Guardar».`;
});

// ---------- Eventos ----------
$$('.pestana').forEach((b) => b.addEventListener('click', () => {
  $$('.pestana').forEach((x) => { x.classList.toggle('activa', x === b); x.setAttribute('aria-selected', x === b); });
  $$('.panel').forEach((p) => { const on = p.id === b.dataset.pestana; p.hidden = !on; p.classList.toggle('activo', on); });
  // Al abrir Empleo, buscar si la última búsqueda tiene más de 6 h y el perfil tiene algo
  if (b.dataset.pestana === 'empleo' && busquedaVencida() && (emp.perfil.perfiles?.length || emp.perfil.cvTexto)) ejecutarBusqueda();
}));

$('#buscar').addEventListener('input', (e) => { estado.filtros.q = e.target.value; pintarBecas(); });
$('#fEstado').addEventListener('change', (e) => { estado.filtros.estado = e.target.value; pintarBecas(); });
$('#fNivel').addEventListener('change', (e) => { estado.filtros.nivel = e.target.value; pintarBecas(); });
$('#fPais').addEventListener('change', (e) => { estado.filtros.pais = e.target.value; pintarBecas(); });
$$('#fAreas .chip').forEach((c) => c.addEventListener('click', () => {
  const a = c.dataset.area;
  estado.filtros.areas.has(a) ? estado.filtros.areas.delete(a) : estado.filtros.areas.add(a);
  c.classList.toggle('on'); pintarBecas();
}));
for (const [id, k] of [['#fCompleta', 'completa'], ['#fPeru', 'peru'], ['#fFavs', 'favs'], ['#fNuevas', 'nuevas']]) {
  $(id).addEventListener('click', (e) => { estado.filtros[k] = !estado.filtros[k]; e.currentTarget.classList.toggle('on'); pintarBecas(); });
}

$('#btnActualizar').addEventListener('click', async (e) => {
  const b = e.currentTarget; b.classList.add('girando'); b.disabled = true;
  const r = await mensaje({ tipo: 'actualizar' });
  b.classList.remove('girando'); b.disabled = false;
  await cargar();
  if (r && !r.ok) $('#estadoDatos').textContent = `Error al actualizar: ${r.error}`;
});

$('#btnAjustes').addEventListener('click', () => { cargarAjustesIa(); $('#ajustes').showModal(); });
$('#guardarAjustes').addEventListener('click', async () => {
  const ia = leerAjustesIa();
  const permiso = pedirPermisoIa(ia);
  const url = $('#urlDatos').value.trim() || URL_DATOS_DEFECTO;
  const { config = {} } = await almacen.get('config');
  await permiso;
  emp.ia = ia; await almacen.set({ ia });
  pintarEmpleo();
  await almacen.set({ config: { ...config, urlDatos: url } });
  mensaje({ tipo: 'actualizar' }).then(cargar);
});

if (ext) ext.storage.onChanged.addListener((cambios, area) => { if (area === 'local' && cambios.datos) cargar(); });
cargar();
cargarEmpleo();
