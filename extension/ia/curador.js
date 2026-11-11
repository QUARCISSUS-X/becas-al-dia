// «Curador»: que cualquier IA haga la misma revisión que Claude hace cada lunes en la página «Becas al Día».
// 1) promptCurador(): instrucciones + datos actuales resumidos. Sirve para pegar en cualquier chat o para la API.
// 2) leerParche(): toma la respuesta (un JSON con solo los cambios) aunque venga rodeada de texto.
// 3) aplicarParche(): aplica los cambios sobre los datos actuales y valida todo.
import { problemasDe, validarCurado } from '../curado/datos.js';

export const FRECUENCIAS = {
  manual: { dias: 0, txt: 'solo cuando yo lo pida' },
  diaria: { dias: 1, txt: 'cada día' },
  '3dias': { dias: 3, txt: 'cada 3 días' },
  semanal: { dias: 7, txt: 'cada semana' },
  quincenal: { dias: 14, txt: 'cada 2 semanas' },
};

const hoyIso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const ventanaTxt = (w) => `${w.inicio || '?'}→${w.fin}${w.estimada ? ' (estimada)' : ''}${w.etiqueta ? ` «${w.etiqueta}»` : ''}`;

/** Una línea por registro: lo justo para que la IA sepa qué existe y qué fechas tiene hoy. */
export function resumenActual(datos) {
  return (datos?.becas || []).map((b) => [
    b.id, b.tipo || 'beca', b.nombre,
    (b.ventanas || []).map(ventanaTxt).join('; ') || (b.modo === 'continua' ? 'todo el año' : 'sin ventana'),
    b.evento?.inicio ? `evento ${b.evento.inicio}→${b.evento.fin || b.evento.inicio}` : '',
    b.tipo === 'curso' ? `cert: ${b.cert || '?'}` : '',
    b.postular?.url || '', `verificado ${b.verificado || '?'}`,
  ].filter(Boolean).join(' | ')).join('\n');
}

const EJEMPLO = {
  id: 'beca-ejemplo-2027', tipo: 'beca', nombre: 'Nombre oficial completo', corto: 'Nombre corto (≤ 18 letras)',
  entidad: 'Institución que convoca', destino: 'País o «En línea»', nivel: ['posgrado'], esp: ['ambiental', 'civil'],
  area: 'Áreas de estudio', resumen: '1 o 2 oraciones: qué es y para quién.', modo: 'fija',
  ventanas: [{ inicio: '2026-11-03', fin: '2027-01-21', etiqueta: 'Postulación 2027', hora: '23:59 (Ginebra)' }],
  proxima: '', fechas: [{ fecha: '2027-01-21', evento: 'Cierre de la postulación' }],
  postular: { url: 'https://sitio-oficial/convocatoria', texto: 'Postular en sitio-oficial' },
  requisitos: ['…'], beneficios: ['…'], documentos: ['…'], nota: '', redes: [], linkedin: 'término para buscar ganadores en LinkedIn',
  fuentes: [{ t: 'Institución · página oficial', u: 'https://sitio-oficial/convocatoria' }], verificado: 'AAAA-MM-DD',
};

/**
 * Prompt para que una IA con búsqueda web revise y actualice los datos.
 * @param {{datos:object, hoy?:Date, frecuencia?:string, paraChat?:boolean}} o
 */
