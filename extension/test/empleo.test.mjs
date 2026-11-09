// Pruebas de la búsqueda de empleo sin internet: portales simulados con HTML/JSON copiados
// de la estructura real de cada web (nov-2026). Se corre desde collector/: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { coincidencia, aniosPedidos, terminos, promptCv, esMinera, clavesUsuario, seccionar, aprender, ajuste } from '../empleo/coincidencia.js';
import { computrabajo, bumeran, servir, fechaRelativa, slug } from '../empleo/portales.js';
import { buscarEmpleo, terminosBusqueda, puntuar, fusionarDuplicadas, aplicarAprendizaje } from '../empleo/buscador.js';
import { marcar, aCsv } from '../empleo/seguimiento.js';
import { generar, listarModelos, elegirModelo, probar, configurada, origenDe, funcionActiva, algunaActiva } from '../ia/ia.js';
import { armar, leerAnalisis, analisisATexto, aWord, nombreArchivo } from '../ia/tareas.js';

const require = createRequire(new URL('../../collector/package.json', import.meta.url));
const { DOMParser } = require('linkedom');
const parsear = (html) => new DOMParser().parseFromString(html, 'text/html');

let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log('✔', nombre); };
const HOY = new Date('2026-11-09T12:00:00Z');

const PERFIL = {
  profesion: 'Ingeniero ambiental',
  experiencia: '3',
  perfiles: ['ambiental', 'costos-presupuestos', 'cierre-minas'],
  claves: 'S10, MS Project, AutoCAD, Excel avanzado, ISO 14001, cierre de minas',
  cvTexto: 'Ingeniero ambiental colegiado y habilitado. Experiencia en elaboración de presupuestos y metrados con S10, cronogramas en MS Project, planes de cierre de minas y monitoreo ambiental. Manejo de ArcGIS.',
};

// ---------- Coincidencia ----------
await prueba('detecta años de experiencia pedidos', () => {
  assert.equal(aniosPedidos('Experiencia mínima de 3 años en monitoreo ambiental'), 3);
  assert.equal(aniosPedidos('Contar con 5 años de experiencia en el sector minero'), 5);
  assert.equal(aniosPedidos('Experiencia laboral de dos años como mínimo'), 2);
  assert.equal(aniosPedidos('Practicante, no requiere experiencia'), null);
});
await prueba('vocabulario: variantes y Excel avanzado', () => {
  const t = terminos('Manejo de Microsoft Project, Excel nivel avanzado y Primavera P6; conocimiento de la Ley de Contrataciones');
  assert.ok(t.has('MS Project') && t.has('Excel avanzado') && t.has('Primavera P6') && t.has('Contrataciones del Estado'));
  assert.ok(!t.has('Excel'));
});
await prueba('claves del usuario se separan por coma', () => {
  assert.deepEqual(clavesUsuario('S10, Civil 3D;  DS 040').map((c) => c[0]), ['S10', 'Civil 3D', 'DS 040']);
});
await prueba('oferta afín → % alto, con lo que coincide y lo que falta', () => {
  const r = coincidencia({
    titulo: 'Especialista de Costos y Presupuestos – Cierre de minas',
    descripcion: 'Ingeniero ambiental o civil. Experiencia mínima de 3 años. Manejo de S10, MS Project y Primavera P6. Elaboración de metrados.',
  }, PERFIL);
  assert.ok(r.pct >= 75, `pct=${r.pct}`);
  assert.ok(r.coinciden.includes('S10') && r.coinciden.includes('Metrados'));
  assert.deepEqual(r.faltan, ['Primavera P6']);
  assert.equal(r.notas.length, 0);
});
await prueba('otra carrera → tope 35 %', () => {
  const r = coincidencia({ titulo: 'Analista programador', descripcion: 'Bachiller en Ingeniería de Sistemas. Python, SAP.' }, PERFIL);
  assert.ok(r.pct <= 35, `pct=${r.pct}`);
  assert.match(r.notas[0], /otra carrera/);
});
await prueba('menos experiencia de la pedida baja el puntaje y lo explica', () => {
  const a = coincidencia({ titulo: 'Ingeniero ambiental', descripcion: 'Ingeniería ambiental. 3 años de experiencia. ISO 14001.' }, PERFIL);
  const b = coincidencia({ titulo: 'Ingeniero ambiental', descripcion: 'Ingeniería ambiental. 8 años de experiencia. ISO 14001.' }, PERFIL);
  assert.ok(a.pct > b.pct);
  assert.match(b.notas[0], /8 años/);
});
await prueba('sin datos suficientes no inventa: pct null', () => {
  assert.equal(coincidencia({ titulo: 'Vacante', descripcion: '' }, {}).pct, null);
});
await prueba('sin requisitos detallados → tope 70 % y lo avisa', () => {
  const r = coincidencia({ titulo: 'Ingeniero ambiental', descripcion: '' }, PERFIL);
  assert.ok(r.pct <= 70, `pct=${r.pct}`);
  assert.match(r.notas.at(-1), /no detalla/);
});
await prueba('clave del usuario igual al vocabulario no se duplica', () => {
  const r = coincidencia({ titulo: 'Especialista', descripcion: 'Experiencia en planes de cierre de minas' }, PERFIL);
  assert.deepEqual(r.coinciden, ['Cierre de minas']);
});
await prueba('detecta mineras', () => {
  assert.ok(esMinera('Compañía Minera Antamina S.A.'));
  assert.ok(!esMinera('La Calera S.A.C. – planta avícola'));
});
await prueba('prompt de CV: nombre de archivo y no inventar', () => {
  const p = promptCv({ titulo: 'Ingeniero de costos', empresa: 'Volcan Compañía Minera', descripcion: 'S10' }, PERFIL);
  assert.match(p, /CV_Bécquer Melgarejo_Volcan Compañía Minera/);
  assert.match(p, /No inventes/);
  assert.match(p, /Mi CV actual\n.*colegiado/);
});

