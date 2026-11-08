// Clasificación por palabras clave (sin IA).
const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const NIVELES = {
  pregrado: ['pregrado', 'undergraduate', 'bachelor', 'licenciatura', 'carrera universitaria', 'beca 18'],
  maestria: ['maestria', 'master', 'msc', 'mba', 'posgrado', 'postgrado', 'postgraduate', 'magister'],
  doctorado: ['doctorado', 'phd', 'doctoral', 'doctorate'],
  posdoc: ['posdoc', 'postdoc', 'post-doc', 'posdoctoral', 'postdoctoral'],
  curso: ['curso', 'course', 'diplomado', 'short course', 'certificado', 'certificate', 'mooc', 'bootcamp', 'summer school', 'escuela de verano'],
  investigacion: ['investigacion', 'research', 'estancia', 'pasantia', 'fellowship', 'internship'],
};

const AREAS = {
  ingenieria: ['ingenieria', 'engineering', 'stem', 'tecnologia', 'technology'],
  ambiental: ['ambiental', 'environment', 'sostenib', 'sustainab', 'clima', 'climate', 'agua', 'water'],
  civil: ['civil', 'construccion', 'construction', 'infraestructura', 'infrastructure', 'estructur'],
  mineria: ['mineria', 'minero', 'mining', 'relave', 'tailings', 'cierre de minas', 'mine closure', 'geolog'],
  gestion: ['gestion de proyectos', 'project management', 'costos', 'presupuesto', 'business', 'administracion', 'mba'],
};

const COBERTURA = {
  completa: ['fully funded', 'totalmente financiada', 'beca integral', 'beca completa', 'full scholarship', 'cubre todos'],
  parcial: ['partial', 'parcial', 'descuento', 'tuition waiver', 'reduccion'],
};

function coincide(texto, mapa) {
  return Object.entries(mapa).filter(([, claves]) => claves.some((k) => texto.includes(k))).map(([k]) => k);
}

export function clasificar(titulo, descripcion = '') {
  const t = quitarTildes(`${titulo} ${descripcion}`);
  const cobertura = coincide(t, COBERTURA);
  return {
    niveles: coincide(t, NIVELES),
    areas: coincide(t, AREAS),
    cobertura: cobertura.includes('completa') ? 'completa' : cobertura[0] || null,
    // Útil para Perú: si el texto menciona a Perú/Latinoamérica explícitamente
    paraPeru: /\b(peru|peruan|latinoameric|latin america|america latina|developing countr|paises en desarrollo)/.test(t),
  };
}

// ¿Parece una beca/oportunidad y no una noticia cualquiera?
export function esOportunidad(titulo) {
  const t = quitarTildes(titulo);
  return /(beca|scholarship|fellowship|convocatoria|grant|funding|financiad|postula|apply|stipend|award|curso gratuito|free course|pasantia|internship)/.test(t);
}
