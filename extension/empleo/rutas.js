// Rutas de búsqueda de empleo (portadas de la página «Becas al Día»): por ruta, especialidad y nivel
// arma la búsqueda principal, enlaces en vivo a cada bolsa, búsqueda booleana, requisitos típicos,
// normas, empresas para seguir y el prompt para adaptar el CV a un aviso pegado. Funciones puras.
import { reglasCvTexto, nombreDeArchivo } from './reglasCv.js';

const MINERAS = ['Antamina', 'Southern Peru', 'Cerro Verde', 'Buenaventura', 'Las Bambas', 'Anglo American', 'Nexa Resources', 'Volcan', 'Chinalco', 'Hudbay'];
const CONSULT = ['Anddes', 'SRK Consulting', 'WSP', 'Knight Piésold', 'Ausenco', 'Stantec', 'Hatch', 'Cesel', 'Golder', 'ERM'];
const CONSTR = ['AENZA', 'Cosapi', 'JJC', 'San Martín Contratistas', 'Mota-Engil', 'Ferreyros'];

export const RUTAS = {
  ambiental: { nombre: 'Ingeniería ambiental', esp: ['ambiental'], niv: ['pre', 'pro', 'junior', 'supervisor', 'ingeniero'] },
  civil: { nombre: 'Civil, proyectos y minería', esp: ['civil', 'proyectos', 'control', 'costos', 'cierre', 'relaves', 'mineria'], niv: ['junior', 'analista', 'supervisor', 'pleno', 'senior', 'jefe'] },
};

