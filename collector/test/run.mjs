// Pruebas sin internet: simula las webs con HTML/RSS de muestra.
import assert from 'node:assert/strict';
import { encontrarFechas, fechaLimite, diasHasta } from '../lib/fechas.mjs';
import { clasificar } from '../lib/clasificar.mjs';
import { recolectar, usarObtener, cicloPasado } from '../collect.mjs';

const HOY = new Date('2026-11-08T12:00:00Z');
let ok = 0;
const prueba = (nombre, fn) => { fn(); ok++; console.log('✔', nombre); };

// --- Fechas ---
prueba('fecha en español con "de"', () => {
  assert.equal(fechaLimite('La fecha límite es el 15 de marzo de 2027.', HOY).fecha, '2027-03-15');
});
prueba('setiembre (forma peruana)', () => {
  assert.equal(fechaLimite('Postulaciones hasta el 3 de setiembre de 2027', HOY).fecha, '2027-09-03');
});
prueba('inglés "Month D, YYYY"', () => {
  assert.equal(fechaLimite('Application deadline: January 31, 2027', HOY).fecha, '2027-01-31');
});
prueba('inglés "D Month YYYY"', () => {
  assert.equal(fechaLimite('Applications close 7 October 2027 at 12:00 UTC', HOY).fecha, '2027-10-07');
});
prueba('dd/mm/aaaa peruano', () => {
  assert.equal(fechaLimite('Cierre de convocatoria: 05/02/2027', HOY).fecha, '2027-02-05');
});
prueba('ignora fechas sin palabra de cierre (no inventa)', () => {
  assert.equal(fechaLimite('Publicado el 1 de diciembre de 2026', HOY).fecha, null);
});
prueba('elige la próxima futura y reporta la pasada', () => {
  const r = fechaLimite('Deadline 2025: 7 October 2025. Next deadline: 6 October 2027.', HOY);
  assert.equal(r.fecha, '2027-10-06');
  assert.equal(r.ultimaPasada, '2025-10-07');
});
prueba('rechaza fechas imposibles', () => {
  assert.equal(encontrarFechas('fecha límite 31/02/2027').length, 0);
});
prueba('ignora "offer deadline" y resultados (caso Chevening)', () => {
  const t = 'Mid-June 2027 Results: interview results are announced. 8 July 2027 Offer deadline The deadline to receive an unconditional UK university offer is 17:00 BST on 8 July 2027.';
  assert.equal(fechaLimite(t, HOY).fecha, null);
});
prueba('línea de tiempo "October 2026 Applications close" → cerrada aprox.', () => {
  const r = fechaLimite('August 2026 Applications open. October 2026 Applications close. Mid-June 2027 Results.', HOY);
  assert.deepEqual([r.fecha, r.ultimaPasada, r.aprox], [null, '2026-10-31', true]);
});
prueba('"Deadline: March 2027" → fin de mes, aproximada', () => {
  const r = fechaLimite('Deadline: March 2027', HOY);
  assert.deepEqual([r.fecha, r.aprox], ['2027-03-31', true]);
});
prueba('una fecha exacta gana a una aproximada', () => {
  const r = fechaLimite('Applications close in March 2027. Deadline: 15 March 2027', HOY);
  assert.deepEqual([r.fecha, r.aprox], ['2027-03-15', false]);
});
prueba('días restantes', () => {
  assert.equal(diasHasta('2026-11-18', HOY), 10);
});

// --- Clasificación ---
prueba('clasifica nivel, área y cobertura', () => {
  const c = clasificar('Fully funded Master scholarship in Mining Engineering', 'Open to students from developing countries');
  assert.deepEqual(c.niveles, ['maestria']);
  assert.ok(c.areas.includes('mineria') && c.areas.includes('ingenieria'));
  assert.equal(c.cobertura, 'completa');
  assert.equal(c.paraPeru, true);
});

prueba('detecta ciclos pasados en el título', () => {
  assert.equal(cicloPasado('Guía para postularse a la convocatoria 2025/26', 2026), true);
  assert.equal(cicloPasado('Guía convocatoria 2024/2025', 2026), true);
  assert.equal(cicloPasado('Guía para postularse a la convocatoria 2026/27', 2026), false);
  assert.equal(cicloPasado('Becas STEM 2026', 2026), false);
  assert.equal(cicloPasado('Informe anual 2023', 2026), true);
  assert.equal(cicloPasado('Beca sin año', 2026), false);
});

// --- Recolector completo con webs simuladas ---
const WEBS = {
  'https://feed.test/rss': `<?xml version="1.0"?><rss><channel>
    <item><title>DAAD EPOS Scholarships for Environmental Engineering</title><link>https://feed.test/epos</link>
      <pubDate>Mon, 02 Nov 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[<p>Fully funded master scholarship. Deadline: 31 January 2027.</p>]]></description></item>
    <item><title>Global Leaders Fellowship 2027</title><link>https://feed.test/global</link>
      <pubDate>Tue, 03 Nov 2026 10:00:00 +0000</pubDate><description>Funded fellowship for young professionals.</description></item>
    <item><title>Old opportunity</title><link>https://feed.test/old</link>
      <pubDate>Mon, 01 Jun 2026 10:00:00 +0000</pubDate><description>Deadline 1 July 2026</description></item>
  </channel></rss>`,
  'https://feed.test/global': '<html><body><main><h1>Global Leaders</h1><p>Applications close on 15 December 2026.</p></main></body></html>',
  'https://gob.test/noticias': `<html><body><nav><a href="/menu">Becas menú de navegación principal</a></nav>
    <ul><li><a href="/n/1">Pronabec lanza Beca Generación del Bicentenario 2027</a> <span>Inscripciones hasta el 20 de enero de 2027</span></li>
        <li><a href="/n/2">Ministro inaugura colegio en Puno</a></li>
        <li><a href="/n/3">Convocatoria Beca Perú para maestría en ingeniería civil</a></li></ul></body></html>`,
  'https://gob.test/n/3': '<html><body><main>Bases. Fecha límite: 10/12/2026</main></body></html>',
  'https://alt.test/ok': '<html><body><main>Programa Alterno. Deadline: 30 April 2027</main></body></html>',
  'https://prog.test/timeline': '<html><body><main><h2>Timeline</h2><p>Applications open 4 August 2026. Applications close 6 October 2026 at 12:00 UTC.</p></main></body></html>',
};
usarObtener(async (url) => { if (!(url in WEBS)) throw new Error('HTTP 404'); return WEBS[url]; });

