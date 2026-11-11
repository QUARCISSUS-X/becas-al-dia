// Pruebas de los portales de las mineras (Fase 2b) sin internet: copias reducidas de la
// estructura real de cada web (nov-2026). Se corre desde collector/: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MINERAS_INTERES, minerasDe, origenesMineras, fechaIso, aplanar, descripcionAbril } from '../empleo/mineras.js';
import { buscarEmpleo } from '../empleo/buscador.js';
import { enlacesExternos } from '../empleo/enlaces.js';

const require = createRequire(new URL('../../collector/package.json', import.meta.url));
const { DOMParser } = require('linkedom');
const parsear = (html) => new DOMParser().parseFromString(html, 'text/html');

let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log('✔', nombre); };
const HOY = new Date('2026-11-11T15:00:00Z');

// ---------- Páginas simuladas ----------
const fila = (titulo, href, fecha, lugar = '') => `<tr class="data-row"><td class="colTitle"><span class="jobTitle hidden-phone"><a href="${href}" class="jobTitle-link">${titulo}</a></span>
  <div class="jobdetail-phone visible-phone"><span class="jobTitle visible-phone"><a class="jobTitle-link" href="${href}">${titulo}</a></span></div></td>
  <td class="colDate hidden-phone"><span class="jobDate">${fecha}</span></td><td class="colLocation hidden-phone"><span class="jobLocation">${lugar}</span></td></tr>`;
const SF_ANTAMINA = `<html><body><span class="paginationLabel">Resultados 1 – 2 de 2</span><table><tbody>
  ${fila('Analista Senior de Costos', '/job/Analista-Senior-de-Costos/1338092462/', '9 nov 2026', ' Peru ')}
  ${fila('Ingeniero(a) Senior de Proyectos de Innovación', '/job/Ingeniero%28a%29-Senior/1338092962/', '9 nov 2026')}
</tbody></table></body></html>`;
const SF_DETALLE = `<html><body><div itemscope itemtype="http://schema.org/JobPosting">
  <span itemprop="title">Analista Senior de Costos</span><span itemprop="hiringOrganization">Antamina</span>
  <span itemprop="jobLocation"><span itemprop="address"><span itemprop="streetAddress">Peru - Lima</span></span></span>
  <meta itemprop="datePosted" content="Mon Nov 09 00:00:00 UTC 2026"><meta itemprop="validThrough" content="Tue Nov 24 05:00:00 UTC 2026">
  <span itemprop="description"><p>Misión del Puesto</p><p>Participar en la elaboración del presupuesto anual con foco en OPEX.</p>
  <p>Requisitos</p><ul><li>Ingeniero industrial, civil o economista</li><li>Power BI y SAP</li></ul></span></div></body></html>`;
const SF_MINSUR = `<html><body><span class="paginationLabel">Resultados 1 – 1 de 1</span><table><tbody>
  ${fila('PRACTICANTE DE CONTROL DE PROYECTOS', '/minsur/job/PRACTICANTE-DE-CONTROL-DE-PROYECTOS/1338013562/', '5 nov 2026')}
</tbody></table></body></html>`;
const ABRIL = {
  jobs_count: 2,
  jobs: [
    { id: 24670, job: 'Ingeniero Junior de Obras Civiles | UM Yauricocha', company__name: 'Alpayana', open: true, init_date: '2026-11-04 05:00:00+00:00', ending_date: null,
      profile_form_new: { header: '<p>Somos Alpayana, un grupo minero.</p>', functionalities: 'Supervisar obras civiles.\nControlar metrados y valorizaciones.',
        educational_level: [{ name: 'Universitario' }], programs_knowledges: [{ name: 'AutoCAD', value: 'Intermedio' }, { name: 'S10' }],
        experience_years_general: 2, experience_years_specific: 0, contract_type: 'Plazo fijo', benefits: [{ id: 'eps-1', item: 'eps', value: '' }],
        experience_background: [{ description: 'Experiencia de 2 años en obras civiles.', id: 'experience_background-1', is_essential: false }],
        languages: [{ id: 'languages-1', is_essential: false, level: 'Intermedio alto', type: 'Inglés' }] } },
    { id: 24000, job: 'Cerrada', company__name: 'Alpayana', open: false, profile_form_new: {} },
  ],
};
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const HR_NUEVO = `<html><head>${ld({ '@type': 'Organization', name: 'SOCIEDAD MINERA CERRO VERDE' })}${ld({ '@type': 'ItemList', numberOfItems: 1, itemListElement: [
  { '@type': 'ListItem', position: 1, item: { '@type': 'JobPosting', title: 'Ingeniero Mecánico (Construcción)', datePosted: '2026-11-06', validThrough: '2025-05-06',
    employmentType: 'FULL_TIME', jobLocation: { '@type': 'Place', address: 'Arequipa, Arequipa, Peru' },
    description: '<ul><li>Elaborar y consolidar los presupuestos de los proyectos.</li></ul>',
    url: 'http://cerroverde.hiringroom.com/jobs/get_vacancy/6aee669cbc74ae2bfc60ecf3' } }] })}</head><body></body></html>`;
