#!/usr/bin/env node
// Recolector de Becas al Día — corre gratis en GitHub Actions, sin IA ni tokens.
// Lee fuentes.json, visita cada fuente, extrae oportunidades y fechas límite,
// compara con la corrida anterior y escribe data/becas.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { fechaLimite } from './lib/fechas.mjs';
import { clasificar, esOportunidad } from './lib/clasificar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = process.env.SALIDA || join(AQUI, '..', 'data', 'becas.json');
const HOY = process.env.HOY ? new Date(process.env.HOY) : new Date();
const HOY_ISO = HOY.toISOString().slice(0, 10);

const MAX_POR_FUENTE = 25;       // enlaces por fuente
const MAX_DETALLES = 12;         // páginas de detalle a abrir por fuente y corrida
const REVERIFICAR_DIAS = 7;      // re-verificar fechas cada semana
const CONSERVAR_NO_VISTAS = 21;  // días que se conserva una beca que ya no aparece
const CONSERVAR_VENCIDAS = 14;   // días que se muestra una beca vencida antes de borrarla

const UA = 'Mozilla/5.0 (compatible; BecasAlDia/1.0; +https://github.com/QUARCISSUS-X/becas-al-dia)';

const idDe = (url) => createHash('sha1').update(url.replace(/[#?].*$/, '').replace(/\/$/, '')).digest('hex').slice(0, 12);
const limpiar = (s = '') => s.replace(/\s+/g, ' ').trim();
const sumarDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Inyectable en pruebas
export let obtener = async function (url) {
  let ultimoError;
  for (let intento = 0; intento < 2; intento++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8' }, signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      ultimoError = e;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  throw ultimoError;
};
export function usarObtener(fn) { obtener = fn; }

function textoPrincipal($) {
  $('script, style, noscript, nav, header, footer, form, iframe, svg').remove();
  return limpiar($('main').text() || $('article').text() || $('body').text());
}

// ---------- Lectores por tipo de fuente ----------

async function leerRss(fuente) {
  const xml = await obtener(fuente.url);
  const $ = cheerio.load(xml, { xmlMode: true });
  const desde = sumarDias(HOY_ISO, -60);
  const items = [];
  $('item, entry').each((_, el) => {
    const $el = $(el);
    const titulo = limpiar($el.find('title').first().text());
    const url = limpiar($el.find('link').first().text()) || $el.find('link').first().attr('href');
    const pub = $el.find('pubDate, published, updated').first().text();
    const publicado = pub ? new Date(pub).toISOString().slice(0, 10) : null;
    const htmlDesc = $el.find('content\\:encoded').text() || $el.find('description, summary, content').first().text();
    const desc = limpiar(cheerio.load(htmlDesc || '').text());
    if (!titulo || !url) return;
    if (publicado && publicado < desde) return;
    items.push({ titulo, url, texto: `${titulo}. ${desc}`, resumen: desc.slice(0, 280), publicado });
  });
  return items.slice(0, MAX_POR_FUENTE);
}

async function leerHtml(fuente) {
  const html = await obtener(fuente.url);
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, header, footer').remove();
  const filtro = new RegExp(fuente.filtro || 'beca|scholarship|convocatoria', 'i');
  const vistos = new Set();
  const items = [];
  $('a[href]').each((_, a) => {
    const $a = $(a);
    const titulo = limpiar($a.text() || $a.attr('title') || '');
    if (titulo.length < 12 || titulo.length > 220) return;
    if (!filtro.test(titulo) && !esOportunidad(titulo)) return;
    let url;
    try { url = new URL($a.attr('href'), fuente.url).href; } catch { return; }
    if (!/^https?:/.test(url) || url === fuente.url || vistos.has(url)) return;
    if (/\.(jpg|png|gif|zip)$/i.test(url) || /(facebook|twitter|x\.com|linkedin|whatsapp|instagram|youtube)\./.test(url)) return;
    vistos.add(url);
    const bloque = limpiar($a.closest('li, article, tr, .card, .views-row, div').first().text()).slice(0, 700);
    items.push({ titulo, url, texto: `${titulo}. ${bloque}`, resumen: bloque === titulo ? '' : bloque.slice(0, 280) });
  });
  return items.slice(0, MAX_POR_FUENTE);
}

async function leerPrograma(fuente) {
  const html = await obtener(fuente.url);
  const texto = textoPrincipal(cheerio.load(html));
  return [{
    titulo: fuente.titulo || fuente.nombre,
    url: fuente.url,
    texto,
    resumen: '',
    detalleLeido: true, // la propia página oficial ya es el detalle
    fijo: { niveles: fuente.nivel ? [fuente.nivel] : null, cobertura: fuente.cobertura || null },
  }];
}

const LECTORES = { rss: leerRss, html: leerHtml, programa: leerPrograma };

// ---------- Proceso principal ----------

async function cargarAnterior() {
  try { return JSON.parse(await readFile(SALIDA, 'utf8')); } catch { return { items: [], salud: [] }; }
}

export async function recolectar({ fuentes, anterior }) {
  const previos = new Map((anterior.items || []).map((i) => [i.id, i]));
  const saludPrev = new Map((anterior.salud || []).map((s) => [s.id, s]));
  const nuevos = new Map();
  const salud = [];

  for (const fuente of fuentes.filter((f) => f.activa !== false)) {
    const lector = LECTORES[fuente.tipo];
    const s = { id: fuente.id, nombre: fuente.nombre, url: fuente.url, ok: false, items: 0, error: null, ultimaOk: saludPrev.get(fuente.id)?.ultimaOk || null };
    try {
      if (!lector) throw new Error(`tipo desconocido: ${fuente.tipo}`);
      const crudos = await lector(fuente);
      let detallesAbiertos = 0;

      for (const c of crudos) {
        const id = idDe(c.url);
        const prev = previos.get(id);
        let { fecha, ultimaPasada } = fechaLimite(c.texto, HOY);
        let verificada = fecha ? HOY_ISO : null;

        // Sin fecha en el listado: abrir la página de detalle (máx. MAX_DETALLES),
        // salvo que se haya verificado hace menos de una semana.
        const reciente = prev?.verificado && prev.verificado >= sumarDias(HOY_ISO, -REVERIFICAR_DIAS);
        if (!fecha && !c.detalleLeido) {
          if (reciente) {
            fecha = prev.fechaLimite; verificada = prev.verificado; ultimaPasada = prev.ultimaPasada || null;
          } else if (detallesAbiertos < MAX_DETALLES) {
            detallesAbiertos++;
            try {
              const det = textoPrincipal(cheerio.load(await obtener(c.url)));
              ({ fecha, ultimaPasada } = fechaLimite(det, HOY));
              c.texto += ' ' + det.slice(0, 3000);
              verificada = HOY_ISO;
            } catch { /* el detalle falló; se queda por confirmar */ }
          }
        }
        if (c.detalleLeido) verificada = HOY_ISO;

        const cls = clasificar(c.titulo, c.texto);
        const item = {
          id,
          titulo: c.titulo,
          url: c.url,
          resumen: c.resumen || '',
          fuente: fuente.id,
          fuenteNombre: fuente.nombre,
          pais: fuente.pais || null,
          idioma: fuente.idioma || null,
          fechaLimite: fecha,
          ultimaPasada,
          verificado: verificada,
          estado: fecha ? 'abierta' : (ultimaPasada && !fecha ? 'cerrada' : 'por-confirmar'),
          niveles: c.fijo?.niveles || cls.niveles,
          areas: cls.areas,
          cobertura: c.fijo?.cobertura || cls.cobertura,
          paraPeru: cls.paraPeru,
          publicado: c.publicado || null,
          primeraVez: prev?.primeraVez || HOY_ISO,
          vistoUltimo: HOY_ISO,
        };
        // Registrar cambios de fecha (lo que antes se revisaba a mano cada semana)
        if (prev?.fechaLimite && fecha && prev.fechaLimite !== fecha) {
          item.cambioFecha = { antes: prev.fechaLimite, ahora: fecha, el: HOY_ISO };
        } else if (prev?.cambioFecha && prev.cambioFecha.el >= sumarDias(HOY_ISO, -14)) {
          item.cambioFecha = prev.cambioFecha;
        }
        nuevos.set(id, item);
      }
      s.ok = true; s.items = crudos.length; s.ultimaOk = HOY_ISO;
      if (crudos.length === 0) s.error = 'La página cargó pero no se encontró ninguna oportunidad (¿cambió su diseño?)';
    } catch (e) {
      s.error = String(e.message || e);
    }
    salud.push(s);
    console.log(`${s.ok ? '✔' : '✖'} ${fuente.nombre}: ${s.items} items${s.error ? ' — ' + s.error : ''}`);
  }

  // Conservar becas de corridas anteriores que hoy no aparecieron (feeds rotan, webs caen)
  for (const [id, p] of previos) {
    if (nuevos.has(id)) continue;
    if (p.vistoUltimo >= sumarDias(HOY_ISO, -CONSERVAR_NO_VISTAS)) nuevos.set(id, p);
  }

  // Actualizar estados con la fecha de hoy y purgar vencidas antiguas
  const items = [];
  for (const it of nuevos.values()) {
    if (it.fechaLimite && it.fechaLimite < HOY_ISO) {
      it.estado = 'vencida';
      if (it.fechaLimite < sumarDias(HOY_ISO, -CONSERVAR_VENCIDAS)) continue;
    }
    items.push(it);
  }
  const orden = { abierta: 0, 'por-confirmar': 1, cerrada: 2, vencida: 3 };
  items.sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999') || b.primeraVez.localeCompare(a.primeraVez));

  return {
    version: 1,
    generado: new Date().toISOString(),
    hoy: HOY_ISO,
    total: items.length,
    abiertas: items.filter((i) => i.estado === 'abierta').length,
    items,
    salud,
  };
}

async function main() {
  const { fuentes } = JSON.parse(await readFile(join(AQUI, 'fuentes.json'), 'utf8'));
  const anterior = await cargarAnterior();
  const datos = await recolectar({ fuentes, anterior });
  await mkdir(dirname(SALIDA), { recursive: true });
  await writeFile(SALIDA, JSON.stringify(datos, null, 1) + '\n');
  const caidas = datos.salud.filter((s) => !s.ok || s.error).length;
  console.log(`\nTotal: ${datos.total} oportunidades (${datos.abiertas} con fecha abierta). Fuentes con problemas: ${caidas}/${datos.salud.length}`);
  // No fallar el workflow si algunas fuentes caen; sí si caen todas.
  if (datos.salud.length && datos.salud.every((s) => !s.ok)) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