const fuentes = [
  { id: 'rss', nombre: 'Feed prueba', tipo: 'rss', url: 'https://feed.test/rss', pais: 'Internacional' },
  { id: 'gob', nombre: 'Gob prueba', tipo: 'html', url: 'https://gob.test/noticias', filtro: 'beca|convocatoria', pais: 'Perú' },
  { id: 'prog', nombre: 'Programa prueba', tipo: 'programa', url: 'https://prog.test/timeline', titulo: 'Programa X', nivel: 'maestria' },
  { id: 'caida', nombre: 'Fuente caída', tipo: 'html', url: 'https://caida.test/' },
  { id: 'alt', nombre: 'Con alternativa', tipo: 'html', url: 'https://bloqueada.test/', pais: 'Alemania',
    alternativas: [{ tipo: 'programa', url: 'https://alt.test/ok', titulo: 'Programa Alterno', nivel: 'maestria' }] },
];
process.env.HOY = HOY.toISOString();

const anterior = { items: [
  { id: 'progviejo00', titulo: 'Programa X (URL antigua)', url: 'https://prog.test/viejo', fuente: 'prog', estado: 'abierta', fechaLimite: '2027-07-08', vistoUltimo: '2026-11-07', primeraVez: '2026-11-01' },
  { id: 'viejo000000', titulo: 'Beca que ya no aparece', url: 'https://x.test/a', estado: 'abierta', fechaLimite: '2027-05-01', vistoUltimo: '2026-11-01', primeraVez: '2026-10-01' },
  { id: 'vencida0000', titulo: 'Beca vencida hace mucho', url: 'https://x.test/b', estado: 'abierta', fechaLimite: '2026-09-01', vistoUltimo: '2026-11-05', primeraVez: '2026-08-01' },
], salud: [] };

const datos = await recolectar({ fuentes, anterior });
const por = (t) => datos.items.find((i) => i.titulo.includes(t));

prueba('RSS: fecha desde la descripción', () => assert.equal(por('EPOS').fechaLimite, '2027-01-31'));
prueba('RSS: abre el detalle si falta fecha', () => assert.equal(por('Global Leaders').fechaLimite, '2026-12-15'));
prueba('RSS: descarta publicaciones de hace más de 60 días', () => assert.equal(por('Old opportunity'), undefined));
prueba('HTML: fecha desde el bloque del listado', () => assert.equal(por('Bicentenario').fechaLimite, '2027-01-20'));
prueba('HTML: ignora noticias que no son becas y la navegación', () => {
  assert.equal(por('colegio'), undefined); assert.equal(por('menú'), undefined);
});
prueba('HTML: fecha dd/mm desde el detalle', () => assert.equal(por('ingeniería civil').fechaLimite, '2026-12-10'));
prueba('Programa: convocatoria cerrada sin fecha nueva', () => {
  const p = por('Programa X'); assert.equal(p.estado, 'cerrada'); assert.equal(p.ultimaPasada, '2026-10-06');
});
prueba('Programa: no duplica la ficha si cambió la URL', () => assert.equal(por('URL antigua'), undefined));
prueba('Conserva becas no vistas recientemente', () => assert.ok(por('ya no aparece')));
prueba('Purga vencidas de hace más de 14 días', () => assert.equal(por('vencida hace mucho'), undefined));
prueba('Reporta la salud de cada fuente', () => {
  const c = datos.salud.find((s) => s.id === 'caida'); assert.equal(c.ok, false); assert.match(c.error, /404/);
  assert.equal(datos.salud.filter((s) => s.ok).length, 4);
});
prueba('Usa la alternativa si la URL principal falla', () => {
  const a = datos.salud.find((s) => s.id === 'alt');
  assert.equal(a.ok, true); assert.equal(a.via, 'https://alt.test/ok');
  assert.equal(por('Programa Alterno').fechaLimite, '2027-04-30');
  assert.equal(por('Programa Alterno').pais, 'Alemania');
});

// Segunda corrida: detecta cambio de fecha
WEBS['https://feed.test/rss'] = WEBS['https://feed.test/rss'].replace('31 January 2027', '28 February 2027');
const datos2 = await recolectar({ fuentes, anterior: datos });
prueba('Detecta cambio de fecha entre corridas', () => {
  const e = datos2.items.find((i) => i.titulo.includes('EPOS'));
  assert.deepEqual([e.cambioFecha.antes, e.cambioFecha.ahora], ['2027-01-31', '2027-02-28']);
  assert.equal(e.primeraVez, '2026-11-08');
});

console.log(`\n${ok} pruebas OK`);