const tarjeta = (id, titulo, cuando) => `<a href="/jobs/get_vacancy/${id}" class="text-decoration-none hrc-black"><div><h4> ${titulo} </h4>
  <p><span class="font-weight-light"><i class="hr-Location-pin hrc-black"></i> Pataz, La Libertad, Peru </span></p>
  <p class="vacancy-time card-text"><span class="hrc-green">Nuevo</span> ${cuando}</p></div></a>`;
const HR_ANTIGUO = `<html><body><a href="https://hiringroom.com/jobs/get_vacancy/5f87/candidates/new">Subir CV</a>
  ${tarjeta('6af4a9c4', 'Operador de Planta', 'Hace 4 horas')}${tarjeta('6aa47a7c', 'Ingeniero de Costos', 'Hace 2 días')}</body></html>`;
const HR_DETALLE = `<html><body><div class="hero__title"><h2>Ingeniero de Costos</h2></div>
  <div class="main__description bg-white"><h3>Descripción del puesto</h3><p>Funciones:</p><ul><li>Control de costos de obra con S10.</li></ul></div></body></html>`;
const BUMERAN = { content: [
  { id: 111, titulo: 'Jefe de guardia mina', empresa: 'MINERA AURIFERA RETAMAS S.A.', localizacion: 'Pataz, La Libertad', fechaPublicacion: '05-11-2026', detalle: '<p>Ingeniero de minas</p>' },
  { id: 222, titulo: 'Asistente contable', empresa: 'Otra Empresa SAC', localizacion: 'Lima', fechaPublicacion: '05-11-2026', detalle: '' },
] };

const pedidos = [];
const resp = (cuerpo, tipo = 'text/html') => ({ ok: true, status: 200, headers: new Map([['content-type', tipo]]), text: async () => cuerpo, json: async () => JSON.parse(cuerpo) });
async function fetchFalso(url, op = {}) {
  pedidos.push({ url, op });
  const u = String(url);
  if (u.startsWith('https://mastalento.antamina.com/search/')) return resp(SF_ANTAMINA);
  if (u.startsWith('https://mastalento.antamina.com/job/')) return resp(SF_DETALLE);
  if (u.startsWith('https://oportunidades-laborales.com/minsur/search/')) return resp(SF_MINSUR);
  if (u.startsWith('https://oportunidades-laborales.com/minsur/job/')) return resp(SF_DETALLE.replace('Antamina', 'Minsur'));
  if (u === 'https://www.abrilhr.pe/api/v1/empresa/Alpayana/project/') return resp(JSON.stringify(ABRIL), 'application/json');
  if (u === 'https://cerroverde.hiringroom.com/jobs') return resp(HR_NUEVO);
  if (u === 'https://minerapoderosa.hiringroom.com/jobs') return resp(HR_ANTIGUO);
  if (u.startsWith('https://minerapoderosa.hiringroom.com/jobs/get_vacancy/')) return resp(HR_DETALLE);
  if (u.startsWith('https://www.bumeran.com.pe/api/avisos/searchV2')) return resp(JSON.stringify(BUMERAN), 'application/json');
  return { ok: false, status: 404, headers: new Map(), text: async () => '' };
}
const dep = { fetch: fetchFalso, parsear };

