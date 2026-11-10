// Empaqueta la extensión para Chrome/Edge (.zip) y Firefox (.xpi) en dist/.
// Uso: node scripts/empaquetar.mjs     (requiere el comando zip)
// El manifiesto de extension/ es el de Chrome; aquí se deriva el de Firefox.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const origen = join(raiz, 'extension');
const dist = join(raiz, 'dist');
const manifiesto = JSON.parse(readFileSync(join(origen, 'manifest.json'), 'utf8'));
const v = manifiesto.version;
const NO_INCLUIR = new Set(['test', 'package.json']);

export const GECKO_ID = 'becas-al-dia@quarcissus-x.github.io';

export function manifiestoFirefox(m) {
  const f = structuredClone(m);
  delete f.side_panel;
  f.permissions = f.permissions.filter((p) => p !== 'sidePanel');
  f.background = { scripts: [m.background.service_worker], type: 'module' };
  f.sidebar_action = { default_title: m.name, default_panel: m.side_panel.default_path, default_icon: m.icons, open_at_install: true };
  f.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: '128.0',
      // La extensión no recopila datos. Si conectas una IA, tu CV va al proveedor que tú elijas y solo al pulsar ✨.
      data_collection_permissions: { required: ['none'] },
    },
  };
  return f;
}

function empaquetar(nombre, ext, manifiestoFinal) {
  const dir = join(dist, nombre);
  rmSync(dir, { recursive: true, force: true });
  cpSync(origen, dir, { recursive: true, filter: (src) => !NO_INCLUIR.has(src.slice(origen.length + 1).split('/')[0]) });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifiestoFinal, null, 2) + '\n');
  const archivo = join(dist, `becas-al-dia-${nombre}-${v}.${ext}`);
  rmSync(archivo, { force: true });
  execFileSync('zip', ['-qr', '-X', archivo, '.'], { cwd: dir });
  console.log('✔', archivo.slice(raiz.length + 1));
  return dir;
}

if (process.argv[1] === import.meta.filename) {
  mkdirSync(dist, { recursive: true });
  empaquetar('chrome', 'zip', manifiesto);
  empaquetar('firefox', 'xpi', manifiestoFirefox(manifiesto));
}
