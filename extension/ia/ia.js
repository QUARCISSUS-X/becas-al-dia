// Conexión OPCIONAL a un modelo de IA con la clave del propio usuario.
// La extensión funciona completa sin esto. La clave se guarda solo en este navegador y las
// llamadas van directo del navegador al proveedor elegido (no pasan por ningún servidor nuestro).
// Dependencia inyectable para probar en Node: { fetch }.

export const PROVEEDORES = {
  gemini: {
    nombre: 'Google Gemini', costo: 'tiene nivel gratuito',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    claveEn: 'https://aistudio.google.com/apikey',
    preferidos: [/flash-latest$/, /flash-lite-latest$/, /flash(?!.*(image|tts|live|audio|preview|exp))/, /flash/],
  },
  claude: {
    nombre: 'Claude (Anthropic)', costo: 'de pago',
    base: 'https://api.anthropic.com/v1',
    claveEn: 'https://console.anthropic.com/settings/keys',
    preferidos: [/haiku/, /sonnet/],
  },
  openai: {
    nombre: 'ChatGPT (OpenAI)', costo: 'de pago',
    base: 'https://api.openai.com/v1',
    claveEn: 'https://platform.openai.com/api-keys',
    preferidos: [/^gpt-[\d.]+-(luna|mini|nano)$/, /^gpt-.*(luna|mini|nano)/, /^gpt-/],
  },
  compatible: {
    nombre: 'Otro (compatible con OpenAI)', costo: 'Groq y OpenRouter tienen modelos gratuitos; Ollama corre en tu PC',
    base: '', // la escribe el usuario: https://api.groq.com/openai/v1 · https://openrouter.ai/api/v1 · http://localhost:11434/v1
    preferidos: [/:free$/, /llama|gemma|qwen|mistral/],
  },
  local: {
    nombre: 'IA local de Chrome (Gemini Nano)', costo: 'gratis, sin clave; requiere PC potente',
    base: '', preferidos: [],
  },
};

// Funciones que el usuario puede activar o desactivar. Por defecto todas activas.
export const FUNCIONES = {
  analisis: 'Analizar afinidad',
  lote: 'Analizar en lote',
  carta: 'Carta de presentación',
  cv: 'Adaptar mi CV',
  pregunta: 'Responder preguntas del formulario',
};
export const funcionActiva = (cfg, f) => cfg?.funciones?.[f] !== false;
export const algunaActiva = (cfg) => Object.keys(FUNCIONES).some((f) => funcionActiva(cfg, f));

export const configurada = (cfg) => !!cfg?.proveedor && PROVEEDORES[cfg.proveedor]
  && (cfg.proveedor === 'local' || ((cfg.clave || cfg.proveedor === 'compatible') && (cfg.proveedor !== 'compatible' || cfg.base)));

export function baseDe(cfg) {
  return String(cfg.proveedor === 'compatible' ? cfg.base || '' : PROVEEDORES[cfg.proveedor].base).replace(/\/+$/, '');
}
/** Origen que la extensión debe tener permitido para llamar al proveedor (null = no hace falta). */
export function origenDe(cfg) {
  if (!cfg?.proveedor || cfg.proveedor === 'local') return null;
  try { const u = new URL(baseDe(cfg)); return `${u.protocol}//${u.hostname}/*`; } catch { return null; }
}

class ErrorIA extends Error {}
function explicar(status, cuerpo = '') {
  const detalle = (() => { try { const j = JSON.parse(cuerpo); return j.error?.message || j.message || ''; } catch { return ''; } })().slice(0, 180);
  const base = status === 401 || status === 403 ? 'La clave no es válida o no tiene permiso'
    : status === 429 ? 'Límite de uso alcanzado: espera un minuto, cambia de modelo o revisa tu saldo'
    : status === 404 ? 'El modelo no existe para esta clave: pulsa «Probar y listar modelos»'
    : status === 400 ? 'El proveedor rechazó la solicitud'
    : status >= 500 ? 'El proveedor tiene problemas en este momento: reintenta luego'
    : `Error HTTP ${status}`;
  return new ErrorIA(detalle ? `${base} (${detalle})` : base);
}
async function pedir(dep, url, opciones) {
  let r;
  try { r = await dep.fetch(url, { credentials: 'omit', ...opciones }); } catch (e) { throw new ErrorIA(`No se pudo conectar con el proveedor (${e.message || e})`); }
  const cuerpo = await r.text();
  if (!r.ok) throw explicar(r.status, cuerpo);
  try { return JSON.parse(cuerpo); } catch { throw new ErrorIA('El proveedor respondió algo que no es JSON'); }
}