// ---------- Utilidades ----------
await prueba('fechas de los portales de mineras', () => {
  assert.equal(fechaIso('9 nov 2026'), '2026-11-09');
  assert.equal(fechaIso('5 set 2026'), '2026-09-05');
  assert.equal(fechaIso('09/11/2026'), '2026-11-09');
  assert.equal(fechaIso('2026-11-04 05:00:00+00:00'), '2026-11-04');
  assert.equal(fechaIso('Tue Nov 24 05:00:00 UTC 2026'), '2026-11-24');
  assert.equal(fechaIso(''), null); assert.equal(fechaIso('pronto'), null);
});
await prueba('mineras elegidas: todas por defecto y permisos solo de las elegidas', () => {
  assert.deepEqual(minerasDe({}), ['antamina', 'minsur', 'alpayana', 'marsa', 'poderosa', 'cerroverde']);
  assert.deepEqual(minerasDe({ mineras: ['minsur', 'inventada'] }), ['minsur']);
  assert.deepEqual(minerasDe({ mineras: [] }), []);
  assert.deepEqual(origenesMineras(['antamina', 'marsa']), ['https://mastalento.antamina.com/*', 'https://www.bumeran.com.pe/*']);
  assert.equal(origenesMineras(minerasDe({})).length, 6);
});

// ---------- Lectores ----------
await prueba('SuccessFactors (Antamina): lista y ficha con microdatos', async () => {
  const r = await MINERAS_INTERES.antamina.buscar(dep);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].id, r[0].titulo, r[0].empresa, r[0].publicado, r[0].url, r[0].portalMinera],
    ['sf-antamina-1338092462', 'Analista Senior de Costos', 'Antamina', '2026-11-09', 'https://mastalento.antamina.com/job/Analista-Senior-de-Costos/1338092462/', 'antamina']);
  const d = await MINERAS_INTERES.antamina.detalle(r[0], dep);
  assert.match(d.descripcion, /OPEX/); assert.match(d.descripcion, /Power BI y SAP/);
  assert.ok(!d.descripcion.includes('<'));
  assert.equal(d.vence, '2026-11-24'); assert.equal(d.ubicacion, 'Peru - Lima');
});
await prueba('SuccessFactors (Minsur): respeta la ruta /minsur', async () => {
  const r = await MINERAS_INTERES.minsur.buscar(dep);
  assert.equal(r[0].url, 'https://oportunidades-laborales.com/minsur/job/PRACTICANTE-DE-CONTROL-DE-PROYECTOS/1338013562/');
  assert.equal(r[0].fuente, 'Minsur');
});
await prueba('Abril HR (Alpayana): API con perfil completo, sin cerradas', async () => {
  pedidos.length = 0;
  const r = await MINERAS_INTERES.alpayana.buscar(dep);
  const p = pedidos[0];
  assert.equal(p.op.method, 'POST'); assert.equal(p.op.credentials, 'omit');
  assert.deepEqual(JSON.parse(p.op.body), { currentPage: 1, size: 50, params: { type: [], mode: [], job: '' } });
  assert.equal(r.length, 1);
  const o = r[0];
  assert.equal(o.id, 'ab-24670'); assert.equal(o.ubicacion, 'UM Yauricocha'); assert.equal(o.publicado, '2026-11-04');
  assert.equal(o.url, 'https://www.abrilhr.pe/api/v1/empresa/Alpayana/puesto/Ingeniero-Junior-de-Obras-Civiles-%7C-UM-Yauricocha-24670');
  assert.ok(o.detalleListo);
  assert.match(o.descripcion, /Funciones:\nSupervisar obras civiles\.\nControlar metrados/);
  assert.match(o.descripcion, /Conocimientos:\nAutoCAD: Intermedio\nS10/);
  assert.match(o.descripcion, /Experiencia:\nExperiencia de 2 años en obras civiles\.\n2 años de experiencia general\n\n/);
  assert.match(o.descripcion, /Idiomas:\nInglés: Intermedio alto/);
  assert.ok(!o.descripcion.includes('eps-1')); assert.ok(!/\n0\n|\n0$/.test(o.descripcion), 'sin ceros sueltos');
});
await prueba('Abril HR: aplana textos, listas y objetos', () => {
  assert.deepEqual(aplanar(['A', { name: 'B', value: 'avanzado' }, { id: 'x' }, null, 0, 3]), ['A', 'B: avanzado']);
  assert.equal(descripcionAbril({}), '');
});
await prueba('HiringRoom nuevo (Cerro Verde): JobPosting en JSON-LD, sin cierre absurdo', async () => {
  const r = await MINERAS_INTERES.cerroverde.buscar(dep, HOY);
  assert.equal(r.length, 1);
  const o = r[0];
  assert.deepEqual([o.id, o.ubicacion, o.publicado, o.vence, o.detalleListo], ['hr-cerroverde-6aee669cbc74ae2bfc60ecf3', 'Arequipa, Arequipa, Peru', '2026-11-06', null, true]);
  assert.ok(o.url.startsWith('https://cerroverde.hiringroom.com/'));
  assert.match(o.descripcion, /presupuestos/);
});
await prueba('HiringRoom antiguo (Poderosa): tarjetas y ficha', async () => {
  const r = await MINERAS_INTERES.poderosa.buscar(dep, HOY);
  assert.deepEqual(r.map((o) => o.titulo), ['Operador de Planta', 'Ingeniero de Costos']);
  assert.equal(r[0].ubicacion, 'Pataz, La Libertad, Peru');
  assert.equal(r[1].publicado, '2026-11-09');
  assert.ok(!r[0].detalleListo);
  const d = await MINERAS_INTERES.poderosa.detalle(r[1], dep);
  assert.match(d.descripcion, /^Funciones:/); assert.match(d.descripcion, /S10/);
});
await prueba('MARSA: solo sus avisos de Bumeran', async () => {
  const r = await MINERAS_INTERES.marsa.buscar(dep);
  assert.deepEqual(r.map((o) => [o.id, o.portalMinera]), [['bm-111', 'marsa']]);
});

