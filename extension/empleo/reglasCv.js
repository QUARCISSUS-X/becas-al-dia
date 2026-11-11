// Reglas únicas para adaptar el CV. Son las mismas de la carpeta de postulaciones (CLAUDE.md),
// para que el chat de IA y Claude Code den el mismo resultado. Aquí no va ningún dato personal.

/** Nombre que llevan los archivos: sin tildes, para que ningún portal lo rechace. */
export const NOMBRE_EN_ARCHIVO = 'Becquer Melgarejo';
export const nombreDeArchivo = (tipo, destino) => `${tipo}_${NOMBRE_EN_ARCHIVO}_${destino}`;

export const REGLAS_CV = [
  'No inventes. Usa solo lo que está en mi CV: experiencia, cifras, fechas, cursos y certificaciones. Si la oferta pide algo que no cubro (años, carrera, certificación, software), no lo agregues: anótalo como brecha.',
  'No rehagas el formato: conserva el de mi CV. Cambia solo el párrafo de perfil, los 3 puntos de CAPACIDADES y el orden y la selección de HERRAMIENTAS (Avanzado / Intermedio). La experiencia no se toca salvo que yo lo pida.',
  'Largo: 2 páginas. Usa 3 solo si es sector público, una beca o una convocatoria que pide detalle.',
  'Apto para filtros ATS: sin foto, sin tablas ni cuadros de texto. Usa las palabras exactas de la oferta solo cuando describan algo que sí hice.',
  'Cifras con su matiz: una estimación se presenta como estimación, y un curso o una certificación en curso no se presenta como obtenida.',
];

/** Las reglas como viñetas, más la del nombre del archivo. */
export const reglasCvTexto = (archivo, marca = '- ') => [
  ...REGLAS_CV,
  `Nombra el archivo «${archivo}», sin tildes en el nombre.`,
  'Al final, lista las brechas: los requisitos de la oferta que NO cubro, para que yo decida cómo abordarlos.',
].map((r) => marca + r);