function cabeceras(cfg) {
  if (cfg.proveedor === 'gemini') return { 'x-goog-api-key': cfg.clave };
  if (cfg.proveedor === 'claude') return { 'x-api-key': cfg.clave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  return cfg.clave ? { authorization: `Bearer ${cfg.clave}` } : {};
}

/** Modelos de texto disponibles para la clave. */
export async function listarModelos(cfg, dep) {
  if (cfg.proveedor === 'local') return ['gemini-nano'];
  const j = await pedir(dep, `${baseDe(cfg)}/models${cfg.proveedor === 'gemini' ? '?pageSize=200' : cfg.proveedor === 'claude' ? '?limit=100' : ''}`, { headers: cabeceras(cfg) });
  let ids;
  if (cfg.proveedor === 'gemini') {
    ids = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
      .filter((id) => /^gemini/.test(id) && !/embedding|image|tts|audio|live|robotics|computer-use/.test(id));
  } else {
    ids = (j.data || []).map((m) => m.id).filter((id) => cfg.proveedor !== 'openai' || (/^(gpt|o\d|chatgpt)/.test(id) && !/audio|realtime|image|tts|transcribe|search|embedding|moderation|codex|instruct/.test(id)));
  }
  return [...new Set(ids)].sort();
}

/** Elige un modelo económico de la lista según el proveedor. */
export function elegirModelo(proveedor, ids = []) {
  for (const re of PROVEEDORES[proveedor]?.preferidos || []) {
    const c = ids.filter((id) => re.test(id));
    if (c.length) return c.sort().at(-1); // el más reciente por nombre
  }
  return ids[0] || '';
}

/**
 * Genera texto. @param {{sistema?:string, mensaje:string, json?:boolean, maxTokens?:number}} p
 * @returns {Promise<string>}
 */
export async function generar(cfg, p, dep) {
  if (!configurada(cfg)) throw new ErrorIA('La IA no está configurada: abre ⚙ Ajustes');
  const max = p.maxTokens || 1500;
  if (cfg.proveedor === 'local') return generarLocal(p, dep);
  if (!cfg.modelo) throw new ErrorIA('Falta elegir el modelo: abre ⚙ Ajustes y pulsa «Probar y listar modelos»');
  const base = baseDe(cfg);
  const cab = { 'content-type': 'application/json', ...cabeceras(cfg) };
  // Los modelos que «razonan» gastan parte del presupuesto de salida antes de escribir: se deja margen
  const conMargen = max * 2 + 2000;

  if (cfg.proveedor === 'gemini') {
    const j = await pedir(dep, `${base}/models/${encodeURIComponent(cfg.modelo)}:generateContent`, {
      method: 'POST', headers: cab,
      body: JSON.stringify({
        ...(p.sistema ? { systemInstruction: { parts: [{ text: p.sistema }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: p.mensaje }] }],
        generationConfig: { maxOutputTokens: conMargen, ...(p.json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    const c = j.candidates?.[0];
    const txt = (c?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('').trim();
    if (!txt) throw new ErrorIA(`Gemini no devolvió texto (${c?.finishReason || j.promptFeedback?.blockReason || 'respuesta vacía'})`);
    return txt;
  }
  if (cfg.proveedor === 'claude') {
    const j = await pedir(dep, `${base}/messages`, {
      method: 'POST', headers: cab,
      body: JSON.stringify({ model: cfg.modelo, max_tokens: max, ...(p.sistema ? { system: p.sistema } : {}), messages: [{ role: 'user', content: p.mensaje }] }),
    });
    const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!txt) throw new ErrorIA(`Claude no devolvió texto (${j.stop_reason || 'respuesta vacía'})`);
    return txt;
  }
  // OpenAI y compatibles (Chat Completions)
  const oficial = cfg.proveedor === 'openai';
  const j = await pedir(dep, `${base}/chat/completions`, {
    method: 'POST', headers: cab,
    body: JSON.stringify({
      model: cfg.modelo,
      messages: [...(p.sistema ? [{ role: 'system', content: p.sistema }] : []), { role: 'user', content: p.mensaje }],
      ...(oficial ? { max_completion_tokens: conMargen } : { max_tokens: max }),
      ...(oficial && p.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const txt = String(j.choices?.[0]?.message?.content || '').trim();
  if (!txt) throw new ErrorIA(`El modelo no devolvió texto (${j.choices?.[0]?.finish_reason || 'respuesta vacía'})`);
  return txt;
}

async function generarLocal(p, dep) {
  const LM = dep.LanguageModel ?? globalThis.LanguageModel;
  if (!LM) throw new ErrorIA('Este navegador no trae la IA local (requiere Chrome 138 o posterior en PC)');
  const opciones = { expectedInputs: [{ type: 'text', languages: ['es'] }], expectedOutputs: [{ type: 'text', languages: ['es'] }] };
  const disp = await LM.availability(opciones);
  if (disp === 'unavailable') throw new ErrorIA('Tu equipo no cumple los requisitos de la IA local de Chrome (22 GB libres y GPU con más de 4 GB, o 16 GB de RAM)');
  const sesion = await LM.create({ ...opciones, ...(p.sistema ? { initialPrompts: [{ role: 'system', content: p.sistema }] } : {}) });
  try { return String(await sesion.prompt(p.mensaje)).trim(); } finally { sesion.destroy?.(); }
}

/** Prueba mínima de la configuración. Devuelve { ok, modelos, modelo, error }. */
export async function probar(cfg, dep) {
  try {
    const modelos = await listarModelos(cfg, dep);
    const modelo = cfg.modelo && (modelos.includes(cfg.modelo) || !modelos.length) ? cfg.modelo : elegirModelo(cfg.proveedor, modelos);
    const eco = await generar({ ...cfg, modelo }, { mensaje: 'Responde solo con la palabra: listo', maxTokens: 20 }, dep);
    return { ok: true, modelos, modelo, eco };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