// ---------- Búsqueda completa ----------
await prueba('búsqueda completa: mineras con detalle, marca y salud', async () => {
  const sinPortales = {};
  const perfil = { profesion: 'Ingeniero civil', perfiles: ['costos-presupuestos'], claves: 'S10, Power BI, OPEX', cvTexto: 'Ingeniero civil con S10 y Power BI.' };
  const cache = {};
  const r = await buscarEmpleo({ perfil, cacheDetalles: cache, dep, hoy: HOY, portales: sinPortales });
  const ids = r.items.map((o) => o.id).sort();
  assert.deepEqual(ids, ['ab-24670', 'bm-111', 'hr-cerroverde-6aee669cbc74ae2bfc60ecf3', 'hr-poderosa-6aa47a7c', 'hr-poderosa-6af4a9c4',
    'sf-antamina-1338092462', 'sf-antamina-1338092962', 'sf-minsur-1338013562']);
  assert.ok(r.items.every((o) => o.minera && o.portalMinera));
  const costos = r.items.find((o) => o.id === 'sf-antamina-1338092462');
  assert.match(costos.descripcion, /OPEX/); assert.equal(costos.vence, '2026-11-24'); assert.equal(costos.ubicacion, 'Peru');
  assert.ok(cache['hr-poderosa-6aa47a7c']);
  assert.equal(r.salud.length, 6); assert.ok(r.salud.every((s) => s.ok && s.minera));
  assert.equal(r.salud.find((s) => s.id === 'min-marsa').nombre, 'MARSA (vía Bumeran)');
  // Solo las elegidas
  const r2 = await buscarEmpleo({ perfil: { ...perfil, mineras: ['alpayana'] }, dep, hoy: HOY, portales: sinPortales });
  assert.deepEqual(r2.items.map((o) => o.id), ['ab-24670']);
});
await prueba('un portal de minera caído no detiene la búsqueda', async () => {
  const caido = { fetch: async (u, o) => (String(u).includes('abrilhr') ? { ok: false, status: 500 } : fetchFalso(u, o)), parsear };
  const r = await buscarEmpleo({ perfil: { mineras: ['alpayana', 'minsur'] }, dep: caido, hoy: HOY, portales: {} });
  const s = r.salud.find((x) => x.id === 'min-alpayana');
  assert.ok(!s.ok); assert.match(s.error, /HTTP 500/);
  assert.equal(r.items.length, 1);
});

// ---------- Enlaces a otras bolsas ----------
await prueba('enlaces a LinkedIn, Indeed y otras bolsas', () => {
  const l = enlacesExternos('costos y presupuestos');
  assert.deepEqual(l.map((x) => x.n), ['LinkedIn', 'Indeed', 'Google Empleos', 'Bumeran', 'Computrabajo', 'Laborum']);
  assert.match(l[0].u, /keywords=costos%20y%20presupuestos&location=Per%C3%BA&f_TPR=r604800/);
  assert.match(l[1].u, /^https:\/\/pe\.indeed\.com\/jobs\?q=costos%20y%20presupuestos/);
  assert.match(l[3].u, /empleos-busqueda-costos-y-presupuestos\.html/);
  assert.deepEqual(enlacesExternos('  '), []);
});

console.log(`\n${ok} pruebas de mineras OK`);
