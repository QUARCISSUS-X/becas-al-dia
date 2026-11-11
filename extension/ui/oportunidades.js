// Pestaña «Oportunidades»: becas, eventos y cursos verificados (por Claude cada lunes o por tu IA).
// Misma lógica que la página «Becas al Día»: sello de verificación, línea de tiempo de 6 meses,
// estados abierta / próxima / cerrada y fichas que se despliegan.
import { NIVELES, ESP, TIPOS, CERT, fmt, fmtRango, preparar, marcasLinea, ejeMeses, fechasClave, linkedinUrl, filtrarCurado, hoyLocal, MESES } from '../curado/estado.js';
import { elegirCurado } from '../curado/datos.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');
const $ = (s) => document.querySelector(s);
// Inserta HTML ya escapado sin usar innerHTML
const parser = new DOMParser();
const poner = (el, html) => el.replaceChildren(...parser.parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ul = (arr) => `<ul>${(arr || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

export function montarOportunidades({ almacen, mensaje }) {
  const o = {
    datos: null, items: [], favoritas: new Set(), vistosAntes: new Set(), abiertos: new Set(),
    f: { tipo: 'todo', estado: '', esp: '', nivel: '', q: '', favs: false },
  };

  async function cargar() {
    const g = await almacen.get(['curadoClaude', 'curadoPropio', 'favoritasCurado', 'vistosCurado', 'errorCurado']);
    o.datos = elegirCurado(g.curadoClaude, g.curadoPropio);
    o.favoritas = new Set(g.favoritasCurado || []);
    o.vistosAntes = new Set(g.vistosCurado || (o.datos?.becas || []).map((b) => b.id));
    o.items = preparar(o.datos, hoyLocal());
    pintarCabeza(g);
    pintarFiltros();
    pintar();
    pintarRegistro();
    // Lo que se ve al abrir deja de contar como novedad en el ícono
    if (o.datos) {
      await almacen.set({ vistosCurado: [...new Set([...o.vistosAntes, ...o.datos.becas.map((b) => b.id)])] });
      mensaje({ tipo: 'insignia' });
    }
  }

  function pintarCabeza(g) {
    const d = o.datos;
    $('#oSello').textContent = d ? fmt(d.actualizado).toUpperCase() : '—';
    $('#oFrec').textContent = d ? (d.origen === 'ia' ? `revisión de ${d.proveedor || 'tu IA'}` : `revisión ${d.frecuencia || 'semanal'}`) : 'sin datos';
    const otra = d?.origen === 'ia' ? g.curadoClaude : g.curadoPropio;
    $('#oOrigen').textContent = !d ? (g.errorCurado ? `No se pudieron descargar: ${g.errorCurado}` : 'Descargando las oportunidades verificadas…')
      : d.origen === 'ia' ? `Datos de tu revisión con ${d.proveedor || 'IA'}${otra ? ` · Claude verificó el ${fmt(otra.actualizado)}` : ''}.`
        : `Verificadas por Claude${g.curadoPropio ? ` · tu IA revisó el ${fmt(g.curadoPropio.actualizado)}` : ''}.`;
    const abiertas = o.items.filter((b) => b.st.k === 'abierta').length;
    $('#contOport').textContent = abiertas || '';
  }

  function pintarFiltros() {
    const esp = $('#oEsp'); const niv = $('#oNivel');
    if (!esp.options.length) {
      esp.append(new Option('Toda especialidad', ''), ...Object.entries(ESP).map(([k, v]) => new Option(v, k)));
      niv.append(new Option('Todo nivel', ''), ...Object.entries(NIVELES).map(([k, v]) => new Option(v, k)));
    }
    niv.hidden = o.f.tipo === 'evento' || o.f.tipo === 'curso';
  }

  const base = () => filtrarCurado(o.items, { tipo: o.f.tipo, esp: o.f.esp });

  function pintarTipos() {
    poner($('#oTipos'), Object.entries(TIPOS).map(([k, v]) => {
      const n = o.items.filter((b) => k === 'todo' || b.tipo === k).length;
      return `<button type="button" class="o-tipo" data-tipo="${k}" aria-pressed="${o.f.tipo === k}">${esc(v)} <span>${n}</span></button>`;
    }).join(''));
  }

  function pintarConteos() {
    const c = { abierta: 0, porabrir: 0, cerrada: 0 };
    base().forEach((b) => { c[b.st.k]++; });
    const lbl = { abierta: 'abiertas', porabrir: 'próximas', cerrada: 'cerradas' };
    poner($('#oConteos'), Object.keys(c).map((k) =>
      `<button type="button" class="o-conteo" data-estado="${k}" aria-pressed="${o.f.estado === k}"><i class="punto ${k}"></i><b>${c[k]}</b> ${lbl[k]}</button>`).join(''));
  }

  function pintarLinea() {
    const hoy = hoyLocal();
    const grid = ejeMeses(hoy);
    const rejilla = grid.map((m) => `<span class="tl-rejilla" style="left:${m.l}%"></span>`).join('');
    let html = `<div class="tl-fila tl-eje"><span class="tl-hoy-lbl">Hoy, ${hoy.getDate()} ${MESES[hoy.getMonth()]}</span><div class="tl-pista">${grid.map((m) => `<span class="tl-mes" style="left:${m.l}%">${m.txt}</span>`).join('')}</div></div>`;
    let filas = 0;
    for (const b of base()) {
      const marcas = marcasLinea(b, hoy);
      if (!marcas.length) continue;
      filas++;
      const dentro = rejilla + '<span class="tl-hoy"></span>' + marcas.map((m) => m.pin
        ? `<button type="button" class="pin" style="left:${m.l}%" title="${esc(m.tip)}" aria-label="${esc(m.tip)}" data-abrir="${esc(b.id)}"></button>`
        : `<button type="button" class="bar ${m.cls}" style="left:${m.l}%;width:${Math.max(0.8, m.r - m.l)}%" title="${esc(m.tip)}" aria-label="${esc(m.tip)}" data-abrir="${esc(b.id)}"></button>`).join('');
      html += `<div class="tl-fila"><button type="button" class="tl-nombre" data-abrir="${esc(b.id)}" title="${esc(b.nombre)}">${esc(b.corto || b.nombre)}</button><div class="tl-pista">${dentro}</div></div>`;
    }
    if (!filas) html += '<p class="sutil" style="padding:8px 0">Nada en esta selección durante los próximos seis meses.</p>';
    poner($('#oLinea'), html);
  }

  function etiquetas(b) {
    let t = '';
    if (b.tipo === 'evento') t += `<span class="tag tipo-ev">${esc(b.formato || 'Evento')}</span>${b.gratis ? '<span class="tag gratis">Gratuito</span>' : ''}`;
    else if (b.tipo === 'curso') t += `<span class="tag tipo-cur">Curso</span><span class="tag${b.cert === 'gratis' ? ' gratis' : ''}">${esc(CERT[b.cert] || '')}</span>`;
    else t += b.nivel.map((n) => `<span class="tag">${esc(NIVELES[n] || n)}</span>`).join('');
    if (b.esp.includes('todas')) t += b.tipo !== 'beca' ? '<span class="tag">Todas las ramas</span>' : '';
    else t += b.esp.map((k) => `<span class="tag">${esc(ESP[k] || k)}</span>`).join('');
    if (!o.vistosAntes.has(b.id)) t += '<span class="tag nueva">NUEVA</span>';
    return t;
  }

  function ficha(b) {
    const ev = b.tipo === 'evento'; const cu = b.tipo === 'curso'; const st = b.st;
    let h = '<div class="ficha">';
    h += `<div class="ficha-top"><a class="cta" href="${esc(urlSegura(b.postular.url))}" target="_blank" rel="noopener">${esc(b.postular.texto || 'Ver convocatoria')} ↗</a><span class="verif">Verificado el ${esc(fmt(b.verificado))}</span></div>`;
    if (b.resumen) h += `<p class="lede">${esc(b.resumen)}</p>`;
    if (ev) h += `<dl class="datos"><div><dt>Fecha</dt><dd>${esc(b.modo === 'continua' ? b.recurrencia || 'Permanente' : fmtRango(b.evento))}</dd></div><div><dt>Lugar</dt><dd>${esc(b.destino)}</dd></div><div><dt>Modalidad</dt><dd>${esc(b.modalidad)}</dd></div><div><dt>Costo</dt><dd>${esc(b.costo)}</dd></div></dl>`;
    if (cu) h += `<dl class="datos"><div><dt>Plataforma</dt><dd>${esc(b.plataforma)}</dd></div><div><dt>Duración</dt><dd>${esc(b.duracion)}</dd></div><div><dt>Idioma</dt><dd>${esc(b.idioma)}</dd></div><div><dt>Certificado</dt><dd>${esc(b.certificado)}</dd></div></dl>`;
    if (st.k === 'cerrada') {
      let nx = b.proxima || st.sub.replace(/^Próxima edición: /, '');
      nx = nx.charAt(0).toUpperCase() + nx.slice(1);
      h += `<div class="nota gris"><strong>Próxima edición.</strong> ${esc(nx)}${b.proxima ? '' : ', según el ciclo anterior.'}</div>`;
    }
    h += `<div class="bloque"><h4>${ev ? 'Quién puede participar' : cu ? 'Para quién es' : 'Requisitos'}</h4>${ul(b.requisitos)}</div>`;
    h += `<div class="bloque"><h4>${ev || cu ? 'Qué incluye' : 'Beneficios'}</h4>${ul(b.beneficios)}</div>`;
    h += `<div class="bloque"><h4>${ev || cu ? 'Cómo inscribirte' : 'Documentos para postular'}</h4>${ul(b.documentos)}</div>`;
    const fc = fechasClave(b, hoyLocal());
    if (fc.length) h += `<div class="bloque"><h4>Fechas clave</h4><ul class="fechas">${fc.map((f) => `<li class="${f.cls}"><span class="cuando">${esc(f.cuando)}</span><span>${esc(f.que)}${f.estimada ? '<span class="est">estimada</span>' : ''}</span></li>`).join('')}</ul></div>`;
    if (b.nota) h += `<div class="nota">${esc(b.nota)}</div>`;
    h += `<div class="bloque"><h4>${ev ? 'Asistentes y ponentes en LinkedIn' : cu ? 'Quienes lo completaron' : 'Ganadores y redes de becarios'}</h4><div class="enlaces">`;
    h += `<a class="lk" href="${linkedinUrl('people', b.linkedin)}" target="_blank" rel="noopener">Personas ↗</a><a class="lk" href="${linkedinUrl('content', b.linkedin)}" target="_blank" rel="noopener">Publicaciones ↗</a>`;
    h += (b.redes || []).map((r) => `<a class="lk" href="${esc(urlSegura(r.url))}" target="_blank" rel="noopener">${esc(r.nombre)} ↗</a>`).join('');
    h += `</div><p class="sutil">Búsqueda: «${esc(b.linkedin)}». Requiere iniciar sesión en LinkedIn.</p></div>`;
    if (b.fuentes.length) h += `<div class="bloque"><h4>Fuentes revisadas</h4><ul class="fuentes">${b.fuentes.map((f) => `<li><a href="${esc(urlSegura(f.u))}" target="_blank" rel="noopener">${esc(f.t)}</a></li>`).join('')}</ul></div>`;
    return h + '</div>';
  }

  function pintarLista() {
    const lista = filtrarCurado(o.items, o.f, o.favoritas);
    $('#oResumen').textContent = o.items.length ? `${plural(lista.length, 'resultado')}${lista.length === o.items.length ? '' : ` de ${o.items.length}`}` : '';
    const vacio = $('#oVacio');
    if (!o.items.length) {
      poner($('#oLista'), '');
      vacio.hidden = false;
      poner(vacio, '<strong>Aún no hay oportunidades</strong>Pulsa ↻ para descargar las que Claude verifica cada lunes.');
      return;
    }
    vacio.hidden = !!lista.length;
    if (!lista.length) poner(vacio, '<strong>Nada coincide con esos filtros</strong>Prueba con otra especialidad o borra la búsqueda.');
    poner($('#oLista'), lista.map((b) => {
      const abierto = o.abiertos.has(b.id); const fav = o.favoritas.has(b.id);
      return `<article class="item${abierto ? ' abierto' : ''}" id="o-${esc(b.id)}">
        <div class="item-cab">
          <button type="button" class="fila-item" aria-expanded="${abierto}" data-alternar="${esc(b.id)}">
            <span class="pill ${b.st.k}"><i class="punto ${b.st.k}"></i>${esc(b.st.lbl)}</span>
            <span class="i-nombre">${esc(b.nombre)}</span>
            <span class="i-meta">${esc([b.entidad, b.destino].filter(Boolean).join(' · '))}</span>
            <span class="i-tags">${etiquetas(b)}</span>
            <span class="i-fecha"><b>${esc(b.st.main)}</b> <span>${esc(b.st.sub)}</span></span>
          </button>
          <button type="button" class="fav${fav ? ' on' : ''}" data-fav="${esc(b.id)}" aria-pressed="${fav}" title="${fav ? 'Quitar de favoritas' : 'Favorita: te aviso antes del cierre'}">${fav ? '★' : '☆'}</button>
        </div>
        <div class="item-ficha"${abierto ? '' : ' hidden'}>${abierto ? ficha(b) : ''}</div>
      </article>`;
    }).join(''));
  }

  function pintarRegistro() {
    poner($('#oRegistro'), (o.datos?.registro || []).slice(0, 8).map((r) =>
      `<div class="registro"><span class="verif">${esc(fmt(r.fecha))}${r.origen === 'ia' ? ' · tu IA' : ''}</span>${ul(r.notas)}</div>`).join('') || '<p class="sutil">Sin cambios registrados.</p>');
  }

  function pintar() { pintarTipos(); pintarConteos(); pintarLinea(); pintarLista(); }

  function alternar(id, forzar) {
    const abrir = forzar ?? !o.abiertos.has(id);
    abrir ? o.abiertos.add(id) : o.abiertos.delete(id);
    const art = document.getElementById(`o-${id}`);
    if (!art) return false;
    const b = o.items.find((x) => x.id === id);
    art.classList.toggle('abierto', abrir);
    art.querySelector('.fila-item').setAttribute('aria-expanded', abrir);
    const panel = art.querySelector('.item-ficha');
    panel.hidden = !abrir; poner(panel, abrir ? ficha(b) : '');
    return true;
  }

  function abrirDesdeLinea(id) {
    if (!document.getElementById(`o-${id}`)) { o.f.estado = ''; o.f.q = ''; o.f.favs = false; $('#oBuscar').value = ''; $('#oFavs').setAttribute('aria-pressed', 'false'); pintar(); }
    alternar(id, true);
    document.getElementById(`o-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Eventos ----------
  $('#oTipos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]'); if (!b) return;
    o.f.tipo = b.dataset.tipo; if (o.f.tipo !== 'beca' && o.f.tipo !== 'todo') o.f.nivel = '';
    $('#oNivel').value = o.f.nivel; pintarFiltros(); pintar();
  });
  $('#oConteos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-estado]'); if (!b) return;
    o.f.estado = o.f.estado === b.dataset.estado ? '' : b.dataset.estado; pintarConteos(); pintarLista();
  });
  $('#oBuscar').addEventListener('input', (e) => { o.f.q = e.target.value; pintarLista(); });
  $('#oEsp').addEventListener('change', (e) => { o.f.esp = e.target.value; pintar(); });
  $('#oNivel').addEventListener('change', (e) => { o.f.nivel = e.target.value; if (o.f.nivel && o.f.tipo !== 'beca') o.f.tipo = 'beca'; pintar(); });
  $('#oFavs').addEventListener('click', (e) => { o.f.favs = !o.f.favs; e.currentTarget.setAttribute('aria-pressed', o.f.favs); e.currentTarget.classList.toggle('on', o.f.favs); pintarLista(); });
  $('#oLinea').addEventListener('click', (e) => { const b = e.target.closest('[data-abrir]'); if (b) abrirDesdeLinea(b.dataset.abrir); });
  $('#oLista').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-alternar]');
    if (t) { alternar(t.dataset.alternar); return; }
    const f = e.target.closest('[data-fav]');
    if (f) {
      const id = f.dataset.fav;
      o.favoritas.has(id) ? o.favoritas.delete(id) : o.favoritas.add(id);
      await almacen.set({ favoritasCurado: [...o.favoritas] });
      const on = o.favoritas.has(id);
      f.classList.toggle('on', on); f.textContent = on ? '★' : '☆'; f.setAttribute('aria-pressed', on);
      f.title = on ? 'Quitar de favoritas' : 'Favorita: te aviso antes del cierre';
      mensaje({ tipo: 'favoritas' });
      if (o.f.favs) pintarLista();
    }
  });

  return { cargar };
}
