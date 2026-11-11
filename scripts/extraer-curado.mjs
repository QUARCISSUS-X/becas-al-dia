// Copia los datos verificados de la página «Becas al Día» (artefacto de Claude) a data/curado.json,
// que es lo que descarga la extensión. Lo usa la revisión semanal; también se puede correr a mano:
//   node scripts/extraer-curado.mjs ruta/al/index.html
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extraerDeHtml, validarCurado } from '../extension/curado/datos.js';

const html = process.argv[2];
if (!html) { console.error('Uso: node scripts/extraer-curado.mjs <index.html del artefacto>'); process.exit(2); }
const datos = extraerDeHtml(readFileSync(html, 'utf8'));
datos.artefacto = 'https://claude.ai/artifact/HB38KDXWMMiGxL6AYfEGx6';
const v = validarCurado(datos);
if (!v.ok) { console.error('Datos con problemas:\n- ' + v.problemas.join('\n- ')); process.exit(1); }
const destino = resolve(import.meta.dirname, '..', 'data', 'curado.json');
writeFileSync(destino, JSON.stringify(datos, null, 1) + '\n');
const n = (t) => datos.becas.filter((b) => (b.tipo || 'beca') === t).length;
console.log(`✔ data/curado.json · ${datos.actualizado} · ${n('beca')} becas, ${n('evento')} eventos, ${n('curso')} cursos · ${datos.empleo?.ofertas?.length || 0} ofertas`);