// ---------- Portales (HTML real simplificado) ----------
const CT_LISTA = `<html><body>
<article class="box_offer sel" data-id="15CD10098">
  <h2 class="fs18 fwB prB"><a class="js-o-link fc_base" href="/ofertas-de-trabajo/oferta-de-trabajo-de-ingeniero-ambiental-en-arequipa-15CD10098#lc=ListOffers-Score4-0"> Ingeniero ambiental / monitoreo </a></h2>
  <p class="dFlex vm_fx fs16 fc_base mt5"><span class="fx_none mr10"><span class="fwB"> 4,1 </span><span class="star"></span></span>
     <a class="fc_base t_ellipsis" href="https://pe.computrabajo.com/greengroup.com" offer-grid-article-company-url=""> Green Group Pe Sac </a></p>
  <p class="fs16 fc_base mt5"><span class="mr10"> Arequipa, Arequipa </span></p>
  <p class="fs13 fc_aux mt15"> Hace 2 días </p>
</article>
<article class="box_offer" data-id="FF52F4F99">
  <h2><a class="js-o-link fc_base" href="/ofertas-de-trabajo/oferta-de-trabajo-de-ingeniero-ambiental-y-vial-FF52F4F99"> Ingeniero Ambiental y vial </a></h2>
  <p class="fs16 fc_base mt5"><span class="mr10"> Tarapoto, San Martin </span></p>
  <div class="fs13 mt15"><span class="dIB mr10"><span class="icon i_salary"></span> S/. 3.500,00 (Mensual) </span></div>
  <p class="fs13 fc_aux mt15"> Ayer </p>
</article></body></html>`;
const CT_DETALLE = `<html><head><script type="application/ld+json">{"@context":"https://schema.org/","@graph":[
 {"@type":"Organization","name":"Computrabajo Perú"},
 {"@type":"JobPosting","title":"Ingeniero ambiental","description":"REQUISITOS:\\nIngeniero ambiental. Experiencia mínima de 3 años en monitoreo ambiental.\\nManejo de ArcGIS y Python.","datePosted":"2026-11-07","validThrough":"2026-12-07T00:00:00","employmentType":"FULL_TIME"}]}</script></head><body></body></html>`;