export const ESPJ = {
  ambiental: { nombre: 'Ingeniería ambiental', titulo: 'ingeniero ambiental', area: 'medio ambiente',
    q: { pre: 'practicante preprofesional ingeniería ambiental', pro: 'practicante profesional ingeniería ambiental', junior: 'ingeniero ambiental junior', supervisor: 'supervisor ambiental', ingeniero: 'ingeniero ambiental' },
    sin: ['especialista ambiental', 'analista ambiental', 'supervisor de medio ambiente', 'monitoreo ambiental', 'gestión ambiental', 'asistente ambiental', 'ingeniero SSOMA', 'instrumentos de gestión ambiental'],
    soft: ['ArcGIS o QGIS', 'AutoCAD', 'Excel avanzado', 'Power BI (deseable)'],
    cert: ['Curso de SSOMA o seguridad y salud ocupacional', 'ISO 14001 (auditor interno)', 'ISO 45001 (deseable)'],
    norma: ['Instrumentos de gestión ambiental: EIA, DIA, ITS, PAMA', 'Fiscalización del OEFA, certificación del SENACE', 'ECA y LMP de agua, aire, suelo y ruido'],
    empresas: [...MINERAS.slice(0, 6), 'SGS', 'ERM', 'WSP', 'Anddes'], publico: true },
  civil: { nombre: 'Ingeniería civil', titulo: 'ingeniero civil', area: 'obra',
    q: { junior: 'ingeniero civil junior', analista: 'analista de oficina técnica', supervisor: 'supervisor de obra', pleno: 'ingeniero civil', senior: 'ingeniero residente de obra', jefe: 'jefe de obra' },
    sin: ['ingeniero de campo', 'asistente de residente', 'ingeniero de oficina técnica', 'ingeniero residente', 'ingeniero de producción', 'ingeniero de calidad obras civiles', 'supervisor de obras civiles'],
    soft: ['AutoCAD y Civil 3D', 'S10', 'MS Project', 'Revit o metodología BIM', 'SAP2000 o ETABS (diseño)'],
    cert: ['Curso de SSOMA o SST en construcción', 'BIM (deseable)', 'PMP o CAPM (desde senior, deseable)'],
    norma: ['Reglamento Nacional de Edificaciones', 'Ley de Contrataciones del Estado (obras públicas)', 'Norma G.050 de seguridad en construcción'],
    empresas: [...CONSTR, 'Cesel', 'Ausenco'] },
  proyectos: { nombre: 'Gestión de proyectos', titulo: 'ingeniero de proyectos', area: 'proyectos',
    q: { junior: 'ingeniero de proyectos junior', analista: 'analista de proyectos', supervisor: 'supervisor de proyectos', pleno: 'ingeniero de proyectos', senior: 'ingeniero de proyectos senior', jefe: 'jefe de proyectos' },
    sin: ['project engineer', 'coordinador de proyectos', 'gestor de proyectos', 'project manager', 'PMO', 'especialista en proyectos', 'líder de proyecto'],
    soft: ['MS Project', 'Primavera P6', 'Excel avanzado', 'Power BI'],
    cert: ['PMP (pedido desde senior y jefe)', 'CAPM (junior y analista)', 'Scrum o metodologías ágiles (deseable)'],
    norma: ['Guía del PMBOK', 'Invierte.pe (proyectos públicos)'],
    empresas: [...MINERAS.slice(0, 5), ...CONSULT.slice(0, 5)] },
  control: { nombre: 'Control de proyectos', titulo: 'ingeniero de control de proyectos', area: 'control de proyectos',
    q: { junior: 'ingeniero de control de proyectos junior', analista: 'analista de control de proyectos', supervisor: 'supervisor de control de proyectos', pleno: 'ingeniero de control de proyectos', senior: 'ingeniero de control de proyectos senior', jefe: 'jefe de control de proyectos' },
    sin: ['project controls', 'planner', 'scheduler', 'ingeniero de planeamiento', 'planeamiento y control', 'cost control', 'ingeniero de programación', 'valor ganado'],
    soft: ['Primavera P6', 'MS Project', 'Excel avanzado', 'Power BI', 'SAP (deseable)'],
    cert: ['PMP o PMI-SP', 'AACE: PSP o CCP (deseable en senior)', 'Valor ganado (EVM)'],
    norma: ['Estructura de desglose del trabajo (EDT/WBS)', 'Curva S y control de cambios'],
    empresas: [...MINERAS.slice(0, 5), 'Ausenco', 'Hatch', 'WSP', 'Stantec', 'Cosapi'] },
  costos: { nombre: 'Costos y presupuestos', titulo: 'ingeniero de costos y presupuestos', area: 'costos y presupuestos',
    q: { junior: 'asistente de costos y presupuestos', analista: 'analista de costos', supervisor: 'supervisor de costos y presupuestos', pleno: 'ingeniero de costos y presupuestos', senior: 'ingeniero de costos senior', jefe: 'jefe de costos y presupuestos' },
    sin: ['cost engineer', 'ingeniero de metrados', 'estimador de costos', 'ingeniero de valorizaciones', 'oficina técnica', 'presupuestos de obra', 'control de costos'],
    soft: ['S10 Costos y Presupuestos', 'Excel avanzado', 'AutoCAD', 'Revit para metrados (deseable)', 'MS Project'],
    cert: ['AACE: CCP o CEP (deseable)', 'PMP (deseable en senior y jefe)', 'Curso de S10'],
    norma: ['Análisis de precios unitarios y metrados', 'Valorizaciones, adicionales y liquidación de obra', 'Ley de Contrataciones del Estado (obras públicas)'],
    empresas: [...CONSTR, 'Cesel', 'Ausenco', 'Hatch'] },
  cierre: { nombre: 'Cierre de minas', titulo: 'ingeniero de cierre de minas', area: 'cierre de minas',
    q: { junior: 'ingeniero de cierre de minas junior', analista: 'analista de cierre de minas', supervisor: 'supervisor de cierre de minas', pleno: 'ingeniero de cierre de minas', senior: 'especialista senior en cierre de minas', jefe: 'jefe de cierre de minas' },
    sin: ['plan de cierre', 'pasivos ambientales mineros', 'remediación ambiental', 'closure engineer', 'mine closure', 'cierre progresivo', 'estabilidad física y química'],
    soft: ['AutoCAD y Civil 3D', 'ArcGIS', 'MS Project', 'S10 (presupuesto del plan de cierre)'],
    cert: ['Curso de SSOMA en minería', 'ISO 14001 (deseable)', 'PMP (deseable en senior y jefe)'],
    norma: ['Ley 28090 de cierre de minas y su reglamento', 'Ley 28271 de pasivos ambientales mineros', 'Reglamento de SSO en minería, DS 024-2016-EM'],
    empresas: [...MINERAS, 'Anddes', 'SRK Consulting', 'Knight Piésold', 'WSP'] },
  relaves: { nombre: 'Gobernanza de relaves', titulo: 'ingeniero de relaves', area: 'relaves',
    q: { junior: 'ingeniero geotécnico junior relaves', analista: 'analista de relaves', supervisor: 'supervisor de relaves', pleno: 'ingeniero de relaves', senior: 'ingeniero geotécnico senior relaves', jefe: 'superintendente de relaves' },
    sin: ['depósito de relaves', 'tailings engineer', 'gestión de relaves', 'ingeniero geotécnico', 'RTFE', 'EoR', 'GISTM', 'instrumentación geotécnica'],
    soft: ['Slide o GeoStudio (SLOPE/W)', 'AutoCAD y Civil 3D', 'ArcGIS', 'Excel para instrumentación'],
    cert: ['Conocimiento del Estándar Global de Gestión de Relaves (GISTM)', 'Curso de SSOMA en minería', 'Inglés intermedio o avanzado (frecuente en senior)'],
    norma: ['GISTM (estándar ICMM)', 'Reglamento de SSO en minería, DS 024-2016-EM', 'Normativa de depósitos de relaves del MINEM'],
    empresas: [...MINERAS, 'Anddes', 'Knight Piésold', 'SRK Consulting', 'WSP', 'Golder'] },
  mineria: { nombre: 'Minería y proyectos', titulo: 'ingeniero de proyectos mineros', area: 'proyectos mineros',
    q: { junior: 'ingeniero de minas junior', analista: 'analista de proyectos mineros', supervisor: 'supervisor de proyectos mineros', pleno: 'ingeniero de proyectos mineros', senior: 'ingeniero senior de proyectos mineros', jefe: 'superintendente de proyectos' },
    sin: ['ingeniero de minas', 'planeamiento minero', 'proyectos de capital', 'construcción minera', 'ingeniero de operaciones mina', "owner's team minería", 'superintendente de proyectos'],
    soft: ['MS Project o Primavera P6', 'AutoCAD', 'Deswik, Vulcan o MineSight (planeamiento)', 'Power BI'],
    cert: ['Curso de SSOMA en minería (DS 024-2016-EM)', 'PMP (deseable desde pleno)', 'Licencia de conducir (frecuente en campo)'],
    norma: ['Reglamento de SSO en minería, DS 024-2016-EM', 'Guía del PMBOK para proyectos de capital'],
    empresas: [...MINERAS, 'San Martín Contratistas', 'Ausenco', 'Hatch', 'Cosapi'] },
};

