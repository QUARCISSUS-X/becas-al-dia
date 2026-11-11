// Pruebas v4: oportunidades verificadas, curador con IA y rutas de empleo. Sin internet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoDe, preparar, marcasLinea, fechasClave, filtrarCurado, fmt, fmtRango, parse } from '../curado/estado.js';
import { validarCurado, extraerDeHtml, elegirCurado, problemasDe } from '../curado/datos.js';
import { promptCurador, leerParche, aplicarParche, tocaCurar, resumenActual } from '../ia/curador.js';
import { generar, buscaEnWeb } from '../ia/ia.js';
import { normalizarSel, busqueda, booleana, bolsas, sinonimos, promptAviso, nombreCv } from '../empleo/rutas.js';

let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log('✔', nombre); };
const HOY = new Date(2026, 10, 10); // 10 nov 2026
const DATOS = JSON.parse(readFileSync(new URL('../../data/curado.json', import.meta.url)));

await prueba('data/curado.json es válido y trae becas, eventos y cursos', () => {
  const v = validarCurado(DATOS);
  assert.ok(v.ok, v.problemas.join('\n'));
  for (const t of ['beca', 'evento', 'curso']) assert.ok(DATOS.becas.some((b) => (b.tipo || 'beca') === t), t);
});

await prueba('fechas: parse y formato como en la página', () => {
  assert.equal(fmt('2026-11-13'), '13 nov 2026'); assert.equal(fmt('2027-01'), 'ene 2027');
  assert.equal(fmtRango({ inicio: '2026-11-12', fin: '2026-11-13' }), '12–13 nov 2026');
  assert.equal(parse('2026-02', true).getDate(), 28);
});

await prueba('estados: abierta, por abrir (estimada), cerrada, continua, evento y curso', () => {
  const b = (x) => ({ tipo: 'beca', ...x });
  let s = estadoDe(b({ modo: 'fija', ventanas: [{ inicio: '2026-10-30', fin: '2026-11-13' }] }), HOY);
  assert.deepEqual([s.k, s.main, s.sub, s.quedan], ['abierta', 'Cierra 13 nov 2026', 'Faltan 3 días', 3]);
  s = estadoDe(b({ modo: 'fija', ventanas: [{ inicio: '2027-01', fin: '2027-03', estimada: true }] }), HOY);
  assert.deepEqual([s.k, s.main], ['porabrir', 'Se espera ene 2027']);
  s = estadoDe(b({ modo: 'fija', ventanas: [{ inicio: '2026-01-05', fin: '2026-02-01' }, { inicio: '2027-09', fin: '2027-10', estimada: true }] }), HOY);
  assert.equal(s.k, 'cerrada'); assert.match(s.sub, /Próxima edición: se espera que abra en sep 2027/);
  assert.equal(estadoDe(b({ modo: 'continua' }), HOY).main, 'Todo el año');
  s = estadoDe({ tipo: 'evento', modo: 'fija', evento: { inicio: '2026-11-12', fin: '2026-11-13' } }, HOY);
  assert.deepEqual([s.k, s.lbl, s.quedan], ['porabrir', 'Próximo', 2]);
  assert.equal(estadoDe({ tipo: 'evento', evento: { inicio: '2026-11-01', fin: '2026-11-02' } }, HOY).lbl, 'Finalizado');
  s = estadoDe({ tipo: 'curso', modo: 'continua', cert: 'gratis', ventanas: [{ inicio: '2026-11-09', fin: '2026-11-26', etiqueta: 'Oferta' }] }, HOY);
  assert.deepEqual([s.k, s.main], ['abierta', 'Inscríbete hasta 26 nov 2026']);
});

await prueba('lista ordenada (abiertas primero), filtros y línea de tiempo', () => {
  const items = preparar(DATOS, HOY);
  const orden = items.map((b) => b.st.orden[0]);
  assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
  const cursos = filtrarCurado(items, { tipo: 'curso' });
  assert.ok(cursos.length && cursos.every((b) => b.tipo === 'curso'));
  const amb = filtrarCurado(items, { esp: 'ambiental' });
  assert.ok(amb.every((b) => b.esp.includes('ambiental') || b.esp.includes('todas')));
  assert.ok(filtrarCurado(items, { q: 'alemania' }).some((b) => b.id === 'epos'));
  const favs = filtrarCurado(items, { favs: true }, new Set(['epos']));
  assert.deepEqual(favs.map((b) => b.id), ['epos']);
  const m = marcasLinea({ tipo: 'beca', corto: 'X', modo: 'fija', ventanas: [{ inicio: '2026-10-30', fin: '2026-11-13' }] }, HOY);
  assert.equal(m[0].cls, 'abierta'); assert.equal(m[0].l, 0); assert.ok(m[0].r > 0 && m[0].r < 3);
  const fc = fechasClave({ tipo: 'beca', fechas: [{ fecha: '2026-11-01', evento: 'a' }, { fecha: '2026-11-20', evento: 'b' }, { fecha: '2027-02', evento: 'c' }] }, HOY);
  assert.deepEqual(fc.map((f) => f.cls), ['pasada', 'siguiente', '']); assert.equal(fc[2].estimada, true);
});