const BM_JSON = { number: 0, size: 20, total: 2, content: [
  { id: 1118492911, titulo: 'Practicante de Ingeniería Civil - Carhuaquero', detalle: '<p>Nuestro cliente busca practicante de ingeniería civil.</p><p>Manejo de AutoCAD y S10.</p>', empresa: 'Khana Consultores', confidencial: false, fechaPublicacion: '22-10-2026', localizacion: 'Chota, Cajamarca', modalidadTrabajo: 'Presencial', tipoTrabajo: 'Full-time' },
  { id: 1118507407, titulo: 'Ingeniero Ambiental - Datos', detalle: 'Ingeniería ambiental. GIS, Python.', empresa: 'X', confidencial: true, fechaPublicacion: '05-11-2026', localizacion: 'Lima' },
] };
const SV_FORM = `<html><body><form id="frmLstOfertsLabo" name="frmLstOfertsLabo" method="post">
  <input type="hidden" name="frmLstOfertsLabo" value="frmLstOfertsLabo"><input type="hidden" name="frmLstOfertsLabo:modalidadAcceso" value="03">
  <input type="text" name="frmLstOfertsLabo:txtPerfil" value=""><input type="text" name="frmLstOfertsLabo:txtPuesto" value="">
  <select name="frmLstOfertsLabo:cboDep_input"><option value="">x</option></select>
  <button id="frmLstOfertsLabo:j_idt46" name="frmLstOfertsLabo:j_idt46"><span>Buscar</span></button>
  <input type="hidden" name="javax.faces.ViewState" value="-123:456"></form></body></html>`;
const SV_RES = `<html><body><div class="col-sm-12 cuadro-vacantes">
 <div class="row box-mb"><div class="col-sm-12 titulo-vacante"><label>INGENIERO AMBIENTAL</label></div></div>
 <div class="row box-mb"><div class="col-sm-3 text-center nombre-entidad"><span class="detalle-sp"><b>HOSPITAL REGIONAL DOCENTE DE MEDICINA TROPICAL</b></span></div>
 <div class="col-sm-5">
  <div class="row box-mb"><div class="col-sm-12"><span class="sub-titulo">Ubicación:</span>&nbsp; <span class="detalle-sp">JUNIN - CHANCHAMAYO</span></div></div>
  <div class="row box-mb"><div class="col-sm-12"><span class="sub-titulo">Número de Convocatoria:</span>&nbsp; <span class="detalle-sp">D.LEG 1057 - 005</span></div></div>
  <div class="row box-mb"><div class="col-sm-12"><span class="sub-titulo">Remuneración:</span>&nbsp; <span class="detalle-sp"> S/. 3,864.19 </span></div></div>
  <div class="row box-mb"><div class="col-sm-12"><span class="sub-titulo">Fecha Inicio de Publicación:</span>&nbsp; <span class="detalle-sp">02/11/2026 </span></div></div>
  <div class="row box-mb"><div class="col-sm-12"><span class="sub-titulo">Fecha Fin de Publicación:</span>&nbsp; <span class="detalle-sp">13/11/2026 </span></div></div>
 </div></div></div></body></html>`;

const pedidos = [];
const fetchFalso = async (url, op = {}) => {
  pedidos.push({ url, op });
  const resp = (body, status = 200) => ({ ok: status < 400, status, text: async () => body, json: async () => JSON.parse(body) });
  if (url.includes('computrabajo.com/trabajo-de-')) return url.includes('ingeniero-ambiental') ? resp(CT_LISTA) : resp('<html></html>');
  if (url.includes('computrabajo.com/ofertas-de-trabajo/')) return resp(CT_DETALLE);
  if (url.includes('bumeran.com.pe/api/avisos/searchV2')) {
    if (op.headers?.['x-site-id'] !== 'BMPE') return resp('{"error":"x-site-id"}', 400);
    return resp(JSON.stringify(BM_JSON));
  }
  if (url.includes('servir.gob.pe') && url.includes('ofertas_laborales')) return resp(op.method === 'POST' ? SV_RES : SV_FORM);
  if (url.includes('servir.gob.pe')) return resp('<html><body>sin formulario</body></html>');
  return resp('', 404);
};
const dep = { fetch: fetchFalso, parsear };

