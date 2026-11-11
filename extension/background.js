// Becas al Día — servicio en segundo plano.
// Descarga el JSON que publica el recolector de GitHub (sin IA, sin tokens) y los datos que Claude
// verifica cada lunes (data/curado.json), marca novedades en el ícono, avisa cuando se acerca el
// cierre de una favorita y, si lo activaste, hace la revisión extra con tu propia IA.
import { URL_CURADO_DEFECTO, validarCurado, elegirCurado } from './curado/datos.js';
import { estadoDe, hoyLocal } from './curado/estado.js';
import { generar, buscaEnWeb, configurada, PROVEEDORES, origenDe } from './ia/ia.js';
import { promptCurador, leerParche, aplicarParche, tocaCurar } from './ia/curador.js';

export const URL_DATOS_DEFECTO = 'https://raw.githubusercontent.com/QUARCISSUS-X/becas-al-dia/main/data/becas.json';
const CADA_MINUTOS = 360; // revisa cada 6 h (el recolector corre 1 vez al día)
const AVISOS_DIAS = [7, 3, 1, 0];

const leer = (claves) => chrome.storage.local.get(claves);
const guardar = (obj) => chrome.storage.local.set(obj);

function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + 'T00:00:00') - hoy) / 86400000);
}

// data/curado.json vive junto a data/becas.json en el mismo repositorio
export function urlCuradoDe(config = {}) {
  if (config.urlCurado) return config.urlCurado;
  if (config.urlDatos && /\/becas\.json(\?|$)/.test(config.urlDatos)) return config.urlDatos.replace(/\/becas\.json/, '/curado.json');
  return URL_CURADO_DEFECTO;
}

async function descargarCurado(config) {
  const url = urlCuradoDe(config);
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const datos = await r.json();
    const v = validarCurado(datos);
    if (!v.ok) throw new Error('datos con problemas: ' + v.problemas[0]);
    const { vistosCurado } = await leer('vistosCurado');
    // En la primera descarga todo cuenta como visto (si no, el ícono mostraría 45 novedades)
    await guardar({ curadoClaude: datos, errorCurado: null, ...(vistosCurado ? {} : { vistosCurado: datos.becas.map((b) => b.id) }) });
  } catch (e) {
    await guardar({ errorCurado: String(e.message || e) });
  }
}

async function actualizar() {
  const { config = {} } = await leer('config');
  await descargarCurado(config);
  const url = config.urlDatos || URL_DATOS_DEFECTO;
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const datos = await r.json();
    if (!Array.isArray(datos.items)) throw new Error('Formato inesperado');
    await guardar({ datos, ultimaDescarga: new Date().toISOString(), errorDescarga: null });
    await refrescarInsignia();
    await avisarCierres(datos);
    await avisarCierresCurado();
    curar(false).catch(() => {});
    return { ok: true, total: datos.total };
  } catch (e) {
    await guardar({ errorDescarga: String(e.message || e), ultimaDescarga: new Date().toISOString() });
    await refrescarInsignia();
    await avisarCierresCurado();
    return { ok: false, error: String(e.message || e) };
  }
}

async function curadoActual() {
  const { curadoClaude, curadoPropio } = await leer(['curadoClaude', 'curadoPropio']);
  return elegirCurado(curadoClaude, curadoPropio);
}

// Favoritas de «Oportunidades» (becas, eventos y cursos verificados): aviso a 7, 3, 1 y 0 días del cierre
async function avisarCierresCurado() {
  const datos = await curadoActual();
  if (!datos) return;
  const { favoritasCurado = [], avisados = {} } = await leer(['favoritasCurado', 'avisados']);
  const favs = new Set(favoritasCurado);
  const hoy = hoyLocal();
  for (const b of datos.becas) {
    if (!favs.has(b.id)) continue;
    const st = estadoDe(b, hoy);
    if (st.quedan == null || st.quedan < 0) continue;
    const umbral = [...AVISOS_DIAS].sort((a, c) => a - c).find((n) => st.quedan <= n);
    if (umbral == null) continue;
    const clave = `c|${b.id}|${st.cierra}:${umbral}`;
    if (avisados[clave]) continue;
    avisados[clave] = true;
    const d = st.quedan;
    chrome.notifications.create(clave, {
      type: 'basic', iconUrl: 'icons/128.png',
      title: d === 0 ? 'Cierra HOY' : `Cierra en ${d} día${d === 1 ? '' : 's'}`,
      message: b.nombre, priority: 2,
    });
  }
  await guardar({ avisados });
}

