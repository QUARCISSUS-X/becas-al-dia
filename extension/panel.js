// Becas al Día — panel lateral con dos pestañas: Becas y Empleo.
import { buscarEmpleo, puntuar } from './empleo/buscador.js';
import { promptCv } from './empleo/coincidencia.js';
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
  f: { q: '', minimo: 60, fuente: '', orden: 'pct', practicas: false, empleos: false, mineras: false, publico: false, guardadas: false, nuevas: false },
};

async function cargarEmpleo() {
  const g = await almacen.get(['empleo', 'perfil', 'empleoGuardadas', 'empleoOcultas', 'empleoVistas']);
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
  return (emp.datos?.items || []).filter((o) => {
    if (emp.ocultas.has(o.id) && !f.guardadas) return false;
    if (f.guardadas && !emp.guardadas.has(o.id)) return false;
    if (f.minimo && (o.pct ?? 0) < f.minimo && !emp.guardadas.has(o.id)) return false;
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
  $('#eResumen').textContent = total ? `${vis.length} de ${total} ofertas` : '';
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

    const m = li.querySelector('.match');
    const partes = [];
    if (o.coinciden?.length) partes.push(`✔ ${o.coinciden.slice(0, 8).join(', ')}`);
    if (o.faltan?.length) partes.push(`✖ ${o.faltan.slice(0, 6).join(', ')}`);
    m.textContent = partes.join('   ');
    m.hidden = !partes.length;
    const n = li.querySelector('.notas');
    n.textContent = [...(o.notas || []), o.sinDetalle ? 'Sin descripción: el % usa solo el título.' : ''].filter(Boolean).join(' · ');
    n.hidden = !n.textContent;

    const fav = li.querySelector('.fav');
    const pintarFav = () => { const on = emp.guardadas.has(o.id); fav.classList.toggle('on', on); fav.textContent = on ? '★' : '☆'; fav.setAttribute('aria-pressed', on); };
    pintarFav();
    fav.addEventListener('click', async () => {
      emp.guardadas.has(o.id) ? emp.guardadas.delete(o.id) : emp.guardadas.add(o.id);
      pintarFav(); await almacen.set({ empleoGuardadas: [...emp.guardadas] });
    });
    li.querySelector('.btn-prompt').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(promptCv(o, emp.perfil)); b.textContent = '✔ Copiado'; } catch { b.textContent = 'No se pudo copiar'; }
      setTimeout(() => { b.textContent = '📋 Prompt para CV'; }, 2200);
    });
    const oc = li.querySelector('.btn-ocultar');
    oc.textContent = emp.ocultas.has(o.id) ? 'Mostrar' : 'Ocultar';
    oc.addEventListener('click', async () => {
      emp.ocultas.has(o.id) ? emp.ocultas.delete(o.id) : emp.ocultas.add(o.id);
      await almacen.set({ empleoOcultas: [...emp.ocultas] });
      pintarEmpleo();
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
      dep: {
        fetch: (u, o) => fetch(u, o),
        parsear: (html) => parser.parseFromString(html, 'text/html'),
        alAvanzar: (t) => { $('#empleoProgreso').textContent = t; },
      },
    });
    // Las vistas de la búsqueda anterior dejan de ser «nuevas»
    const vistas = new Set([...emp.vistasAntes, ...(emp.datos?.items || []).map((i) => i.id)]);
    await almacen.set({ empleo: datos, empleoDetalles, empleoVistas: [...vistas].slice(-3000) });
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
  if (emp.datos) { emp.datos.items.forEach((o) => puntuar(o, p)); await almacen.set({ empleo: emp.datos }); }
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

$('#btnBuscarEmpleo').addEventListener('click', ejecutarBusqueda);
$('#eBuscar').addEventListener('input', (e) => { emp.f.q = e.target.value; pintarEmpleo(); });
$('#eMinimo').addEventListener('change', (e) => { emp.f.minimo = Number(e.target.value); pintarEmpleo(); });
$('#eFuente').addEventListener('change', (e) => { emp.f.fuente = e.target.value; pintarEmpleo(); });
$('#eOrden').addEventListener('change', (e) => { emp.f.orden = e.target.value; pintarEmpleo(); });
for (const [id, k] of [['#ePracticas', 'practicas'], ['#eEmpleos', 'empleos'], ['#eMineras', 'mineras'], ['#ePublico', 'publico'], ['#eGuardadas', 'guardadas'], ['#eNuevas', 'nuevas']]) {
  $(id).addEventListener('click', (e) => { emp.f[k] = !emp.f[k]; e.currentTarget.classList.toggle('on'); pintarEmpleo(); });
}
$('#eRestaurar').addEventListener('click', async () => { emp.ocultas.clear(); await almacen.set({ empleoOcultas: [] }); pintarEmpleo(); });

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

$('#btnAjustes').addEventListener('click', () => $('#ajustes').showModal());
$('#guardarAjustes').addEventListener('click', async () => {
  const url = $('#urlDatos').value.trim() || URL_DATOS_DEFECTO;
  const { config = {} } = await almacen.get('config');
  await almacen.set({ config: { ...config, urlDatos: url } });
  mensaje({ tipo: 'actualizar' }).then(cargar);
});

if (ext) ext.storage.onChanged.addListener((cambios, area) => { if (area === 'local' && cambios.datos) cargar(); });
cargar();
cargarEmpleo();
