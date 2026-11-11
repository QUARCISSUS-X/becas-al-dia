// % de coincidencia oferta ↔ CV, sin IA. Funciones puras (se prueban en Node).
//
// El puntaje combina cuatro componentes; los que no se pueden evaluar (p. ej. la oferta
// no pide años de experiencia) se omiten y el resto se re-pondera:
//   habilidades 45 % · profesión 20 % · perfil buscado 20 % · experiencia 15 %
// En habilidades, lo «deseable» pesa un tercio de lo indispensable, y lo que la oferta
// menciona en «Beneficios» o «Sobre nosotros» no cuenta como requisito.
import { reglasCvTexto, nombreDeArchivo } from './reglasCv.js';

export const sinTildes = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normalizar = (s = '') => ' ' + sinTildes(s).replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

// Vocabulario del rubro: [etiqueta visible, ...variantes]. Las variantes se buscan como
// frases completas sobre el texto normalizado (sin tildes, minúsculas).
export const VOCABULARIO = [
  // Software
  ['S10', 's10'], ['MS Project', 'ms project', 'microsoft project'], ['Primavera P6', 'primavera', 'p6'],
  ['AutoCAD', 'autocad'], ['Civil 3D', 'civil 3d', 'civil3d'], ['Revit', 'revit'], ['BIM', 'bim'],
  ['Excel avanzado', 'excel avanzado', 'excel intermedio', 'excel nivel avanzado'], ['Excel', 'excel'],
  ['Power BI', 'power bi', 'powerbi'], ['SAP', 'sap'], ['ArcGIS', 'arcgis'], ['QGIS', 'qgis'], ['GIS/SIG', 'gis', 'sig', 'sistemas de informacion geografica'],
  ['Python', 'python'], ['SAP2000', 'sap2000'], ['ETABS', 'etabs'], ['Navisworks', 'navisworks'],
  ['Delphin Express', 'delphin'], ['Presto', 'presto'], ['Power Apps', 'power apps'],
  // Gestión de proyectos, costos
  ['Control de proyectos', 'control de proyectos', 'project control', 'project controls'],
  ['Costos y presupuestos', 'costos y presupuestos', 'presupuestos', 'presupuesto de obra', 'cost control', 'control de costos'],
  ['Metrados', 'metrados', 'metrado'], ['APU', 'apu', 'analisis de precios unitarios', 'precios unitarios'],
  ['Valorizaciones', 'valorizaciones', 'valorizacion'], ['Cronogramas', 'cronograma', 'cronogramas', 'programacion de obra'],
  ['Valor ganado (EVM)', 'valor ganado', 'earned value', 'evm'], ['PMBOK', 'pmbok'], ['PMP', 'pmp'], ['Last Planner / Lean', 'last planner', 'lean construction'],
  ['Expediente técnico', 'expediente tecnico', 'expedientes tecnicos'], ['Términos de referencia', 'terminos de referencia', 'tdr'],
  ['Contrataciones del Estado', 'contrataciones del estado', 'ley de contrataciones', 'osce', 'seace'],
  ['Licitaciones', 'licitacion', 'licitaciones', 'propuestas tecnicas'], ['Supervisión de obra', 'supervision de obra', 'supervisor de obra'],
  ['Residencia de obra', 'residente de obra'], ['Liquidación de obra', 'liquidacion de obra'], ['Adicionales y deductivos', 'adicionales', 'deductivos'],
  ['Gestión de contratos', 'gestion de contratos', 'administracion de contratos', 'contract management'],
  ['Planeamiento', 'planeamiento', 'planificacion', 'planner'], ['KPI / reportes', 'kpi', 'indicadores de gestion', 'reportes de gestion'],
  // Ambiental y minería
  ['Cierre de minas', 'cierre de minas', 'cierre de mina', 'plan de cierre', 'mine closure'],
  ['Relaves', 'relaves', 'relave', 'tailings', 'deposito de relaves'], ['Gobernanza de relaves', 'gobernanza de relaves', 'gistm', 'tailings governance'],
  ['Pasivos ambientales', 'pasivos ambientales', 'pam'], ['Instrumentos de gestión ambiental', 'instrumentos de gestion ambiental', 'iga', 'igac'],
  ['EIA', 'eia', 'eia d', 'eia sd', 'estudio de impacto ambiental'], ['DIA', 'declaracion de impacto ambiental'], ['ITS', 'its', 'informe tecnico sustentatorio'],
  ['PAMA', 'pama'], ['Monitoreo ambiental', 'monitoreo ambiental', 'monitoreos ambientales'], ['Calidad de agua', 'calidad de agua', 'efluentes'],
  ['Calidad de aire', 'calidad de aire'], ['Residuos sólidos', 'residuos solidos', 'gestion de residuos'], ['Hidrología', 'hidrologia', 'hidrogeologia'],
  ['Geotecnia', 'geotecnia', 'geotecnico'], ['Remediación', 'remediacion', 'rehabilitacion de suelos'], ['Revegetación', 'revegetacion'],
  ['OEFA', 'oefa'], ['SENACE', 'senace'], ['ANA', 'autoridad nacional del agua'], ['MINEM', 'minem'],
  ['Permisos ambientales', 'permisos ambientales', 'permisologia', 'licencias ambientales'], ['Fiscalización ambiental', 'fiscalizacion ambiental'],
  ['Relaciones comunitarias', 'relaciones comunitarias'], ['Huella de carbono', 'huella de carbono'], ['Sostenibilidad / ESG', 'sostenibilidad', 'esg'],
  ['Operaciones mineras', 'operaciones mineras', 'unidad minera', 'mina subterranea', 'tajo abierto'],
  // Normas y SSOMA
  ['ISO 14001', 'iso 14001'], ['ISO 9001', 'iso 9001'], ['ISO 45001', 'iso 45001'], ['SSOMA / HSE', 'ssoma', 'hse', 'sst', 'seguridad y salud en el trabajo'],
  ['DS 024-2016-EM', '024 2016 em'], ['Normativa ambiental', 'normativa ambiental', 'legislacion ambiental'],
  // Más del rubro (costos, obra, calidad)
  ['Estimación de costos', 'estimacion de costos', 'cost estimating'],
  ['CAPEX / OPEX', 'capex', 'opex'], ['Forecast / flujo de caja', 'forecast', 'flujo de caja', 'cash flow'],
  ['Gestión de riesgos', 'gestion de riesgos', 'analisis de riesgos', 'matriz de riesgos'],
  ['Control documentario', 'control documentario', 'control de documentos'], ['QA/QC', 'qa qc', 'aseguramiento de calidad', 'control de calidad'],
  ['Movimiento de tierras', 'movimiento de tierras'], ['Topografía', 'topografia'], ['Obras civiles', 'obras civiles'],
  ['Plantas de tratamiento', 'ptar', 'ptap', 'planta de tratamiento', 'plantas de tratamiento', 'tratamiento de aguas'],
  ['Gestión de contratistas', 'gestion de contratistas', 'empresas contratistas', 'administracion de contratistas'],
  ['Ingeniería de detalle', 'ingenieria de detalle', 'ingenieria basica', 'factibilidad', 'prefactibilidad'],
  ['Power Query / macros', 'power query', 'macros', 'vba'], ['SQL', 'sql'],
  // Idiomas y licencias
  ['Inglés básico', 'ingles basico'], ['Inglés intermedio', 'ingles intermedio'], ['Inglés avanzado', 'ingles avanzado'], ['Licencia de conducir', 'licencia de conducir', 'brevete'],
  ['Colegiado y habilitado', 'colegiado', 'colegiatura', 'habilitado'],
];

