// Extracción de fechas límite en español e inglés, sin IA.
// Devuelve fechas ISO (YYYY-MM-DD) priorizando las que están cerca de
// palabras como "fecha límite", "cierre", "deadline", "apply by".

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, apr: 4, aug: 8, sept: 9, dec: 12,
};

const MES_RE = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

const CLAVES_CIERRE = [
  'fecha l[ií]mite', 'cierre', 'cierra', 'vence', 'plazo', 'hasta el', 'postula hasta',
  'inscripciones hasta', 'postulaciones hasta', '[uú]ltimo d[ií]a',
  'deadline', 'closing date', 'closes', 'close on', 'apply by', 'applications close',
  'due date', 'submission', 'until',
];
const CLAVES_RE = new RegExp(`(${CLAVES_CIERRE.join('|')})`, 'gi');

// Contextos que NO son el cierre de postulación aunque digan "deadline"
// (p. ej. Chevening: "Offer deadline – 8 July 2027" es para entregar la carta de la universidad).
const CLAVES_NO_CIERRE = [
  'offer deadline', 'university offer', 'unconditional', 'carta de aceptaci[oó]n',
  'results?', 'resultados?', 'interviews?', 'entrevistas?', 'shortlist',
  'studies begin', 'inicio de (clases|estudios)', 'start of (studies|classes)',
  'publicad[oa] el', 'published on', 'posted on', 'actualizad[oa] el', 'updated on',
];
const NO_CIERRE_RE = new RegExp(`(${CLAVES_NO_CIERRE.join('|')})`, 'gi');

// ¿La última palabra clave antes de la fecha es de cierre (y no de resultados, ofertas, etc.)?
function esContextoCierre(antes) {
  const ult = (re) => { let p = -1; for (const m of antes.matchAll(re)) p = m.index + m[0].length; return p; };
  const pos = ult(CLAVES_RE);
  return pos >= 0 && pos > ult(NO_CIERRE_RE);
}

function iso(y, m, d) {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 31 de febrero, etc.
  return dt.toISOString().slice(0, 10);
}

function anioCompleto(y) {
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

// Busca todas las fechas en un texto y devuelve [{fecha, pos, cerca}]
export function encontrarFechas(texto) {
  if (!texto) return [];
  const t = texto.replace(/\s+/g, ' ');
  const res = [];
  const patrones = [
    // 15 de marzo de 2027 | 15 marzo 2027 | 15 March 2027 | 15th of March, 2027
    { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|º|°)?\\s*(?:de\\s+|of\\s+)?(${MES_RE})\\.?,?\\s*(?:de(?:l)?\\s+)?(\\d{4})\\b`, 'gi'),
      f: (m) => iso(Number(m[3]), MESES[m[2].toLowerCase()], Number(m[1])) },
    // March 15, 2027 | marzo 15 de 2027
    { re: new RegExp(`\\b(${MES_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(?:de\\s+)?(\\d{4})\\b`, 'gi'),
      f: (m) => iso(Number(m[3]), MESES[m[1].toLowerCase()], Number(m[2])) },
    // 2027-03-15
    { re: /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g,
      f: (m) => iso(Number(m[1]), Number(m[2]), Number(m[3])) },
    // 15/03/2027 o 15.03.27 (formato peruano: día/mes/año)
    { re: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g,
      f: (m) => iso(anioCompleto(m[3]), Number(m[2]), Number(m[1])) },
  ];
  for (const { re, f } of patrones) {
    for (const m of t.matchAll(re)) {
      const fecha = f(m);
      if (!fecha) continue;
      const antes = t.slice(Math.max(0, m.index - 120), m.index);
      res.push({ fecha, pos: m.index, cerca: esContextoCierre(antes) });
    }
  }
  return res;
}

// Fechas solo con mes y año ("Applications close: October 2026"), únicamente junto
// a una palabra de cierre. Se toma el último día del mes y se marcan como aproximadas.
export function encontrarMesesCierre(texto) {
  if (!texto) return [];
  const t = texto.replace(/\s+/g, ' ');
  const re = new RegExp(`\\b(${MES_RE})\\.?,?\\s+(?:de(?:l)?\\s+)?(20\\d{2})\\b`, 'gi');
  const res = [];
  for (const m of t.matchAll(re)) {
    // Evitar duplicar fechas completas ("15 de marzo de 2027", "March 15, 2027")
    const previo = t.slice(Math.max(0, m.index - 8), m.index);
    if (/\d\s*(de|of)?\s*$/i.test(previo)) continue;
    const mes = MESES[m[1].toLowerCase()];
    const y = Number(m[2]);
    const ultimo = new Date(Date.UTC(y, mes, 0)).getUTCDate();
    const antes = t.slice(Math.max(0, m.index - 35), m.index);
    // En líneas de tiempo el rótulo suele ir después: "October 2026 – Applications close"
    const despues = t.slice(m.index + m[0].length, m.index + m[0].length + 30);
    const rotuloDespues = /^\W{0,3}(applications? (close|deadline)|deadline|cierre|cierra|fecha l[ií]mite)/i.test(despues);
    const rotuloOtro = new RegExp(`^\\W{0,3}(${CLAVES_NO_CIERRE.join('|')}|applications? open|abre|apertura)`, 'i').test(despues);
    if (!rotuloOtro && (esContextoCierre(antes) || rotuloDespues)) res.push(iso(y, mes, ultimo));
  }
  return res;
}

// Elige la fecha límite más probable:
// 1) la fecha futura más próxima que esté cerca de una palabra de cierre;
// 2) si no hay, null (preferimos no inventar una fecha).
// También devuelve la última fecha de cierre pasada (para marcar vencidas).
export function fechaLimite(texto, hoy = new Date()) {
  const hoyIso = hoy.toISOString().slice(0, 10);
  const todas = encontrarFechas(texto);
  const cierre = todas.filter((x) => x.cerca).map((x) => x.fecha);
  const futuras = [...new Set(cierre.filter((f) => f >= hoyIso))].sort();
  const pasadas = [...new Set(cierre.filter((f) => f < hoyIso))].sort();
  // Descarta fechas absurdamente lejanas (> 3 años): suelen ser ruido
  const limite = new Date(hoy); limite.setUTCFullYear(limite.getUTCFullYear() + 3);
  const lim = limite.toISOString().slice(0, 10);
  const proxima = futuras.find((f) => f <= lim) || null;
  if (proxima || pasadas.length) return { fecha: proxima, ultimaPasada: pasadas.at(-1) || null, aprox: false };
  // Sin fecha exacta: probar "mes año" junto a palabras de cierre
  const meses = [...new Set(encontrarMesesCierre(texto))].sort();
  const mFut = meses.filter((f) => f >= hoyIso && f <= lim);
  const mPas = meses.filter((f) => f < hoyIso);
  return { fecha: mFut[0] || null, ultimaPasada: mPas.at(-1) || null, aprox: meses.length > 0 };
}

export function diasHasta(fechaIso, hoy = new Date()) {
  if (!fechaIso) return null;
  const a = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const [y, m, d] = fechaIso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}