export const NIVJ = {
  pre: { nombre: 'Prácticas preprofesionales', anos: 'Estudiante de los últimos ciclos', fE: '1', palabras: ['practicante', 'prácticas preprofesionales'],
    req: ['Ser estudiante (suelen pedir desde 7.º u 8.º ciclo) y tener convenio con tu universidad.', 'Disponibilidad de horario y, en mina, para trabajar en campo.'] },
  pro: { nombre: 'Prácticas profesionales', anos: 'Egresado o bachiller reciente', fE: '1', palabras: ['practicante profesional', 'prácticas profesionales'],
    req: ['Egresado o bachiller: las prácticas profesionales se hacen dentro de los 12 meses siguientes al egreso.', 'Disponibilidad para campo o viajes según la empresa.'] },
  junior: { nombre: 'Junior', anos: '0 a 2 años', fE: '2', palabras: ['junior', 'asistente', 'trainee'],
    req: ['De 0 a 2 años de experiencia, incluidas prácticas.', 'Bachiller o título en ingeniería.'] },
  analista: { nombre: 'Analista', anos: '1 a 3 años', fE: '2,3', palabras: ['analista'],
    req: ['De 1 a 3 años de experiencia en el área.', 'Excel avanzado y manejo de reportes.'] },
  supervisor: { nombre: 'Supervisor', anos: '3 a 5 años', fE: '3,4', palabras: ['supervisor'],
    req: ['De 3 a 5 años de experiencia, con trabajo en campo.', 'Título profesional; varias empresas piden colegiatura CIP habilitada.', 'Liderar cuadrillas o contratistas y reportar indicadores.'] },
  ingeniero: { nombre: 'Ingeniero', anos: '3 años o más', fE: '3,4', palabras: ['ingeniero', 'especialista'],
    req: ['Título profesional y colegiatura CIP habilitada.', '3 años o más en el área.'] },
  pleno: { nombre: 'Ingeniero pleno', anos: '3 a 6 años', fE: '4', palabras: ['ingeniero', 'especialista', 'pleno'],
    req: ['De 3 a 6 años en el área.', 'Título profesional y colegiatura CIP habilitada.'] },
  senior: { nombre: 'Ingeniero senior', anos: '6 a 10 años', fE: '4', palabras: ['senior', 'especialista senior', 'líder'],
    req: ['De 6 a 10 años, con proyectos completos a cargo.', 'Colegiatura CIP habilitada; a menudo maestría o diplomado afín.', 'Inglés intermedio o avanzado en empresas internacionales.'] },
  jefe: { nombre: 'Jefe', anos: '8 años o más', fE: '5', palabras: ['jefe', 'superintendente', 'gerente'],
    req: ['8 años o más, con equipos a cargo.', 'Colegiatura CIP habilitada y maestría o MBA (frecuente).', 'Manejo de presupuesto, contratos y relación con el cliente o la alta dirección.'] },
};