export function promptCurador({ datos, hoy = new Date(), frecuencia = 'semanal', paraChat = true } = {}) {
  const f = FRECUENCIAS[frecuencia] || FRECUENCIAS.semanal;
  const fecha = hoyIso(hoy);
  return [
    `Eres el verificador de «Becas al Día», un catálogo de becas, pasantías, eventos y cursos con certificado para estudiantes y profesionales de ingeniería del Perú (civil, ambiental, minas, cierre de minas, relaves, proyectos, costos y presupuestos, control de proyectos, SSOMA, SIG, BIM, IA y datos). Hoy es ${fecha}.`,
    '',
    paraChat && f.dias ? `Si puedes programar tareas, programa esta misma revisión para que se repita ${f.txt} y entrega el resultado con el mismo formato cada vez.` : '',
    '',
    'TU TAREA',
    '1. Revisa en la web OFICIAL de cada registro de la lista de abajo (no blogs ni agregadores) si cambiaron aperturas, cierres, fechas clave, requisitos, costos, estado del certificado o el enlace para postular. Usa la búsqueda web: no respondas de memoria.',
    '2. Si una institución aún no publica su nueva convocatoria, deja o pon la ventana con "estimada": true calculada con el ciclo anterior.',
    '3. Busca convocatorias NUEVAS que encajen con el público (becas de posgrado, pasantías, programas cortos, eventos y congresos de ingeniería en Perú o en línea, cursos con certificado gratis u ofertas vigentes en Coursera, edX, Esri, PMI, Autodesk, Microsoft, Google, IBM, UN CC:Learn…). Agrégalas solo si tienen fecha o página oficial verificable. Máximo 8 nuevas por revisión.',
    '4. Retira los registros que ya no existan o cuya oferta venció sin próxima edición.',
    '',
    'REGLAS',
    '- Nunca inventes fechas, costos, montos ni requisitos. Si no lo encuentras, déjalo como está y menciónalo en "notas".',
    '- Fechas en formato AAAA-MM-DD, o AAAA-MM si solo se conoce el mes.',
    '- Escribe en español de Perú, claro y breve.',
    '- No incluyas perfiles personales de LinkedIn ni datos de personas.',
    '',
    'FORMATO DE RESPUESTA',
    'Responde SOLO con un bloque ```json que contenga los CAMBIOS (no repitas lo que no cambió):',
    '```json',
    JSON.stringify({
      actualizado: fecha,
      notas: ['Becas: …', 'Eventos: …', 'Cursos: …', 'Próximos cierres en 14 días: …', 'Sin verificar: …'],
      items: [
        { id: 'id-existente', ventanas: [{ inicio: '2026-11-09', fin: '2027-01-21', etiqueta: 'Postulación 2027' }], verificado: fecha, fuentes: [{ t: '…', u: 'https://…' }] },
        { '...': 'registro NUEVO completo, con todos los campos como el ejemplo de abajo' },
      ],
      retirar: ['id-que-ya-no-existe'],
    }, null, 1),
    '```',
    '- En "items", para un registro existente manda su "id" y solo los campos que cambian (una lista que cambia se manda completa). Pon "verificado" con la fecha de hoy en todo lo que revisaste aunque no haya cambiado nada más.',
    '- Para un registro nuevo manda todos los campos. "id": minúsculas, números y guiones, único.',
    '',
    'ESQUEMA DE UN REGISTRO NUEVO',
    '- tipo: "beca" | "evento" | "curso". modo: "fija" (fechas fijas), "por_programa" (cada programa tiene su plazo) o "continua" (todo el año / a tu ritmo).',
    '- nivel (solo becas): "pregrado", "posgrado", "corto", "investigacion". esp: "civil", "minas", "mecanica-electrica", "sistemas", "industrial", "electronica", "ambiental", "quimica", "proyectos", "ssoma" o ["todas"].',
    '- ventanas: periodos de postulación o inscripción {inicio, fin, etiqueta, estimada?, hora?}. Para una oferta de curso usa etiqueta "Oferta" y como fin su vencimiento.',
    '- Eventos además: evento {inicio, fin}, formato (Congreso, Feria, Hackathon…), modalidad, costo, gratis (true/false), recurrencia (si es permanente).',
    '- Cursos además: plataforma, duracion, idioma, cert ("gratis" | "pago" | "ayuda" | "confirmar"), certificado (texto: costo o condición).',
    'Ejemplo:',
    JSON.stringify(EJEMPLO),
    '',
    `REGISTROS ACTUALES (${(datos?.becas || []).length}; id | tipo | nombre | ventanas | evento | certificado | enlace | última verificación):`,
    resumenActual(datos),
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Extrae el JSON de la respuesta: el último bloque ```json o, si no hay, el objeto más grande. */
export function leerParche(texto) {
  const s = String(texto || '');
  const bloques = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim()).filter((b) => b.startsWith('{'));
  const candidatos = bloques.length ? bloques.reverse() : [s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)];
  for (const c of candidatos) {
    if (!c) continue;
    try {
      const j = JSON.parse(c);
      if (j && typeof j === 'object') {
        // También se acepta el archivo completo (como data/curado.json)
        if (Array.isArray(j.becas)) return { completo: true, datos: j };
        if (Array.isArray(j.items) || Array.isArray(j.retirar) || Array.isArray(j.notas)) {
          return { completo: false, actualizado: j.actualizado, notas: Array.isArray(j.notas) ? j.notas.map(String) : [], items: Array.isArray(j.items) ? j.items : [], retirar: Array.isArray(j.retirar) ? j.retirar.map(String) : [], empleo: j.empleo };
        }
      }
    } catch { /* probar el siguiente */ }
  }
  throw new Error('No encontré el bloque JSON con los cambios en la respuesta. Copia la respuesta completa de la IA.');
}

const LISTAS = ['nivel', 'esp', 'ventanas', 'fechas', 'requisitos', 'beneficios', 'documentos', 'redes', 'fuentes'];
/**
 * Aplica el parche sobre los datos actuales. Lo que no pasa la validación se descarta (no rompe el resto).
 * @returns {{datos:object, resumen:{nuevos:string[], cambiados:string[], retirados:string[], descartados:string[]}}}
 */
export function aplicarParche(base, parche, { hoy = new Date(), proveedor = 'tu IA' } = {}) {
  const fecha = hoyIso(hoy);
  const resumen = { nuevos: [], cambiados: [], retirados: [], descartados: [] };
  if (parche.completo) {
    const d = { ...parche.datos, origen: 'ia', proveedor, actualizado: parche.datos.actualizado || fecha };
    const v = validarCurado(d);
    if (!v.ok) throw new Error(`El archivo tiene problemas: ${v.problemas.slice(0, 3).join('; ')}`);
    resumen.cambiados = d.becas.map((b) => b.id);
    return { datos: d, resumen };
  }
  const datos = structuredClone(base || { becas: [], registro: [] });
  const porId = new Map(datos.becas.map((b, i) => [b.id, i]));
  for (const crudo of parche.items || []) {
    if (!crudo || typeof crudo !== 'object' || !crudo.id) { resumen.descartados.push('registro sin id'); continue; }
    const cambio = {};
    for (const [k, v] of Object.entries(crudo)) {
      if (k === '...') continue;
      if (LISTAS.includes(k) && !Array.isArray(v)) continue; // forma inválida: se ignora el campo
      cambio[k] = v;
    }
    cambio.verificado ||= fecha;
    const i = porId.get(crudo.id);
    const nuevo = i == null ? { tipo: 'beca', modo: 'fija', nivel: [], esp: [], ventanas: [], fechas: [], requisitos: [], beneficios: [], documentos: [], redes: [], fuentes: [], proxima: '', nota: '', ...cambio }
      : { ...datos.becas[i], ...cambio };
    nuevo.corto ||= String(nuevo.nombre || '').slice(0, 22);
    nuevo.linkedin ||= nuevo.corto;
    const p = problemasDe(nuevo);
    if (p.length) { resumen.descartados.push(p[0]); continue; }
    if (i == null) { porId.set(nuevo.id, datos.becas.length); datos.becas.push(nuevo); resumen.nuevos.push(nuevo.id); }
    else { datos.becas[i] = nuevo; resumen.cambiados.push(nuevo.id); }
  }
  const quitar = new Set((parche.retirar || []).filter((id) => porId.has(id)));
  if (quitar.size) { datos.becas = datos.becas.filter((b) => !quitar.has(b.id)); resumen.retirados = [...quitar]; }
  if (parche.empleo?.ofertas && Array.isArray(parche.empleo.ofertas)) datos.empleo = { ...(datos.empleo || {}), ofertas: parche.empleo.ofertas.filter((o) => /^https?:\/\//.test(o?.url || '')) };
  datos.actualizado = /^\d{4}-\d{2}-\d{2}$/.test(parche.actualizado || '') && parche.actualizado <= fecha ? parche.actualizado : fecha;
  datos.origen = 'ia'; datos.proveedor = proveedor;
  const notas = [...(parche.notas || [])];
  const cifras = [resumen.nuevos.length && `${resumen.nuevos.length} nuevos`, resumen.cambiados.length && `${resumen.cambiados.length} revisados`, resumen.retirados.length && `${resumen.retirados.length} retirados`, resumen.descartados.length && `${resumen.descartados.length} descartados por datos inválidos`].filter(Boolean).join(', ');
  notas.unshift(`Revisión hecha con ${proveedor}${cifras ? `: ${cifras}` : ''}.`);
  datos.registro = [{ fecha, notas, origen: 'ia' }, ...(datos.registro || [])].slice(0, 20);
  return { datos, resumen };
}

/** ¿Toca una revisión automática? */
export function tocaCurar(frecuencia, ultimaIso, ahora = new Date()) {
  const dias = FRECUENCIAS[frecuencia]?.dias || 0;
  if (!dias) return false;
  if (!ultimaIso) return true;
  return (ahora - new Date(ultimaIso)) / 86400000 >= dias - 0.05;
}