await prueba('fechas relativas y slug', () => {
  assert.equal(fechaRelativa('Hace 2 días', HOY), '2026-11-07');
  assert.equal(fechaRelativa('Ayer', HOY), '2026-11-08');
  assert.equal(fechaRelativa('Hace 5 horas', HOY), '2026-11-09');
  assert.equal(slug('Costos y Presupuestos'), 'costos-y-presupuestos');
});
await prueba('Computrabajo: lee el listado', async () => {
  const r = await computrabajo.buscar('ingeniero ambiental', dep, HOY);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].id, r[0].empresa, r[0].ubicacion, r[0].publicado], ['ct-15CD10098', 'Green Group Pe Sac', 'Arequipa, Arequipa', '2026-11-07']);
  assert.ok(!r[0].url.includes('#'));
  assert.match(r[1].salario, /3\.500/);
});
await prueba('Computrabajo: lee el JobPosting del detalle', async () => {
  const d = await computrabajo.detalle({ url: 'https://pe.computrabajo.com/ofertas-de-trabajo/x' }, dep);
  assert.match(d.descripcion, /3 años/);
  assert.equal(d.vence, '2026-12-07');
});
await prueba('Bumeran: si rechaza sin cookies, reintenta con las del navegador', async () => {
  const usadas = [];
  const fx = async (url, op) => {
    usadas.push(op.credentials);
    if (op.credentials === 'omit') return { ok: false, status: 403, headers: new Map([['content-type', 'text/html']]) };
    return fetchFalso(url, op);
  };
  const r = await bumeran.buscar('ingeniero civil', { fetch: fx, parsear });
  assert.deepEqual(usadas, ['omit', 'include']);
  assert.ok(r.length > 0);
  const fx403 = async () => ({ ok: false, status: 403 });
  await assert.rejects(bumeran.buscar('x', { fetch: fx403, parsear }), /abre bumeran\.com\.pe/);
});
await prueba('Bumeran: API con x-site-id, confidencial y sin HTML', async () => {
  const r = await bumeran.buscar('ingeniero civil', dep);
  assert.equal(r[0].url, 'https://www.bumeran.com.pe/empleos/aviso-1118492911.html');
  assert.equal(r[0].publicado, '2026-10-22');
  assert.ok(!r[0].descripcion.includes('<p>'));
  assert.equal(r[1].empresa, 'Confidencial');
});
await prueba('Talento Perú: envía el formulario JSF y lee las tarjetas', async () => {
  pedidos.length = 0;
  const r = await servir.buscar('ambiental', dep);
  const post = pedidos.find((p) => p.op.method === 'POST');
  const cuerpo = new URLSearchParams(post.op.body);
  assert.equal(cuerpo.get('frmLstOfertsLabo:txtPuesto'), 'ambiental');
  assert.equal(cuerpo.get('javax.faces.ViewState'), '-123:456');
  assert.equal(cuerpo.get('frmLstOfertsLabo:j_idt46'), 'frmLstOfertsLabo:j_idt46');
  assert.deepEqual([r[0].titulo, r[0].ubicacion, r[0].vence, r[0].convocatoria], ['INGENIERO AMBIENTAL', 'JUNIN - CHANCHAMAYO', '2026-11-13', 'D.LEG 1057 - 005']);
  assert.match(r[0].empresa, /HOSPITAL REGIONAL/);
});

