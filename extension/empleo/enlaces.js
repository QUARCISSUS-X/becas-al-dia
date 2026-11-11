// Búsquedas en vivo en las bolsas que la extensión no lee por sí sola.
// LinkedIn e Indeed prohíben la lectura automática y bloquean cuentas: aquí solo se arma el
// enlace con tus términos y los avisos de la última semana; la búsqueda la abres tú.
const enc = encodeURIComponent;
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BOLSAS_EXTERNAS = [
  { n: 'LinkedIn', u: (q) => `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}&location=Per%C3%BA&f_TPR=r604800&sortBy=DD` },
  { n: 'Indeed', u: (q) => `https://pe.indeed.com/jobs?q=${enc(q)}&l=Per%C3%BA&fromage=7&sort=date` },
  { n: 'Google Empleos', u: (q) => `https://www.google.com/search?q=${enc(`${q} empleo Perú`)}&ibp=htl;jobs` },
  { n: 'Bumeran', u: (q) => `https://www.bumeran.com.pe/empleos-busqueda-${slug(q)}.html?recientes=true` },
  { n: 'Computrabajo', u: (q) => `https://pe.computrabajo.com/trabajo-de-${slug(q)}?pubdate=7` },
  { n: 'Laborum', u: (q) => `https://www.laborum.pe/empleos-busqueda-${slug(q)}.html` },
];

/** Enlaces para un término: [{ n, u }] */
export const enlacesExternos = (q) => (String(q || '').trim() ? BOLSAS_EXTERNAS.map((b) => ({ n: b.n, u: b.u(String(q).trim()) })) : []);