await prueba('extrae los datos de la página y elige los más recientes', () => {
  const html = `<script type="application/json" id="becas-data">${JSON.stringify({ actualizado: '2026-11-09', becas: DATOS.becas })}</script><script type="application/json" id="empleo-data">{"ofertas":[]}</script>`;
  const d = extraerDeHtml(html);
  assert.equal(d.origen, 'claude'); assert.deepEqual(d.empleo, { ofertas: [] });
  assert.equal(elegirCurado({ actualizado: '2026-11-09' }, { actualizado: '2026-11-10' }).actualizado, '2026-11-10');
  assert.equal(elegirCurado({ actualizado: '2026-11-16' }, { actualizado: '2026-11-10' }).actualizado, '2026-11-16');
  assert.ok(problemasDe({ id: 'X Mal', nombre: '', postular: { url: 'javascript:alert(1)' } }).length >= 3);
});

await prueba('prompt del curador: reglas, formato, frecuencia y registros actuales', () => {
  const p = promptCurador({ datos: DATOS, hoy: HOY, frecuencia: '3dias' });
  assert.match(p, /Hoy es 2026-11-10/); assert.match(p, /se repita cada 3 días/); assert.match(p, /Nunca inventes fechas/);
  assert.match(p, /```json/); assert.ok(p.includes('epos | beca | DAAD EPOS'));
  assert.ok(!promptCurador({ datos: DATOS, frecuencia: 'semanal', paraChat: false }).includes('programa esta misma'));
  assert.equal(resumenActual(DATOS).split('\n').length, DATOS.becas.length);
});

await prueba('lee la respuesta de la IA aunque venga con texto alrededor', () => {
  const r = leerParche('Listo, revisé todo.\n```json\n{"actualizado":"2026-11-10","notas":["ok"],"items":[{"id":"epos","verificado":"2026-11-10"}],"retirar":["x"]}\n```\nSaludos');
  assert.deepEqual([r.completo, r.items.length, r.retirar[0], r.notas[0]], [false, 1, 'x', 'ok']);
  assert.equal(leerParche(JSON.stringify({ actualizado: '2026-11-10', becas: [] })).completo, true);
  assert.throws(() => leerParche('No pude buscar en la web.'), /No encontré el bloque JSON/);
});

await prueba('aplica cambios: actualiza, agrega, retira y descarta lo inválido', () => {
  const parche = {
    completo: false, actualizado: '2026-11-10', notas: ['Becas: CERN sin cambios.'],
    items: [
      { id: 'cern', ventanas: [{ inicio: '2026-11-09', fin: '2027-01-25', etiqueta: 'Postulación 2027' }] },
      { id: 'beca-nueva-2027', tipo: 'beca', nombre: 'Beca Nueva 2027', postular: { url: 'https://oficial.example/beca' }, ventanas: [{ inicio: '2026-12-01', fin: '2027-02-15' }], fuentes: [{ t: 'Oficial', u: 'https://oficial.example/beca' }] },
      { id: 'inventada', nombre: 'Sin enlace', postular: { url: '' } },
      { id: 'kaust', ventanas: [{ inicio: 'pronto', fin: 'algún día' }] },
    ],
    retirar: ['ylai', 'no-existe'],
  };
  const { datos, resumen } = aplicarParche(DATOS, parche, { hoy: HOY, proveedor: 'Google Gemini' });
  assert.deepEqual(resumen.nuevos, ['beca-nueva-2027']); assert.deepEqual(resumen.cambiados, ['cern']);
  assert.deepEqual(resumen.retirados, ['ylai']); assert.equal(resumen.descartados.length, 2);
  const cern = datos.becas.find((b) => b.id === 'cern');
  assert.equal(cern.ventanas[0].fin, '2027-01-25'); assert.equal(cern.verificado, '2026-11-10'); assert.ok(cern.requisitos.length); // lo demás se conserva
  assert.equal(datos.becas.find((b) => b.id === 'kaust').ventanas.length, DATOS.becas.find((b) => b.id === 'kaust').ventanas.length); // no se dañó
  assert.ok(!datos.becas.some((b) => b.id === 'ylai'));
  assert.deepEqual([datos.origen, datos.proveedor, datos.actualizado], ['ia', 'Google Gemini', '2026-11-10']);
  assert.match(datos.registro[0].notas[0], /Google Gemini: 1 nuevos, 1 revisados, 1 retirados, 2 descartados/);
  assert.ok(validarCurado(datos).ok);
  assert.equal(DATOS.becas.find((b) => b.id === 'cern').ventanas[0].fin, '2027-01-21'); // el original no se tocó
});

await prueba('frecuencia de la revisión automática', () => {
  const ahora = new Date('2026-11-10T12:00:00Z');
  assert.equal(tocaCurar('manual', null, ahora), false);
  assert.equal(tocaCurar('semanal', null, ahora), true);
  assert.equal(tocaCurar('semanal', '2026-11-05T12:00:00Z', ahora), false);
  assert.equal(tocaCurar('3dias', '2026-11-07T12:00:00Z', ahora), true);
});

await prueba('búsqueda web en cada proveedor (Gemini, Claude con pause_turn, ChatGPT Responses)', async () => {
  const llamadas = []; let pausas = 0;
  const f = async (url, op) => {
    const cuerpo = JSON.parse(op.body); llamadas.push({ url, cuerpo });
    const r = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (url.includes('generativelanguage')) return r({ candidates: [{ content: { parts: [{ text: '```json\n{"items":[]}\n```' }] } }] });
    if (url.includes('anthropic')) return pausas++ === 0 ? r({ content: [{ type: 'text', text: 'Buscando… ' }, { type: 'server_tool_use', id: 's1' }], stop_reason: 'pause_turn' }) : r({ content: [{ type: 'text', text: '{"items":[]}' }], stop_reason: 'end_turn' });
    return r({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: '{"items":[]}' }] }] });
  };
  const p = { mensaje: 'M', buscarWeb: true };
  assert.match(await generar({ proveedor: 'gemini', clave: 'k', modelo: 'gemini-flash-latest' }, p, { fetch: f }), /items/);
  assert.deepEqual(llamadas.at(-1).cuerpo.tools, [{ google_search: {} }]);
  assert.equal(await generar({ proveedor: 'claude', clave: 'k', modelo: 'claude-haiku-5-5' }, p, { fetch: f }), 'Buscando… {"items":[]}');
  assert.equal(llamadas.at(-1).cuerpo.messages.length, 2); assert.equal(llamadas.at(-1).cuerpo.tools[0].type, 'web_search_20250305');
  assert.equal(await generar({ proveedor: 'openai', clave: 'k', modelo: 'gpt-6-luna' }, p, { fetch: f }), '{"items":[]}');
  assert.match(llamadas.at(-1).url, /\/responses$/); assert.deepEqual(llamadas.at(-1).cuerpo.tools, [{ type: 'web_search' }]);
  assert.ok(!buscaEnWeb({ proveedor: 'compatible' }));
  await assert.rejects(generar({ proveedor: 'compatible', base: 'http://localhost:11434/v1', modelo: 'x' }, p, { fetch: f }), /no puede buscar en la web/);
});

await prueba('rutas de empleo: búsqueda, booleana, bolsas y prompt de CV', () => {
  const s = normalizarSel({ ruta: 'civil', esp: 'cierre', niv: 'supervisor' });
  assert.equal(busqueda(s), 'supervisor de cierre de minas');
  assert.match(booleana(s), /^\("ingeniero de cierre de minas" OR .*\) AND \("supervisor"\)$/);
  const b = bolsas(s);
  assert.ok(b.some((x) => x.u === 'https://pe.computrabajo.com/trabajo-de-supervisor-de-cierre-de-minas'));
  assert.ok(b.some((x) => x.n === 'Talento Perú'));
  assert.deepEqual(normalizarSel({ ruta: 'ambiental', esp: 'cierre', niv: 'jefe' }), { ruta: 'ambiental', esp: 'ambiental', niv: 'junior' });
  assert.ok(sinonimos(normalizarSel({ ruta: 'ambiental', esp: 'ambiental', niv: 'pre' }))[0].q.startsWith('practicante '));
  assert.equal(nombreCv(s, 'Supervisor de Cierre – Minera Sol\nFunciones…'), 'CV_Becquer Melgarejo_Supervisor de Cierre – Minera Sol');
  assert.equal(nombreCv(s, '', 'Volcan'), 'CV_Becquer Melgarejo_Volcan');
  const p = promptAviso(s, 'Aviso X');
  assert.match(p, /Puesto objetivo: Cierre de minas, nivel Supervisor/); assert.match(p, /Largo: 2 páginas/); assert.match(p, /«CV_Becquer Melgarejo_Aviso X»/); assert.match(p, /No inventes/); assert.match(p, /"""\nAviso X\n"""/);
});

console.log(`\n${ok} pruebas de oportunidades OK`);