// ---------- Búsqueda completa ----------
await prueba('términos de búsqueda desde el perfil', () => {
  const t = terminosBusqueda({ perfiles: ['ambiental', 'practicas'], busquedas: 'supervisor de obra' });
  assert.ok(t.q.includes('ingeniero ambiental') && t.q.includes('supervisor de obra'));
  assert.ok(t.servirPracticas.includes('ingenieria ambiental'));
  assert.ok(t.servir.includes('supervisor'));
  assert.deepEqual(terminosBusqueda({}).q, ['ingeniero ambiental', 'ingeniero civil']);
});
await prueba('búsqueda completa: fusiona, puntúa, reporta portales caídos', async () => {
  const cache = {};
  const anterior = { items: [
    { id: 'ct-15CD10098', primeraVez: '2026-11-01', vistoUltimo: '2026-11-08', titulo: 'x', descripcion: '' },
    { id: 'viejo', titulo: 'Vieja', descripcion: '', empresa: '', primeraVez: '2026-09-01', vistoUltimo: '2026-09-15' },
    { id: 'vencida', titulo: 'Vencida', descripcion: '', empresa: '', vence: '2026-11-01', primeraVez: '2026-10-01', vistoUltimo: '2026-11-08' },
  ] };
  const perfil = { ...PERFIL, perfiles: ['ambiental', 'practicas'] };
  const r = await buscarEmpleo({ perfil, anterior, cacheDetalles: cache, dep, hoy: HOY });
  const ct = r.items.find((i) => i.id === 'ct-15CD10098');
  assert.equal(ct.primeraVez, '2026-11-01');
  assert.match(ct.descripcion, /ArcGIS/);
  assert.ok(ct.pct > 50, `pct=${ct.pct}`);
  assert.ok(ct.faltan.includes('Python'));
  assert.ok(cache['ct-15CD10098']);
  assert.equal(r.items.find((i) => i.id === 'viejo'), undefined);
  assert.equal(r.items.find((i) => i.id === 'vencida'), undefined);
  assert.ok(r.items.find((i) => i.id === 'bm-1118492911').practica);
  const sv = r.salud.find((s) => s.id === 'servir');
  assert.ok(sv.ok && /fallaron/.test(sv.error)); // la búsqueda de prácticas no tiene formulario en el simulador
  // Segunda búsqueda: el detalle sale de la caché, no se vuelve a pedir
  pedidos.length = 0;
  await buscarEmpleo({ perfil, anterior: r, cacheDetalles: cache, dep, hoy: HOY });
  assert.equal(pedidos.filter((p) => p.url.includes('/ofertas-de-trabajo/')).length, 0);
});
await prueba('re-puntuar al cambiar el perfil', () => {
  const o = { titulo: 'Ingeniero de costos', descripcion: 'Ingeniería civil. Primavera P6.', empresa: 'Minera Las Bambas' };
  puntuar(o, PERFIL); const antes = o.pct;
  puntuar(o, { ...PERFIL, profesion: 'Ingeniero civil', claves: PERFIL.claves + ', Primavera P6' });
  assert.ok(o.pct > antes); assert.ok(o.minera);
});

