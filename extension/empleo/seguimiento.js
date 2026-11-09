// Registro de postulaciones: en qué estado está cada oferta a la que postulaste.
// Se guarda una copia de los datos de la oferta para que siga visible aunque el portal la retire.

export const ESTADOS = {
  postulada: 'Postulé',
  entrevista: 'Entrevista',
  oferta: 'Me ofrecieron',
  rechazada: 'No avanzó',
};

/** Crea o actualiza el registro de una oferta. estado '' lo elimina. */
export function marcar(seguimiento, oferta, estado, hoy = new Date()) {
  const s = { ...seguimiento };
  if (!estado) { delete s[oferta.id]; return s; }
  const previo = s[oferta.id];
  const fecha = hoy.toISOString().slice(0, 10);
  s[oferta.id] = {
    estado,
    desde: previo?.desde || fecha,   // día en que postulaste
    cambio: fecha,                   // último cambio de estado
    nota: previo?.nota || '',
    titulo: oferta.titulo, empresa: oferta.empresa, fuente: oferta.fuente, url: oferta.url, ubicacion: oferta.ubicacion || '',
  };
  return s;
}

const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
/** CSV que abre Excel (separador ; y BOM para las tildes). */
export function aCsv(seguimiento) {
  const filas = Object.values(seguimiento).sort((a, b) => (b.desde || '').localeCompare(a.desde || ''));
  const cab = ['Postulé el', 'Estado', 'Último cambio', 'Puesto', 'Empresa', 'Lugar', 'Portal', 'Enlace', 'Nota'];
  return '\ufeff' + [cab, ...filas.map((f) => [f.desde, ESTADOS[f.estado] || f.estado, f.cambio, f.titulo, f.empresa, f.ubicacion, f.fuente, f.url, f.nota])]
    .map((r) => r.map(celda).join(';')).join('\r\n');
}