// Profesiones que una oferta puede exigir
export const PROFESIONES = {
  ambiental: ['ingenieria ambiental', 'ingeniero ambiental', 'ingeniera ambiental', 'ing ambiental', 'ciencias ambientales', 'ingenieria ambiental y de recursos naturales', 'ingenieria sanitaria'],
  civil: ['ingenieria civil', 'ingeniero civil', 'ingeniera civil', 'ing civil'],
  minas: ['ingenieria de minas', 'ingeniero de minas', 'ingeniera de minas'],
  geologia: ['ingenieria geologica', 'ingeniero geologo', 'geologia', 'geologo'],
  metalurgia: ['ingenieria metalurgica', 'metalurgista'],
  industrial: ['ingenieria industrial', 'ingeniero industrial', 'ingeniera industrial'],
  sistemas: ['ingenieria de sistemas', 'ingeniero de sistemas', 'ingenieria informatica', 'ingenieria de software', 'computacion'],
  mecanica: ['ingenieria mecanica', 'ingeniero mecanico', 'mecanica electrica', 'mecatronica'],
  electrica: ['ingenieria electrica', 'ingeniero electricista', 'ingenieria electronica'],
  quimica: ['ingenieria quimica', 'ingeniero quimico'],
  agronomia: ['agronomia', 'ingeniero agronomo', 'ingenieria agricola', 'ingenieria forestal', 'biologia', 'biologo'],
  arquitectura: ['arquitectura', 'arquitecto'],
  economia: ['economia', 'economista', 'contabilidad', 'contador', 'administracion de empresas', 'finanzas'],
  derecho: ['derecho', 'abogado', 'abogada'],
  salud: ['enfermeria', 'medicina', 'obstetricia', 'odontologia', 'psicologia', 'tecnologia medica', 'quimico farmaceutico'],
  educacion: ['educacion', 'docente', 'profesor'],
};