// ---------- Mejoras sin IA ----------
await prueba('separa indispensable, deseable y beneficios (con saltos de línea)', () => {
  const s = seccionar('Somos una empresa minera líder.\nRequisitos:\n• Ingeniero ambiental colegiado\n• Manejo de S10\nDeseable:\n• Primavera P6\n• Inglés avanzado\nBeneficios:\n• Capacitación en Power BI');
  assert.match(s.req, /S10/); assert.match(s.des, /Primavera/); assert.match(s.des, /Inglés/);
  assert.ok(!/Power BI/.test(s.req + s.des)); assert.ok(!/minera líder/.test(s.req));
});
await prueba('separa por oraciones cuando la descripción viene en una sola línea', () => {
  const s = seccionar('Buscamos ingeniero de costos con experiencia en S10 y metrados. De preferencia con manejo de Primavera P6. Indispensable Excel avanzado. Ofrecemos: ingreso a planilla y cursos de Python.');
  assert.match(s.req, /S10/); assert.match(s.req, /Excel avanzado/);
  assert.match(s.des, /Primavera/); assert.ok(!/Python/.test(s.req + s.des));
});
await prueba('lo deseable pesa menos que lo indispensable', () => {
  const base = { titulo: 'Ingeniero ambiental', empresa: 'X' };
  const comoReq = coincidencia({ ...base, descripcion: 'Requisitos:\nS10\nMS Project\nPrimavera P6\nPython' }, PERFIL);
  const comoDes = coincidencia({ ...base, descripcion: 'Requisitos:\nS10\nMS Project\nDeseable:\nPrimavera P6\nPython' }, PERFIL);
  assert.ok(comoDes.pct > comoReq.pct, `${comoDes.pct} > ${comoReq.pct}`);
  assert.deepEqual(comoDes.faltan, []); assert.deepEqual(comoDes.faltanDeseables.sort(), ['Primavera P6', 'Python']);
  assert.ok(comoReq.faltan.includes('Python'));
  // Los años pedidos solo como deseable no penalizan
  assert.equal(coincidencia({ ...base, descripcion: 'Requisitos:\nS10\nDeseable: 8 años de experiencia en minería' }, PERFIL).partes.experiencia, null);
});
await prueba('aprende de guardadas y ocultas (máx. ±8, respeta el tope)', () => {
  const items = [
    { id: 'a', titulo: 'Analista de costos y presupuestos', empresa: 'Minera Uno' },
    { id: 'b', titulo: 'Ingeniero de costos', empresa: 'Minera Dos' },
    { id: 'c', titulo: 'Vendedor técnico de campo', empresa: 'Ventas SAC' },
    { id: 'd', titulo: 'Asesor vendedor', empresa: 'Ventas SAC' },
  ];
  assert.equal(aprender(items, new Set(['a']), new Set(['c'])).activo, false); // menos de 3 señales
  const m = aprender(items, new Set(['a', 'b']), new Set(['c', 'd']));
  assert.ok(m.activo);
  const sube = ajuste({ titulo: 'Especialista de costos', empresa: 'Otra' }, m);
  const baja = ajuste({ titulo: 'Vendedor de repuestos', empresa: 'Ventas SAC' }, m);
  assert.ok(sube > 0 && sube <= 8, `sube=${sube}`); assert.ok(baja < 0 && baja >= -8, `baja=${baja}`);
  assert.equal(ajuste({ titulo: 'Geólogo de exploraciones', empresa: 'Z' }, m), 0);
  const o = aplicarAprendizaje({ titulo: 'Jefe de costos', empresa: 'Minera Uno', pctBase: 34, tope: 35 }, m);
  assert.equal(o.pct, 35);
  aplicarAprendizaje(o, m); assert.equal(o.pct, 35); // no se acumula al repetir
});
await prueba('une la misma oferta publicada en dos portales', () => {
  const r = fusionarDuplicadas([
    { id: 'ct-1', titulo: 'Ingeniero Ambiental', empresa: 'Minera Sol S.A.', ubicacion: 'Lima, Lima', fuente: 'Computrabajo', url: 'https://ct/1', descripcion: '' },
    { id: 'bm-1', titulo: 'INGENIERO AMBIENTAL', empresa: 'Minera Sol SA', ubicacion: 'Lima', fuente: 'Bumeran', url: 'https://bm/1', descripcion: 'Requisitos: S10', publicado: '2026-11-01' },
    { id: 'bm-2', titulo: 'Ingeniero Ambiental', empresa: 'Minera Sol SA', ubicacion: 'Arequipa', fuente: 'Bumeran', url: 'https://bm/2', descripcion: 'x' },
    { id: 'bm-3', titulo: 'Ingeniero Ambiental', empresa: 'Confidencial', ubicacion: 'Lima', fuente: 'Bumeran', url: 'https://bm/3', descripcion: 'x' },
    { id: 'bm-4', titulo: 'Ingeniero Ambiental', empresa: 'Confidencial', ubicacion: 'Lima', fuente: 'Bumeran', url: 'https://bm/4', descripcion: 'x' },
  ], new Set(['ct-1']));
  assert.equal(r.length, 4); // otra ciudad y las confidenciales no se unen
  const p = r.find((o) => o.id === 'ct-1'); // se conserva la que ya se había mostrado
  assert.deepEqual(p.tambienEn, [{ fuente: 'Bumeran', url: 'https://bm/1' }]);
  assert.match(p.descripcion, /S10/); assert.equal(p.publicado, '2026-11-01');
});
await prueba('registro de postulaciones y CSV para Excel', () => {
  const o = { id: 'ct-1', titulo: 'Ingeniero "senior"; costos', empresa: 'Minera Sol', fuente: 'Computrabajo', url: 'https://ct/1', ubicacion: 'Lima' };
  let s = marcar({}, o, 'postulada', new Date('2026-11-09T15:00:00Z'));
  s = marcar(s, o, 'entrevista', new Date('2026-11-15T15:00:00Z'));
  assert.deepEqual([s['ct-1'].estado, s['ct-1'].desde, s['ct-1'].cambio], ['entrevista', '2026-11-09', '2026-11-15']);
  const csv = aCsv(s);
  assert.ok(csv.startsWith('﻿"Postulé el";"Estado"'));
  assert.match(csv, /"2026-11-09";"Entrevista";"2026-11-15";"Ingeniero ""senior""; costos";"Minera Sol"/);
  assert.deepEqual(marcar(s, o, ''), {});
});

