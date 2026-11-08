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
const CLAVES_RE = new RegExp(`(${CLAVES_CIERRE.join('|')})`, 'i');

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
      res.push({ fecha, pos: m.index, cerca: CLAVES_RE.test(antes) });
    }
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
  return { fecha: proxima, ultimaPasada: pasadas.at(-1) || null };
}

export function diasHasta(fechaIso, hoy = new Date()) {
  if (!fechaIso) return null;
  const a = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const [y, m, d] = fechaIso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}