export const rutaDe = (esp) => (esp === 'ambiental' ? 'ambiental' : 'civil');
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LI = (q, extra = '') => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Per%C3%BA${extra}`;

/** Ajusta especialidad y nivel para que pertenezcan a la ruta. */
export function normalizarSel(sel) {
  const ruta = RUTAS[sel.ruta] ? sel.ruta : 'civil';
  const esp = RUTAS[ruta].esp.includes(sel.esp) ? sel.esp : RUTAS[ruta].esp[0];
  const niv = RUTAS[ruta].niv.includes(sel.niv) ? sel.niv : RUTAS[ruta].niv[2];
  return { ruta, esp, niv };
}

export const busqueda = ({ esp, niv }) => ESPJ[esp].q[niv];

export function booleana({ esp, niv }) {
  const e = ESPJ[esp]; const n = NIVJ[niv];
  const t = [e.titulo, ...e.sin.slice(0, 5)].map((x) => `"${x}"`).join(' OR ');
  const l = n.palabras.map((x) => `"${x}"`).join(' OR ');
  return `(${t}) AND (${l})`;
}

export function bolsas(sel) {
  const q = busqueda(sel); const e = encodeURIComponent(q); const s = slug(q);
  const L = [
    { n: 'LinkedIn', d: 'Filtrado por nivel', u: LI(q, `&f_E=${encodeURIComponent(NIVJ[sel.niv].fE)}`) },
    { n: 'Bumeran', d: 'Palabras clave', u: `https://www.bumeran.com.pe/empleos-busqueda-${s}.html` },
    { n: 'Computrabajo', d: 'Palabras clave', u: `https://pe.computrabajo.com/trabajo-de-${s}` },
    { n: 'Indeed Perú', d: 'Todo el país', u: `https://pe.indeed.com/jobs?q=${e}&l=Per%C3%BA` },
    { n: 'Empleos Perú', d: 'Bolsa pública (copia las palabras)', u: 'https://www.gob.pe/empleosperu', copiar: true },
  ];
  if (ESPJ[sel.esp].publico || sel.esp === 'cierre' || sel.niv === 'pre' || sel.niv === 'pro') {
    L.push({ n: 'Talento Perú', d: 'Estado: OEFA, SENACE, ANA, MINEM', u: 'https://talentoperu.servir.gob.pe/', copiar: true });
  }
  return L;
}

export function sinonimos(sel) {
  const e = ESPJ[sel.esp]; const n = NIVJ[sel.niv];
  return [e.titulo, ...e.sin].map((s) => {
    const q = sel.niv === 'pre' || sel.niv === 'pro' ? `practicante ${s}`
      : s + (n.palabras[0] && !['ingeniero', 'especialista'].includes(n.palabras[0]) && !s.includes(n.palabras[0]) ? ` ${n.palabras[0]}` : '');
    return { q, u: LI(q) };
  });
}