// ---------- IA opcional ----------
const llamadas = [];
const iaFalsa = async (url, op = {}) => {
  llamadas.push({ url, op, cuerpo: op.body ? JSON.parse(op.body) : null });
  const resp = (obj, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(obj) });
  const h = op.headers || {};
  if (url.includes('generativelanguage')) {
    if (h['x-goog-api-key'] !== 'G') return resp({ error: { message: 'API key not valid' } }, 403);
    if (url.includes('/models?')) return resp({ models: [
      { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] }] });
    return resp({ candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: 'hola de gemini' }] } }] });
  }
  if (url.includes('anthropic')) {
    if (url.endsWith('/models?limit=100')) return resp({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }] });
    return resp({ content: [{ type: 'text', text: 'hola de claude' }], stop_reason: 'end_turn' });
  }
  if (url.includes('openai.com')) {
    if (url.endsWith('/models')) return resp({ data: [{ id: 'gpt-6-luna' }, { id: 'gpt-6' }, { id: 'gpt-realtime' }, { id: 'text-embedding-3-small' }] });
    return resp({ choices: [{ message: { content: 'hola de gpt' } }] });
  }
  if (url.includes('localhost')) return url.endsWith('/models') ? resp({ data: [{ id: 'llama3.2' }] }) : resp({ choices: [{ message: { content: 'hola local' } }] });
  return resp({}, 404);
};
const depIa = { fetch: iaFalsa };

