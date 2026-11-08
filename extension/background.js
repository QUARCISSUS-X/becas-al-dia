// Becas al Día — servicio en segundo plano.
// Descarga el JSON que publica el recolector de GitHub (sin IA, sin tokens),
// marca novedades en el ícono y avisa cuando se acerca el cierre de una favorita.

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

async function actualizar() {
  const { config = {} } = await leer('config');
  const url = config.urlDatos || URL_DATOS_DEFECTO;
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const datos = await r.json();
    if (!Array.isArray(datos.items)) throw new Error('Formato inesperado');
    await guardar({ datos, ultimaDescarga: new Date().toISOString(), errorDescarga: null });
    await refrescarInsignia();
    await avisarCierres(datos);
    return { ok: true, total: datos.total };
  } catch (e) {
    await guardar({ errorDescarga: String(e.message || e), ultimaDescarga: new Date().toISOString() });
    return { ok: false, error: String(e.message || e) };
  }
}

async function refrescarInsignia() {
  const { datos, vistos = [] } = await leer(['datos', 'vistos']);
  if (!datos) return;
  const set = new Set(vistos);
  const nuevas = datos.items.filter((i) => i.estado !== 'vencida' && !set.has(i.id)).length;
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
  const id = clave.split(':')[0];
  const { datos } = await leer('datos');
  const it = datos?.items.find((i) => i.id === id);
  if (it) chrome.tabs.create({ url: it.url });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.alarms.create('actualizar', { periodInMinutes: CADA_MINUTOS, delayInMinutes: 0.1 });
  actualizar();
});
chrome.runtime.onStartup.addListener(() => actualizar());
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'actualizar') actualizar(); });

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo === 'actualizar') { actualizar().then(responder); return true; }
  if (msg?.tipo === 'insignia') { refrescarInsignia().then(() => responder({ ok: true })); return true; }
});
