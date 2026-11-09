// Pruebas de la búsqueda de empleo sin internet: portales simulados con HTML/JSON copiados
// de la estructura real de cada web (nov-2026). Se corre desde collector/: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { coincidencia, aniosPedidos, terminos, promptCv, esMinera, clavesUsuario } from '../empleo/coincidencia.js';
import { computrabajo, bumeran, servir, fechaRelativa, slug } from '../empleo/portales.js';
import { buscarEmpleo, terminosBusqueda, puntuar } from '../empleo/buscador.js';

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

console.log(`\n${ok} pruebas de empleo OK`);