await prueba('IA: Gemini, Claude, OpenAI y compatibles (formato de cada API)', async () => {
  const p = { sistema: 'S', mensaje: 'M', json: true, maxTokens: 100 };
  assert.equal(await generar({ proveedor: 'gemini', clave: 'G', modelo: 'gemini-flash-latest' }, p, depIa), 'hola de gemini');
  let c = llamadas.at(-1);
  assert.match(c.url, /v1beta\/models\/gemini-flash-latest:generateContent$/); assert.ok(!c.url.includes('key=')); // la clave va en cabecera, no en la URL
  assert.equal(c.cuerpo.generationConfig.responseMimeType, 'application/json'); assert.equal(c.cuerpo.systemInstruction.parts[0].text, 'S');

  assert.equal(await generar({ proveedor: 'claude', clave: 'C', modelo: 'claude-haiku-5-5' }, p, depIa), 'hola de claude');
  c = llamadas.at(-1);
  assert.deepEqual([c.op.headers['x-api-key'], c.op.headers['anthropic-version'], c.op.headers['anthropic-dangerous-direct-browser-access']], ['C', '2023-06-01', 'true']);
  assert.deepEqual([c.cuerpo.system, c.cuerpo.max_tokens, c.cuerpo.messages[0].content], ['S', 100, 'M']);

  assert.equal(await generar({ proveedor: 'openai', clave: 'O', modelo: 'gpt-6-luna' }, p, depIa), 'hola de gpt');
  c = llamadas.at(-1);
  assert.equal(c.op.headers.authorization, 'Bearer O'); assert.ok(c.cuerpo.max_completion_tokens > 100); assert.equal(c.cuerpo.response_format.type, 'json_object');

  assert.equal(await generar({ proveedor: 'compatible', base: 'http://localhost:11434/v1/', modelo: 'llama3.2' }, p, depIa), 'hola local');
  c = llamadas.at(-1);
  assert.equal(c.url, 'http://localhost:11434/v1/chat/completions'); assert.equal(c.cuerpo.max_tokens, 100); assert.equal(c.op.headers.authorization, undefined);
  assert.equal(c.op.credentials, 'omit');
});
await prueba('IA: lista modelos, elige uno económico y explica los errores', async () => {
  assert.deepEqual(await listarModelos({ proveedor: 'gemini', clave: 'G' }, depIa), ['gemini-2.5-pro', 'gemini-flash-latest']);
  assert.deepEqual(await listarModelos({ proveedor: 'openai', clave: 'O' }, depIa), ['gpt-6', 'gpt-6-luna']);
  assert.equal(elegirModelo('claude', ['claude-opus-5-5', 'claude-haiku-5-5']), 'claude-haiku-5-5');
  const r = await probar({ proveedor: 'gemini', clave: 'G' }, depIa);
  assert.deepEqual([r.ok, r.modelo], [true, 'gemini-flash-latest']);
  const mal = await probar({ proveedor: 'gemini', clave: 'mala' }, depIa);
  assert.equal(mal.ok, false); assert.match(mal.error, /clave no es válida.*API key not valid/);
  await assert.rejects(generar({}, { mensaje: 'x' }, depIa), /no está configurada/);
  await assert.rejects(generar({ proveedor: 'claude', clave: 'C' }, { mensaje: 'x' }, depIa), /Falta elegir el modelo/);
  assert.ok(!configurada({ proveedor: 'gemini' })); assert.ok(configurada({ proveedor: 'local' })); assert.ok(!configurada({ proveedor: 'compatible', clave: 'k' }));
  assert.equal(origenDe({ proveedor: 'claude' }), 'https://api.anthropic.com/*'); assert.equal(origenDe({ proveedor: 'local' }), null);
});
await prueba('IA: instrucciones, lectura del análisis y documento Word', () => {
  const o = { titulo: 'Ingeniero de costos', empresa: 'Minera Sol / Perú', descripcion: 'Requisitos: S10', fuente: 'Bumeran' };
  const a = armar('analisis', o, PERFIL);
  assert.ok(a.json); assert.match(a.mensaje, /Minera Sol/); assert.match(a.mensaje, /Ingeniero ambiental colegiado/); assert.match(a.sistema, /Nunca inventas/);
  assert.match(armar('pregunta', o, { ...PERFIL, salario: '6000' }, '¿Pretensión salarial?').mensaje, /¿Pretensión salarial\?[\s\S]*S\/ 6000/);
  const an = leerAnalisis('```json\n{"pct": 130, "veredicto": "Calza", "requisitos": [{"texto": "S10", "tipo": "Indispensable", "cumple": "Sí", "evidencia": "CV"}, {"texto": "P6", "tipo": "deseable", "cumple": "no"}], "fortalezas": ["a"], "brechas": [], "consejo": "c"}\n```');
  assert.deepEqual([an.pct, an.requisitos[0].cumple, an.requisitos[1].tipo, an.requisitos[1].cumple], [100, 'si', 'deseable', 'no']);
  assert.match(analisisATexto(an), /✔ S10 — CV\n✖ P6 \(deseable\)/);
  assert.throws(() => leerAnalisis('no puedo'), /formato esperado/);
  const w = aWord('# Bécquer\n## Experiencia\n- **S10** <script>\n\nTexto', 'CV');
  assert.match(w, /<h1>Bécquer<\/h1>\n<h2>Experiencia<\/h2>\n<ul>\n<li><b>S10<\/b> &lt;script&gt;<\/li>\n<\/ul>\n<p>Texto<\/p>/);
  assert.equal(nombreArchivo('cv', o), 'CV_Bécquer Melgarejo_Minera Sol Perú');
});

await prueba('IA: funciones activables (por defecto todas activas)', () => {
  assert.ok(funcionActiva({}, 'carta')); assert.ok(funcionActiva({ funciones: { cv: false } }, 'carta'));
  assert.ok(!funcionActiva({ funciones: { cv: false } }, 'cv'));
  assert.ok(!algunaActiva({ funciones: { analisis: false, lote: false, carta: false, cv: false, pregunta: false } }));
});
console.log(`\n${ok} pruebas de empleo OK`);