export function requisitosTipicos(sel) {
  const e = ESPJ[sel.esp]; const n = NIVJ[sel.niv];
  return [...n.req, `Software: ${e.soft.join(', ')}.`, ...e.cert.map((c) => `${c}.`)];
}

export const empresas = (sel) => ESPJ[sel.esp].empresas.map((c) => ({ n: c, u: LI(`${c} ${ESPJ[sel.esp].area}`) }));

const limpiar = (t) => String(t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
/** Nombre del archivo: lo que escribas, o la primera línea del aviso, o el puesto. */
export function nombreCv({ esp, niv }, aviso = '', nombre = '') {
  let v = limpiar(nombre);
  if (!v) v = limpiar(String(aviso).split(/\n/).map((l) => l.replace(/^\s*EJEMPLO\s*[—-]\s*/i, '').trim()).filter(Boolean)[0] || '');
  if (!v) v = limpiar(`${NIVJ[niv].nombre} de ${ESPJ[esp].nombre}`);
  return nombreDeArchivo('CV', v);
}

/** Prompt para adaptar el CV a un aviso pegado. Usa las reglas de reglasCv.js (las de la carpeta de postulaciones). */
export function promptAviso(sel, aviso = '', nombre = '') {
  const e = ESPJ[sel.esp]; const n = NIVJ[sel.niv]; const file = nombreCv(sel, aviso, nombre);
  return [
    'Actúa como reclutador técnico y especialista en CV para ingeniería en el Perú. Adjunto mi CV actual. Abajo está la oferta a la que postulo.',
    '',
    `Puesto objetivo: ${e.nombre}, nivel ${n.nombre} (${n.anos}).`,
    '',
    'Haz lo siguiente:',
    '1. Extrae de la oferta las palabras clave: nombre exacto del cargo, funciones, software, certificaciones, normas y competencias. Arma una tabla con tres columnas: palabra clave | ¿está en mi CV? (sí/no) | dónde la incluirás.',
    '2. Adapta mi CV a esta oferta con estas reglas:',
    ...reglasCvTexto(file, '   - '),
    '3. Si falta una cifra para sustentar un logro, escribe [completar: dato que falta] y pregúntamela al final. No la estimes.',
    '4. Para cada brecha, propón una forma concreta de cerrarla (curso, certificación o cómo mencionarla con honestidad).',
    `5. Para este nivel, los avisos suelen pedir: ${n.req.join(' ')} Software frecuente: ${e.soft.join(', ')}. Certificaciones frecuentes: ${e.cert.join('; ')}. Normas: ${e.norma.join('; ')}. Destaca lo que yo sí tenga de esto; lo que falte va a la lista de brechas.`,
    '6. Entrega en este orden: (a) los textos nuevos de perfil, capacidades y herramientas, listos para pegar en mi Word; (b) la tabla de palabras clave; (c) la lista de brechas; (d) las preguntas para completar cifras; (e) tres preguntas probables de entrevista con una idea de respuesta basada solo en mi experiencia real.',
    `7. Si puedes editar mi archivo conservando su formato, entrégame el CV en .docx y en PDF con el nombre «${file}» (${file}.docx y ${file}.pdf).`,
    '',
    'Oferta:',
    '"""',
    String(aviso).trim() || '[Pega aquí el texto completo de la oferta]',
    '"""',
  ].join('\n');
}

export const AVISO_EJEMPLO = 'EJEMPLO — Supervisor de Cierre de Minas\nEmpresa minera · Unidad en Junín · Régimen 14x7\n\nFunciones:\n- Supervisar la ejecución de las actividades del plan de cierre progresivo y las obras de remediación de pasivos ambientales.\n- Controlar avance, costos y calidad de contratistas; elaborar informes semanales y valorizaciones.\n- Coordinar con Medio Ambiente y Seguridad el cumplimiento del plan de cierre aprobado.\n\nRequisitos:\n- Ingeniero ambiental, civil o de minas, colegiado y habilitado.\n- 4 años de experiencia en cierre de minas, remediación o pasivos ambientales.\n- AutoCAD, Civil 3D, MS Project y S10.\n- Conocimiento de la Ley 28090 y su reglamento.\n- Curso SSOMA vigente. Licencia de conducir.\n- Deseable: PMP.';