// Perfiles de búsqueda del formulario: qué buscar en cada portal y cómo reconocerlo en el título
export const PERFILES = {
  'control-proyectos': { nombre: 'Control de proyectos', q: ['control de proyectos'], servir: ['proyectos'], re: /control de proyectos|project control|planner|planeamiento|programacion de obra|oficina de proyectos|pmo/ },
  'costos-presupuestos': { nombre: 'Costos y presupuestos', q: ['costos y presupuestos', 'presupuestos'], servir: ['presupuesto', 'costos'], re: /costo|presupuest|metrado|estimador|valorizac/ },
  'cierre-minas': { nombre: 'Cierre de minas', q: ['cierre de minas'], servir: ['cierre'], re: /cierre de mina|plan de cierre|mine closure|pasivos ambientales/ },
  relaves: { nombre: 'Gobernanza de relaves', q: ['relaves'], servir: ['relaves'], re: /relave|tailings/ },
  mineria: { nombre: 'Minería', q: ['ingeniero ambiental mineria', 'minera'], servir: ['miner'], re: /miner|\bmina\b|unidad minera|metalurg/ },
  ambiental: { nombre: 'Ingeniería ambiental', q: ['ingeniero ambiental'], servir: ['ambiental'], re: /ambiental|medio ambiente|environment|sostenib/ },
  civil: { nombre: 'Ingeniería civil', q: ['ingeniero civil'], servir: ['civil'], re: /civil|obra|construcc|estructur/ },
  practicas: { nombre: 'Prácticas', q: ['practicante ingenieria ambiental', 'practicante ingenieria civil'], servirPracticas: ['ingenieria ambiental', 'ingenieria civil'], re: /practicante|practicas|trainee|pasant|egresad/ },
};