// ---------- Revisión con tu propia IA ----------
let curando = null;
async function curar(forzar) {
  if (curando) return curando;
  curando = (async () => {
    const { ia = {}, curadoConfig = {}, curadoUltimo } = await leer(['ia', 'curadoConfig', 'curadoUltimo']);
    if (!forzar && !tocaCurar(curadoConfig.frecuencia, curadoUltimo?.intento)) return { ok: true, omitido: true };
    if (!configurada(ia) || !buscaEnWeb(ia)) return { ok: false, error: 'Conecta Gemini, Claude o ChatGPT en ⚙ Ajustes para que tu IA pueda buscar en la web' };
    const origen = origenDe(ia);
    if (origen && chrome.permissions && !(await chrome.permissions.contains({ origins: [origen] }))) return { ok: false, error: 'Falta el permiso para conectar con el proveedor: pulsa «Probar y listar modelos» en ⚙ Ajustes' };
    const base = await curadoActual();
    if (!base) return { ok: false, error: 'Aún no hay datos base: pulsa ↻' };
    const intento = new Date().toISOString();
    await guardar({ curadoUltimo: { ...(curadoUltimo || {}), intento, enCurso: true } });
    // Mantiene vivo el servicio en segundo plano mientras la IA busca (puede tardar minutos)
    const vivo = setInterval(() => chrome.runtime.getPlatformInfo?.(), 20000);
    try {
      const txt = await generar(ia, { mensaje: promptCurador({ datos: base, paraChat: false }), buscarWeb: true, maxTokens: 16000 }, { fetch: (u, o) => fetch(u, o) });
      const { datos, resumen } = aplicarParche(base, leerParche(txt), { proveedor: PROVEEDORES[ia.proveedor].nombre });
      await guardar({ curadoPropio: datos, curadoUltimo: { intento, fecha: intento, ok: true, resumen, proveedor: PROVEEDORES[ia.proveedor].nombre } });
      const n = resumen.nuevos.length; const c = resumen.cambiados.length;
      chrome.notifications.create(`curado|${intento}`, { type: 'basic', iconUrl: 'icons/128.png', title: 'Tu IA revisó las oportunidades',
        message: `${n} nuevas · ${c} revisadas${resumen.retirados.length ? ` · ${resumen.retirados.length} retiradas` : ''}`, priority: 0 });
      await refrescarInsignia(); await avisarCierresCurado();
      return { ok: true, resumen };
    } catch (e) {
      await guardar({ curadoUltimo: { ...(curadoUltimo || {}), intento, ok: false, error: String(e.message || e) } });
      return { ok: false, error: String(e.message || e) };
    } finally { clearInterval(vivo); }
  })();
  try { return await curando; } finally { curando = null; }
}

async function refrescarInsignia() {
  const { datos, vistos = [], vistosCurado } = await leer(['datos', 'vistos', 'vistosCurado']);
  const curado = await curadoActual();
  const set = new Set(vistos);
  const setC = new Set(vistosCurado || []);
  const nuevas = (datos?.items || []).filter((i) => i.estado !== 'vencida' && !set.has(i.id)).length
    + (vistosCurado ? (curado?.becas || []).filter((b) => !setC.has(b.id)).length : 0);
  await chrome.action.setBadgeBackgroundColor({ color: '#0f766e' });
  await chrome.action.setBadgeText({ text: nuevas ? String(Math.min(nuevas, 99)) : '' });
}

async function avisarCierres(datos) {
  const { favoritas = [], avisados = {} } = await leer(['favoritas', 'avisados']);
  const favs = new Set(favoritas);
  for (const it of datos.items) {
    if (!favs.has(it.id) || !it.fechaLimite) continue;
    const d = diasHasta(it.fechaLimite);
    if (d == null || d < 0) continue;
    // Umbral más pequeño que aún cubre los días que faltan (7 → 3 → 1 → 0)
    const umbral = [...AVISOS_DIAS].sort((a, b) => a - b).find((n) => d <= n);
    if (umbral == null) continue;
    const clave = `${it.id}:${umbral}`;
    if (avisados[clave]) continue;
    avisados[clave] = true;
    chrome.notifications.create(clave, {
      type: 'basic',
      iconUrl: 'icons/128.png',
      title: d === 0 ? 'Cierra HOY' : `Cierra en ${d} día${d === 1 ? '' : 's'}`,
      message: it.titulo,
      priority: 2,
    });
  }
  await guardar({ avisados });
}

chrome.notifications.onClicked.addListener(async (clave) => {
  if (clave.startsWith('c|')) {
    const id = clave.split('|')[1];
    const b = (await curadoActual())?.becas.find((x) => x.id === id);
    if (b?.postular?.url) chrome.tabs.create({ url: b.postular.url });
    return;
  }
  if (clave.startsWith('curado|')) return;
  const id = clave.split(':')[0];
  const { datos } = await leer('datos');
  const it = datos?.items.find((i) => i.id === id);
  if (it) chrome.tabs.create({ url: it.url });
});

// Bumeran rechaza llamadas a su API que no vengan de su propia web. Para las consultas que
// hace esta extensión (y solo esas), se envían Origin/Referer de bumeran.com.pe.
async function reglasRed() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: [{
        id: 1, priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [
          { header: 'origin', operation: 'set', value: 'https://www.bumeran.com.pe' },
          { header: 'referer', operation: 'set', value: 'https://www.bumeran.com.pe/empleos.html' },
        ] },
        condition: { urlFilter: '||bumeran.com.pe/api/', initiatorDomains: [new URL(chrome.runtime.getURL('')).hostname], resourceTypes: ['xmlhttprequest', 'other'] },
      }],
    });
  } catch (e) { console.warn('No se pudo registrar la regla de Bumeran', e); }
}
reglasRed();

// Chrome/Edge abren el panel lateral; Firefox usa su barra lateral (sidebar_action)
if (chrome.sidePanel?.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
else if (globalThis.browser?.sidebarAction) chrome.action.onClicked.addListener(() => { browser.sidebarAction.toggle(); });

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('actualizar', { periodInMinutes: CADA_MINUTOS, delayInMinutes: 0.1 });
  actualizar();
});
chrome.runtime.onStartup.addListener(() => { reglasRed(); actualizar(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'actualizar') actualizar(); });

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo === 'actualizar') { actualizar().then(responder); return true; }
  if (msg?.tipo === 'insignia') { refrescarInsignia().then(() => responder({ ok: true })); return true; }
  if (msg?.tipo === 'curar') { curar(true).then(responder); return true; }
  if (msg?.tipo === 'favoritas') { avisarCierresCurado().then(() => responder({ ok: true })); return true; }
});
