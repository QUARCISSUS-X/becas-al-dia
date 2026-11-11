// Empleo → «Rutas de búsqueda» y «Prompt de CV» (portados de la página «Becas al Día»).
import { RUTAS, ESPJ, NIVJ, normalizarSel, busqueda, booleana, bolsas, sinonimos, requisitosTipicos, empresas, rutaDe, promptAviso, nombreCv, AVISO_EJEMPLO } from '../empleo/rutas.js';
import { fmt } from '../curado/estado.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);
// Inserta HTML ya escapado sin usar innerHTML
const parser = new DOMParser();
const poner = (el, html) => el.replaceChildren(...parser.parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes);
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');

// Del perfil de la pestaña «Ofertas» a una selección inicial
const DESDE_PERFIL = { 'cierre-minas': 'cierre', relaves: 'relaves', 'costos-presupuestos': 'costos', 'control-proyectos': 'control', mineria: 'mineria', ambiental: 'ambiental', civil: 'civil' };

async function copiar(texto, estado, ok) {
  try { await navigator.clipboard.writeText(texto); if (estado) estado.textContent = ok; } catch { if (estado) estado.textContent = 'Tu navegador no permitió copiar: selecciona el texto y usa Ctrl+C.'; }
}

export function montarRutas({ almacen }) {
  let sel = normalizarSel({ ruta: 'civil', esp: 'cierre', niv: 'supervisor' });
  let empleoCurado = null;

  async function cargar(perfil = {}) {
    const g = await almacen.get(['rutasSel', 'curadoClaude', 'curadoPropio']);
    empleoCurado = (g.curadoPropio?.empleo && String(g.curadoPropio.actualizado) > String(g.curadoClaude?.actualizado) ? g.curadoPropio : g.curadoClaude)?.empleo || null;
    if (g.rutasSel) sel = normalizarSel(g.rutasSel);
    else {
      const esp = (perfil.perfiles || []).map((p) => DESDE_PERFIL[p]).find(Boolean);
      if (esp) sel = normalizarSel({ ruta: rutaDe(esp), esp, niv: (perfil.perfiles || []).includes('practicas') ? 'pro' : undefined });
    }
    pintar(); llenarCv(); construirPrompt();
  }

  function chips(id, pares, clave) {
    poner($(id), pares.map(([k, v]) => `<button type="button" class="chip${sel[clave] === k ? ' on' : ''}" aria-pressed="${sel[clave] === k}" data-${clave}="${k}">${esc(v)}</button>`).join(''));
  }

  function pintar() {
    chips('#rRuta', Object.entries(RUTAS).map(([k, r]) => [k, r.nombre]), 'ruta');
    chips('#rEsp', RUTAS[sel.ruta].esp.map((k) => [k, ESPJ[k].nombre]), 'esp');
    chips('#rNiv', RUTAS[sel.ruta].niv.map((k) => [k, NIVJ[k].nombre]), 'niv');
    const e = ESPJ[sel.esp]; const n = NIVJ[sel.niv]; const q = busqueda(sel);
    let h = `<div><span class="flabel">Búsqueda principal</span><p class="r-q">${esc(q)}</p><p class="sutil">${esc(e.nombre)} · ${esc(n.nombre)} · ${esc(n.anos)}</p></div>`;
    h += `<div class="r-bolsas">${bolsas(sel).map((b) => `<a class="r-bolsa" href="${esc(b.u)}" target="_blank" rel="noopener"${b.copiar ? ` data-copiar="${esc(q)}"` : ''}><b>${esc(b.n)} ↗</b><span>${esc(b.d)}</span></a>`).join('')}</div>`;
    h += `<div class="bloque"><h4>Sinónimos del puesto</h4><div class="enlaces">${sinonimos(sel).map((s) => `<a class="lk" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.q)} ↗</a>`).join('')}</div><p class="sutil">Cada enlace abre LinkedIn Empleos en Perú con ese término.</p></div>`;
    h += `<div class="bloque"><h4>Búsqueda booleana para LinkedIn</h4><code class="r-bool">${esc(booleana(sel))}</code><p><button type="button" class="enlace" id="rCopiarBool">Copiar búsqueda</button> <span class="sutil" id="rEstado" aria-live="polite"></span></p></div>`;
    h += `<div class="bloque"><h4>Requisitos típicos en los avisos</h4><ul>${requisitosTipicos(sel).map((r) => `<li>${esc(r)}</li>`).join('')}</ul><p class="sutil">Referencial: cada empresa fija sus propios requisitos.</p></div>`;
    h += `<div class="bloque"><h4>Normas que conviene dominar</h4><ul>${e.norma.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
    const sal = empleoCurado?.salarios?.[`${sel.esp}|${sel.niv}`];
    h += `<div class="nota"><strong>Rango salarial.</strong> ${sal ? `${esc(sal.rango)} <a href="${esc(urlSegura(sal.fuente?.u))}" target="_blank" rel="noopener">${esc(sal.fuente?.t)}</a> (revisado el ${esc(fmt(sal.verificado))}).`
      : `${esc(empleoCurado?.nota_salarios || 'Aún no hay una fuente confiable con cifras por puesto y nivel.')}${(empleoCurado?.fuentes_salario || []).length ? ` Puedes consultar: ${empleoCurado.fuentes_salario.map((f) => `<a href="${esc(urlSegura(f.u))}" target="_blank" rel="noopener">${esc(f.t)}</a>`).join(' · ')}.` : ''}`}</div>`;
    h += `<div class="bloque"><h4>Empresas para seguir</h4><div class="enlaces">${empresas(sel).map((c) => `<a class="lk" href="${esc(c.u)}" target="_blank" rel="noopener">${esc(c.n)} ↗</a>`).join('')}</div><p class="sutil">Activa en LinkedIn la alerta de empleo para recibir avisos nuevos cada día.</p></div>`;
    const ofs = (empleoCurado?.ofertas || []).filter((x) => x.esp === sel.esp && (!x.nivel || x.nivel === sel.niv));
    h += `<div class="bloque"><h4>Ofertas verificadas por Claude</h4>${ofs.length ? `<ul class="fuentes">${ofs.map((x) => `<li><a href="${esc(urlSegura(x.url))}" target="_blank" rel="noopener">${esc(x.titulo)} · ${esc(x.empresa)}</a> — ${esc(x.lugar || '')}. Publicada el ${esc(fmt(x.publicado))}${x.cierre ? `, cierra el ${esc(fmt(x.cierre))}` : ''}. ${esc(x.fuente || '')}.</li>`).join('')}</ul>`
      : '<p class="sutil">Aún no hay ofertas puntuales verificadas para esta combinación. Las búsquedas de arriba muestran los avisos del día, y «Ofertas para ti» calcula tu % de coincidencia.</p>'}</div>`;
    poner($('#rSalida'), h);
  }

  async function elegir(clave, valor) {
    sel = normalizarSel(clave === 'ruta' ? { ruta: valor, esp: RUTAS[valor].esp[0], niv: sel.niv } : { ...sel, [clave]: valor });
    await almacen.set({ rutasSel: sel });
    pintar(); $('#cvEsp').value = sel.esp; llenarNiv(sel.niv); construirPrompt();
  }

  // ---------- Prompt de CV ----------
  function llenarCv() {
    const s = $('#cvEsp');
    if (!s.options.length) {
      s.replaceChildren(...Object.entries(RUTAS).map(([, ru]) => { const g = document.createElement('optgroup'); g.label = ru.nombre; g.append(...ru.esp.map((k) => new Option(ESPJ[k].nombre, k))); return g; }));
    }
    s.value = sel.esp; llenarNiv(sel.niv);
  }
  function llenarNiv(mantener) {
    const ns = RUTAS[rutaDe($('#cvEsp').value)].niv;
    $('#cvNiv').replaceChildren(...ns.map((k) => new Option(`${NIVJ[k].nombre} (${NIVJ[k].anos})`, k)));
    if (ns.includes(mantener)) $('#cvNiv').value = mantener;
  }
  function construirPrompt() {
    const s = { esp: $('#cvEsp').value, niv: $('#cvNiv').value };
    if (!ESPJ[s.esp] || !NIVJ[s.niv]) return;
    $('#cvPrompt').value = promptAviso(s, $('#cvOferta').value, $('#cvNombre').value);
    $('#cvArchivoFinal').textContent = `${nombreCv(s, $('#cvOferta').value, $('#cvNombre').value)}.docx`;
  }

  $('#rRuta').addEventListener('click', (e) => { const b = e.target.closest('[data-ruta]'); if (b) elegir('ruta', b.dataset.ruta); });
  $('#rEsp').addEventListener('click', (e) => { const b = e.target.closest('[data-esp]'); if (b) elegir('esp', b.dataset.esp); });
  $('#rNiv').addEventListener('click', (e) => { const b = e.target.closest('[data-niv]'); if (b) elegir('niv', b.dataset.niv); });
  $('#rSalida').addEventListener('click', (e) => {
    if (e.target.id === 'rCopiarBool') { copiar(booleana(sel), $('#rEstado'), 'Búsqueda copiada.'); return; }
    const a = e.target.closest('[data-copiar]');
    if (a) copiar(a.dataset.copiar, $('#rEstado'), 'Palabras clave copiadas: pégalas en el buscador del portal.');
  });
  $('#cvEjemplo').addEventListener('click', () => {
    $('#cvOferta').value = AVISO_EJEMPLO; $('#cvEsp').value = 'cierre'; llenarNiv('supervisor'); $('#cvNombre').value = '';
    construirPrompt(); $('#cvEstado').textContent = 'Se cargó un aviso de ejemplo. Reemplázalo por el aviso real.';
  });
  $('#cvEsp').addEventListener('change', () => { llenarNiv($('#cvNiv').value); construirPrompt(); });
  $('#cvNiv').addEventListener('change', construirPrompt);
  $('#cvOferta').addEventListener('input', construirPrompt);
  $('#cvNombre').addEventListener('input', construirPrompt);
  $('#cvCopiar').addEventListener('click', () => copiar($('#cvPrompt').value, $('#cvEstado'), 'Prompt copiado. Pégalo en un chat nuevo y adjunta tu CV.'));

  return { cargar };
}