// Mineras y contratistas mineros frecuentes en Perú (para la etiqueta «Minera»)
export const MINERAS = [
  'antamina', 'southern', 'volcan', 'las bambas', 'mmg', 'cerro verde', 'buenaventura', 'nexa', 'glencore', 'antapaccay',
  'chinalco', 'hudbay', 'yanacocha', 'newmont', 'gold fields', 'barrick', 'poderosa', 'minsur', 'marcobre', 'anglo american',
  'quellaveco', 'shougang', 'pan american silver', 'milpo', 'raura', 'chungar', 'atacocha', 'el brocal', 'san ignacio de morococha',
  'minera', 'mining', 'mina ', 'unidad minera', 'stracon', 'jjc', 'cosapi', 'aenza', 'graña y montero', 'ausenco', 'knight piesold',
  'srk', 'golder', 'wsp', 'hatch', 'fluor', 'bechtel', 'tetra tech', 'walsh', 'jacobs', 'ferreyros', 'komatsu', 'epiroc',
];

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Convierte las «palabras clave» del usuario (separadas por coma) en entradas de vocabulario. */
export function clavesUsuario(texto = '') {
  return String(texto).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 2)
    .map((s) => [s, sinTildes(s).replace(/[^a-z0-9+#]+/g, ' ').trim()]);
}

function construir(vocab) {
  return vocab.map(([etiqueta, ...variantes]) => ({
    etiqueta,
    re: new RegExp(`\\s(${variantes.map((v) => escapar(normalizar(v).trim())).join('|')})\\s`),
  }));
}
const BASE = construir(VOCABULARIO);

/** Etiquetas del vocabulario presentes en un texto. */
export function terminos(texto, vocab = BASE) {
  const t = normalizar(texto);
  const res = new Set();
  for (const v of vocab) if (v.re.test(t)) res.add(v.etiqueta);
  // "Excel avanzado" implica "Excel"
  if (res.has('Excel avanzado')) res.delete('Excel');
  return res;
}

export function profesionesEn(texto) {
  const t = normalizar(texto);
  return new Set(Object.entries(PROFESIONES).filter(([, vs]) => vs.some((v) => t.includes(' ' + v + ' '))).map(([k]) => k));
}

/** Años de experiencia que pide la oferta (el mayor número citado), o null. */
export function aniosPedidos(texto) {
  const t = normalizar(texto).replace(/\s(uno|un)\s/g, ' 1 ').replace(/\sdos\s/g, ' 2 ').replace(/\stres\s/g, ' 3 ')
    .replace(/\scuatro\s/g, ' 4 ').replace(/\scinco\s/g, ' 5 ');
  const res = [];
  const pats = [
    /\s(\d{1,2})\s(?:a\s\d{1,2}\s)?(?:anos|ano)\s(?:de\s)?(?:experiencia|exp)/g,
    /experiencia\s(?:laboral\s|profesional\s|general\s|especifica\s)?(?:minima\s)?(?:de\s)?(?:al\smenos\s)?(\d{1,2})\s(?:anos|ano)/g,
    /\s(\d{1,2})\s(?:anos|ano)\s(?:como\sminimo|minimo)/g,
    /minimo\s(\d{1,2})\s(?:anos|ano)/g,
    /(\d{1,2})\s(?:years?)\s(?:of\s)?experience/g,
  ];
  for (const re of pats) for (const m of t.matchAll(re)) { const n = Number(m[1]); if (n > 0 && n <= 30) res.push(n); }
  return res.length ? Math.max(...res) : null;
}

export const esPractica = (titulo = '') => PERFILES.practicas.re.test(sinTildes(titulo));
export const esMinera = (texto = '') => { const t = ' ' + sinTildes(texto) + ' '; return MINERAS.some((m) => t.includes(m)); };

// ---------- Secciones de la oferta: indispensable / deseable / no es requisito ----------
const DESEABLE = /\b(deseable|deseables|de preferencia|preferentemente|preferible|preferiblemente|se valorara|se valora|valorable|valorado|sera un plus|es un plus|un plus|opcional|opcionalmente|no indispensable|no excluyente|no limitante|nice to have|idealmente)\b/;
const CAB_REQ = /^(requisitos|requerimientos|requerido|perfil|funciones|principales funciones|responsabilidades|conocimientos|competencias|formacion|experiencia|estudios|indispensable|que buscamos|te buscamos|buscamos|tu mision|mision del puesto)/;
const CAB_DES = /^(deseable|deseables|valorable|se valorara|plus|adicional|adicionales)/;
const CAB_IGNORAR = /^(beneficios|ofrecemos|que ofrecemos|te ofrecemos|nuestra propuesta|sobre nosotros|quienes somos|somos|acerca de|sobre la empresa|condiciones|horario|lugar de trabajo)/;
const REACTIVA = /requisit|requerim|indispensable|experiencia|conocimiento|funciones|responsabilidades|buscamos|formacion|egresad|titulad|bachiller/;

/**
 * Separa la descripción en lo indispensable (req) y lo deseable (des); descarta beneficios y
 * la presentación de la empresa. Funciona con saltos de línea o, si no los hay, por oraciones.
 */
export function seccionar(texto = '') {
  let segs = String(texto).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 2) segs = String(texto).split(/(?<=[.;:!?])\s+(?=[A-ZÁÉÍÓÚÑ¿•\d-])|\s[•·▪●]\s/).map((s) => s.trim()).filter(Boolean);
  const out = { req: [], des: [] };
  let estado = 'req';
  for (const seg of segs) {
    const n = sinTildes(seg).replace(/^[\s•·▪●*\-–\d.)]+/, '').trim();
    const dosPuntos = n.indexOf(':');
    const cabeza = dosPuntos >= 0 && dosPuntos <= 60 ? n.slice(0, dosPuntos) : n.length <= 40 ? n : '';
    const esCab = cabeza && (CAB_REQ.test(cabeza) || CAB_DES.test(cabeza) || CAB_IGNORAR.test(cabeza));
    if (esCab) estado = CAB_DES.test(cabeza) || DESEABLE.test(cabeza) ? 'des' : CAB_IGNORAR.test(cabeza) ? 'ign' : 'req';
    else if (estado === 'ign' && REACTIVA.test(n)) estado = 'req';
    // Una frase suelta con «deseable», «de preferencia», «no excluyente»… es deseable aunque esté entre requisitos
    const donde = !esCab && estado !== 'ign' && DESEABLE.test(n) ? 'des' : estado;
    if (donde !== 'ign') out[donde].push(seg);
  }
  return { req: out.req.join('\n'), des: out.des.join('\n') };
}
const PESO_DESEABLE = 0.35;

/**
 * Calcula la coincidencia de una oferta con el perfil del usuario.
 * @param {{titulo:string, descripcion?:string, empresa?:string}} oferta
 * @param {{cvTexto?:string, claves?:string, profesion?:string, experiencia?:string|number, perfiles?:string[]}} perfil
 * @returns {{pct:number|null, coinciden:string[], faltan:string[], faltanDeseables:string[], notas:string[], partes:object}}
 */
export function coincidencia(oferta, perfil = {}) {
  const textoOferta = `${oferta.titulo || ''}. ${oferta.descripcion || ''}`;
  const sec = seccionar(oferta.descripcion || '');
  const textoReq = `${oferta.titulo || ''}. ${sec.req}`;
  // Claves del usuario que ya están en el vocabulario se cuentan con su etiqueta estándar
  // (así «cierre de minas» no aparece dos veces); las demás se agregan como términos propios.
  const enBase = new Set();
  const claves = clavesUsuario(perfil.claves).filter(([c]) => { const t = terminos(c); t.forEach((x) => enBase.add(x)); return !t.size; });
  const vocab = claves.length ? [...BASE, ...construir(claves)] : BASE;
  const textoCv = `${perfil.profesion || ''}. ${perfil.claves || ''}. ${perfil.cvTexto || ''}`;

  // 1) Habilidades que pide la oferta vs. las que tiene el CV
  const pide = terminos(textoReq, vocab);
  const pideDes = new Set([...terminos(sec.des, vocab)].filter((x) => !pide.has(x)));
  if (pide.has('Excel avanzado')) pideDes.delete('Excel');
  const tiene = terminos(textoCv, vocab);
  for (const [c] of claves) tiene.add(c);
  enBase.forEach((x) => tiene.add(x));
  // Si el CV tiene "Excel avanzado", también cubre "Excel"
  if (tiene.has('Excel avanzado')) tiene.add('Excel');
  const okReq = [...pide].filter((x) => tiene.has(x));
  const okDes = [...pideDes].filter((x) => tiene.has(x));
  const coinciden = [...okReq, ...okDes];
  const faltan = [...pide].filter((x) => !tiene.has(x));
  const faltanDeseables = [...pideDes].filter((x) => !tiene.has(x));
  const notas = [];
  const partes = {};
  const totalPedido = pide.size + PESO_DESEABLE * pideDes.size;
  partes.habilidades = totalPedido ? (okReq.length + PESO_DESEABLE * okDes.length) / totalPedido : null;

  // 2) Profesión
  const profOferta = profesionesEn(textoOferta);
  const profCv = profesionesEn(`${perfil.profesion || ''} ${(perfil.perfiles || []).map((p) => PROFESIONES[p]?.[0] || '').join(' ')}`);
  if (!profCv.size && perfil.cvTexto) profesionesEn(perfil.cvTexto.slice(0, 2000)).forEach((p) => profCv.add(p));
  if (profOferta.size && profCv.size) {
    const ok = [...profOferta].some((p) => profCv.has(p));
    partes.profesion = ok ? 1 : 0;
    if (!ok) notas.push(`Pide otra carrera (${[...profOferta].join(', ')})`);
  } else partes.profesion = null;

  // 3) Experiencia
  // Los años que aparecen solo en «deseable» no penalizan
  const pideAnios = aniosPedidos(textoReq);
  const misAnios = perfil.experiencia === '' || perfil.experiencia == null ? null : Number(perfil.experiencia);
  if (pideAnios != null && misAnios != null && !Number.isNaN(misAnios)) {
    partes.experiencia = Math.min(1, misAnios / pideAnios);
    if (misAnios < pideAnios) notas.push(`Pide ${pideAnios} años de experiencia; tienes ${misAnios}`);
  } else partes.experiencia = null;
  if (pideAnios != null) partes.aniosPedidos = pideAnios;

  // 4) ¿Corresponde a los perfiles que busca?
  const sel = (perfil.perfiles || []).filter((p) => PERFILES[p]);
  if (sel.length) {
    const tit = sinTildes(oferta.titulo || '');
    const desc = sinTildes(oferta.descripcion || '');
    // "Prácticas" es una modalidad, no un área: no cuenta para el área del puesto
    const areas = sel.filter((p) => p !== 'practicas');
    if (areas.length) {
      partes.perfil = areas.some((p) => PERFILES[p].re.test(tit)) ? 1 : areas.some((p) => PERFILES[p].re.test(desc)) ? 0.6 : 0.15;
    } else partes.perfil = null;
  } else partes.perfil = null;

  const PESOS = { habilidades: 0.45, profesion: 0.2, perfil: 0.2, experiencia: 0.15 };
  let suma = 0; let pesos = 0;
  for (const [k, w] of Object.entries(PESOS)) if (partes[k] != null) { suma += partes[k] * w; pesos += w; }
  let pct = pesos ? Math.round((100 * suma) / pesos) : null;
  // Pedir otra carrera es casi descalificante: tope de 35 %
  if (partes.profesion === 0 && pct != null) pct = Math.min(pct, 35);
  // Sin requisitos concretos que comparar (solo título/carrera) no se puede asegurar más de 70 %
  if (partes.habilidades == null && pct != null) {
    pct = Math.min(pct, 70);
    notas.push('La oferta no detalla requisitos: revisa la descripción completa');
  }

  // tope: máximo que puede alcanzar el % aunque el aprendizaje sume puntos
  const tope = partes.profesion === 0 ? 35 : partes.habilidades == null ? 70 : 100;
  return { pct, coinciden, faltan, faltanDeseables, notas, partes, tope };
}

// ---------- Aprendizaje de tus decisiones (sin IA) ----------
// Lo que guardas o marcas como postulado sube unos puntos a las ofertas parecidas; lo que
// ocultas las baja. Se compara por palabras del título y por empresa. Máximo ±8 puntos.
const VACIAS = new Set(['para', 'con', 'por', 'los', 'las', 'del', 'una', 'uno', 'que', 'sede', 'lima', 'peru', 'zona', 'area', 'proyecto', 'proyectos',
  'senior', 'junior', 'semi', 'ssr', 'sr', 'jr', 'urgente', 'ingeniero', 'ingeniera', 'ingenieria', 'profesional', 'empresa', 'importante', 'trabajo', 'empleo']);
const SIN_EMPRESA = /confidencial|no indicada|entidad publica/;
/** Nombre de empresa comparable: sin tildes ni forma societaria («Minera Sol S.A.C.» = «MINERA SOL SAC» = «Minera Sol»). */
export function claveEmpresa(nombre = '') {
  const e = normalizar(nombre).replace(/\s(s\sa\sc|s\sa\sa|s\sa|s\sr\sl|s\sc\sr\sl|e\si\sr\sl|sac|saa|sa|srl|scrl|eirl|ltda|inc|corp)\s$/, ' ').trim();
  return SIN_EMPRESA.test(e) ? '' : e;
}
export function fichas(o) {
  const f = new Set(normalizar(o.titulo || '').split(' ').filter((w) => w.length >= 4 && !VACIAS.has(w)));
  const e = claveEmpresa(o.empresa);
  if (e) f.add('emp:' + e);
  return [...f];
}
export const MAX_AJUSTE = 8;
/** @returns {{activo:boolean, pesos:Object<string,number>, senales:number}} */
export function aprender(items = [], positivas = new Set(), negativas = new Set()) {
  const g = {}; const n = {}; let senales = 0;
  for (const o of items) {
    const signo = positivas.has(o.id) ? 1 : negativas.has(o.id) ? -1 : 0;
    if (!signo) continue;
    senales++;
    for (const t of fichas(o)) (signo > 0 ? g : n)[t] = ((signo > 0 ? g : n)[t] || 0) + 1;
  }
  const pesos = {};
  for (const t of new Set([...Object.keys(g), ...Object.keys(n)])) pesos[t] = ((g[t] || 0) - (n[t] || 0)) / ((g[t] || 0) + (n[t] || 0) + 1);
  return { activo: senales >= 3, pesos, senales };
}
export function ajuste(o, modelo) {
  if (!modelo?.activo) return 0;
  const s = fichas(o).reduce((a, t) => a + (modelo.pesos[t] || 0), 0);
  return Math.round(MAX_AJUSTE * Math.max(-1, Math.min(1, s / 2)));
}

/** Nombre de archivo seguro a partir de la empresa (o del puesto si es confidencial). */
export function destinoDe(oferta) {
  return (oferta.empresa && !/confidencial|no indicada/i.test(oferta.empresa) ? oferta.empresa : oferta.titulo || 'puesto')
    .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Prompt listo para pegar en un chat de IA y adaptar el CV a la oferta. */
export function promptCv(oferta, perfil = {}, res = coincidencia(oferta, perfil)) {
  const destino = destinoDe(oferta);
  const desc = (oferta.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  return [
    'Adapta mi CV a la siguiente oferta laboral. Reglas:',
    ...reglasCvTexto(nombreDeArchivo('CV', destino)),
    '',
    `## Oferta: ${oferta.titulo || ''}`,
    `Empresa: ${oferta.empresa || '—'} · Lugar: ${oferta.ubicacion || '—'} · Fuente: ${oferta.fuente || '—'}`,
    oferta.url ? `Enlace: ${oferta.url}` : '',
    '',
    desc || '(La oferta no trae descripción; usa el título y la empresa.)',
    '',
    `## Análisis previo (automático, sin IA): ${res.pct ?? '—'} % de coincidencia`,
    res.coinciden.length ? `Ya cubro: ${res.coinciden.join(', ')}` : '',
    res.faltan.length ? `No aparece en mi CV (indispensable): ${res.faltan.join(', ')}` : '',
    res.faltanDeseables?.length ? `No aparece en mi CV (deseable): ${res.faltanDeseables.join(', ')}` : '',
    ...res.notas,
    '',
    '## Mi CV actual',
    perfil.cvTexto?.trim() || '(Pega aquí tu CV)',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
