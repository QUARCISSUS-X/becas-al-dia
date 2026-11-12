# Becas al Día

Extensión de navegador (Chrome / Edge) con dos pestañas:

- **🎓 Becas**: becas y convocatorias con fecha límite, días restantes, filtros (nivel, país, área, financiamiento completo, Perú/LatAm), favoritas y avisos de cierre (7, 3, 1 y 0 días).
- **💼 Empleo y prácticas**: busca ofertas en tres portales, calcula el % de coincidencia con tu CV y lleva el registro de tus postulaciones. El autocompletado llega en la Fase 3. Siempre eres tú quien da clic en «Postular».

**Funciona completa sin IA ni tokens.** Conectar tu propia IA (Gemini, Claude, ChatGPT u otra) es opcional y solo añade redacción y una segunda opinión. Un recolector gratuito corre cada mañana en GitHub Actions. Lee las webs oficiales, extrae las fechas con reglas fijas, compara con el día anterior y publica `data/becas.json`. La extensión solo descarga ese archivo.

```
GitHub Actions (6:17 a. m. Lima)          Tu navegador
┌──────────────────────────────┐          ┌──────────────────────┐
│ collector/collect.mjs        │  JSON    │ extensión            │
│  · lee fuentes.json          │ ───────▶ │  · revisa cada 6 h   │
│  · extrae fechas límite      │          │  · número en el ícono│
│  · detecta cambios de fecha  │          │  · avisos de cierre  │
│  · escribe data/becas.json   │          └──────────────────────┘
└──────────────────────────────┘
```

## Novedades de la v4.2

- **4.2.1**: Cerro Verde vuelve a cargar en Firefox (su portal redirigía a `http://` y Firefox bloqueaba el salto).

- **⛏ Mis mineras**: en cada búsqueda se leen todas las vacantes del portal de empleo oficial de Antamina, Minsur, Alpayana, Poderosa y Cerro Verde. MARSA no tiene un portal vigente, así que sus avisos se buscan en Bumeran. Eliges las mineras en **👤 Mi perfil y CV → Mineras de interés**. La primera vez que pulses «Buscar ofertas», el navegador te pedirá permiso para esos sitios.

  | Minera | Portal | Plataforma |
  |---|---|---|
  | Antamina | mastalento.antamina.com | SAP SuccessFactors |
  | Minsur | oportunidades-laborales.com/minsur | SAP SuccessFactors |
  | Alpayana | abrilhr.pe (Site Laboral) | Abril HR |
  | Poderosa | minerapoderosa.hiringroom.com | HiringRoom |
  | Cerro Verde | cerroverde.hiringroom.com | HiringRoom |
  | MARSA | Bumeran (por nombre de empresa) | — |

  Sus ofertas llevan la etiqueta «⛏ Mis mineras», tienen su propio filtro y aparecen en «Estado de los portales». Los lectores están en `extension/empleo/mineras.js`.
- **Buscar también en LinkedIn, Indeed y otras bolsas**: debajo de «Buscar ofertas», enlaces con tus términos de búsqueda a LinkedIn, Indeed, Google Empleos, Bumeran, Computrabajo y Laborum, filtrados a la última semana cuando la bolsa lo permite. LinkedIn e Indeed prohíben la lectura automática y bloquean cuentas, así que la extensión solo arma el enlace: la búsqueda la abres tú.

## Novedades de la v4.1

- **⬇ Enviar a Claude Code**: cada oferta tiene un botón que la descarga como `oferta_<id>.json` en `Descargas/becas-al-dia/`. El archivo lleva el aviso completo y el análisis de coincidencia, y nunca tu CV ni tu perfil. Sirve para preparar la postulación en una carpeta privada de Claude Code con el comando `/postular`. Por eso la extensión pide el permiso de **descargas**.
- **Mismas reglas en todos los prompts de CV**: «📋 Prompt» y «Prompt de CV» usan una sola lista (`extension/empleo/reglasCv.js`): no inventar, cambiar solo perfil, capacidades y herramientas, 2 páginas (3 para sector público o becas), formato apto para ATS y lista de brechas al final.
- **Nombre de archivo sin tildes**: `CV_Becquer Melgarejo_<empresa>`, para que ningún portal lo rechace.

Formato del archivo de oferta (versión 1):

```json
{
  "version": 1,
  "id": "bm-1234567",
  "titulo": "Ingeniero de Costos y Presupuestos",
  "empresa": "Empresa S.A.",
  "ubicacion": "Lima",
  "fuente": "Bumeran",
  "url": "https://…",
  "descripcion": "texto completo del aviso",
  "coincidencia": { "pct": 72, "coinciden": [], "faltan": [], "faltanDeseables": [] },
  "exportado": "2026-11-11T14:00:00.000Z"
}
```

El `id` empieza con `bm-` (Bumeran), `ct-` (Computrabajo) o `sv-` (Talento Perú).

## Novedades de la v4.0

- **🎓 Oportunidades**: las becas, eventos y cursos que Claude verifica cada lunes en la página «Becas al Día», con su ficha completa. Cada ficha trae requisitos, beneficios, documentos, fechas clave, fuentes y enlaces para ver ganadores en LinkedIn. La pestaña tiene:
  - el sello «Verificado»;
  - la línea de tiempo de los próximos 6 meses;
  - estados abierta, próxima y cerrada;
  - filtros por tipo, especialidad y nivel;
  - favoritas con aviso antes del cierre;
  - el registro de cambios.
- **📡 Radar**: lo que el recolector encuentra cada mañana en 11 fuentes oficiales (la pestaña Becas de antes).
- **💼 Empleo** tiene tres secciones:
  - **Ofertas para ti**: el % de coincidencia de siempre.
  - **Rutas de búsqueda**: búsquedas en vivo en cada bolsa, sinónimos, búsqueda booleana, requisitos típicos, normas, empresas para seguir y ofertas verificadas.
  - **Prompt de CV**: pegas un aviso y copias el prompt.
- **IA opcional para revisar las oportunidades** (⚙ Ajustes → «Actualizar becas, eventos y cursos con IA»):
  - **📋 Copiar prompt para cualquier IA**: ChatGPT, Gemini, Claude, Copilot o Perplexity con búsqueda web hacen la misma revisión que Claude. Si tu IA tiene tareas programadas, el prompt le pide repetirla con la frecuencia que elijas. Pegas su respuesta en «Importar respuesta».
  - **✨ Actualizar ahora con mi IA**: si conectaste Gemini, Claude o ChatGPT, la extensión hace la revisión por sí sola, con búsqueda web, ahora o con la frecuencia elegida.
  - La extensión muestra siempre los datos más recientes: los de Claude o los de tu IA. «Volver a los datos de Claude» descarta tu revisión.

### De dónde salen los datos

| Archivo | Quién lo actualiza | Cuándo |
|---|---|---|
| `data/curado.json` | La revisión semanal de Claude (copia los datos de la página con `scripts/extraer-curado.mjs`) | Cada lunes |
| `data/becas.json` | El recolector de GitHub Actions | Cada mañana |

## Instalación (una sola vez, ~10 min)

### 1. Crear el repositorio
1. En GitHub, crea un repositorio **público** llamado `becas-al-dia` en la cuenta `QUARCISSUS-X`. Tiene que ser público para que la extensión pueda leer el JSON sin iniciar sesión. Solo contiene becas, nunca tus datos personales.
2. Sube **todo** el contenido de esta carpeta, incluida la carpeta oculta `.github`. Con Git sería:
   ```bash
   git init && git add . && git commit -m "Becas al Día v0.1"
   git branch -M main
   git remote add origin https://github.com/QUARCISSUS-X/becas-al-dia.git
   git push -u origin main
   ```

### 2. Recolector
Corre solo: la primera vez al subir el código y luego todos los días a las 6:17 a. m. También puedes lanzarlo a mano desde **Actions → Recolectar becas → Run workflow**.

### 3. Instalar la extensión

Descarga el archivo de tu navegador desde **[Releases](../../releases/latest)**.

**Chrome / Edge**
1. Descarga `becas-al-dia-chrome-X.Y.Z.zip` y descomprímelo (o usa la carpeta `extension/` del repo).
2. Abre `chrome://extensions` (o `edge://extensions`) y activa **Modo de desarrollador**.
3. Haz clic en **Cargar descomprimida** y elige la carpeta.
4. Haz clic en el ícono 🎓 para abrir el panel lateral.

**Firefox** (128 o posterior)

Firefox solo instala de forma permanente extensiones firmadas por Mozilla.
- **Si el release dice «firmado por Mozilla»**: descarga `becas-al-dia-firefox-X.Y.Z.xpi`, ábrelo con Firefox → **Añadir**.
- **Si no está firmado**:
  - *Prueba rápida*: `about:debugging#/runtime/this-firefox` → **Cargar complemento temporal…** → elige el `.xpi`. Se quita al cerrar Firefox.
  - *Permanente*: en Firefox Developer Edition o Nightly, `about:config` → `xpinstall.signatures.required` = `false`, y arrastra el `.xpi` a la ventana.

En Firefox la extensión se abre en la **barra lateral**: clic en el ícono 🎓 o `Ctrl+B` → Becas al Día.

**Para que los releases salgan firmados (una sola vez):**
1. Entra a [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/) con una cuenta de Firefox y genera tus credenciales.
2. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Crea `AMO_JWT_ISSUER` (el «emisor JWT») y `AMO_JWT_SECRET` (el «secreto JWT»).
3. Desde entonces, cada release trae el `.xpi` firmado. La firma es «no listada»: la extensión no aparece en la tienda de Firefox, solo la instala quien tenga el archivo.

**Publicar una versión nueva:** sube el número en `extension/manifest.json`, haz commit y crea la etiqueta: `git tag v0.3.2 && git push --tags`. El flujo *Publicar extensión* prueba, empaqueta y crea el release. También puedes correrlo a mano desde la pestaña **Actions**.

Si usas otro nombre de repo o de cuenta, cámbialo en ⚙ **Ajustes** dentro del panel.

## Mantenimiento

- **Una fuente falla.** En el panel, abre «Estado de las fuentes». Si una aparece con ✖ varios días, su web cambió. Corrige su `url` o su `filtro` en `collector/fuentes.json`, o desactívala con `"activa": false`.
- **Agregar una fuente.** Añade un bloque a `collector/fuentes.json` con uno de estos tipos:
  - `rss`: un feed.
  - `html`: una página con una lista de enlaces.
  - `programa`: una beca recurrente con su página oficial.
- **Pruebas.** Se ejecutan con `cd collector && npm install && npm test`. Cubren el recolector, la búsqueda de empleo y los portales de las mineras, y usan webs simuladas, sin internet.

## Pestaña Empleo y prácticas (Fase 2)

La búsqueda de empleo **corre en tu navegador**, no en GitHub: Computrabajo y Bumeran bloquean a los servidores, pero ven la extensión como una visita normal. No usa IA ni gasta tokens.

1. Abre **👤 Mi perfil y CV**. Completa estos datos:
   - tu profesión;
   - tus años de experiencia;
   - los perfiles que buscas (ambiental, civil, costos y presupuestos, cierre de minas, relaves, minería, prácticas…);
   - el texto de tu CV: ábrelo, pulsa Ctrl+A y Ctrl+C, y pégalo;
   - palabras clave extra.

   Luego pulsa **Guardar perfil**. Todo queda solo en tu navegador.
2. Pulsa **Buscar ofertas**. La extensión consulta tres portales:
   - **Computrabajo**: lee la descripción completa de las ofertas más afines (bloque `JobPosting`);
   - **Bumeran**: usa su API, que ya incluye la descripción;
   - **Talento Perú (SERVIR)**: revisa empleos y prácticas del sector público.

   La búsqueda se repite sola cuando abres la pestaña y la última tiene más de 6 h.
3. Cada oferta muestra su **% de coincidencia** con tu CV:

   | Factor | Peso |
   |---|---|
   | Habilidades y software que pide la oferta y aparecen en tu CV | 45 % |
   | Profesión | 20 % |
   | Perfil buscado | 20 % |
   | Años de experiencia | 15 % |

   El % tiene dos límites:
   - si la oferta pide otra carrera, el máximo es 35 %;
   - si la oferta no detalla requisitos, el máximo es 70 %.

   Debajo verás ✔ lo que coincide, ✖ lo indispensable que falta y ○ lo deseable que falta.

   Detalles del cálculo:
   - **Indispensable vs. deseable.** Lo que la oferta pide como «deseable», «de preferencia» o «no excluyente» pesa un tercio. Lo que aparece en «Beneficios» o «Sobre nosotros» no cuenta como requisito.
   - **Aprende de ti.** Cuando ya guardaste, postulaste u ocultaste al menos 3 ofertas, las parecidas (por palabras del puesto y por empresa) suben o bajan hasta 8 puntos.
   - **Sin repetidas.** La misma oferta publicada en dos portales se muestra una vez, con el enlace «También en».
4. **📋 Prompt para CV** copia un prompt que puedes pegar en cualquier chat de IA. El prompt incluye la oferta, el análisis y tu CV. Pide adaptar el CV sin inventar nada y nombrar el archivo `CV_Becquer Melgarejo_<empresa>`.

5. **Registro de postulaciones.** En cada oferta, el desplegable «Sin postular» pasa a «Postulé», «Entrevista», «Me ofrecieron» o «No avanzó». El filtro **Postuladas** las reúne aunque el portal ya las haya retirado, y en «Estado de los portales» puedes descargarlas para Excel.

### IA opcional (✨)

En ⚙ **Ajustes → Inteligencia artificial** eliges un proveedor y pegas tu clave:

| Proveedor | Costo | Dónde sale la clave |
|---|---|---|
| Google Gemini | Tiene nivel gratuito | aistudio.google.com/apikey |
| Claude (Anthropic) | De pago | console.anthropic.com |
| ChatGPT (OpenAI) | De pago | platform.openai.com/api-keys |
| Otro compatible con OpenAI | Groq y OpenRouter tienen modelos gratuitos; Ollama corre en tu PC | según el servicio |
| IA local de Chrome | Gratis, sin clave; pide una PC potente | — |

Pulsa **Probar y listar modelos**: la extensión comprueba la clave y elige un modelo económico (puedes cambiarlo). Luego **Guardar**.

Con la IA conectada, el botón **✨ IA** de cada oferta ofrece:
- **Analizar afinidad**: segunda opinión del %, requisito por requisito, con la evidencia de tu CV. Queda como etiqueta «IA %».
- **Carta de presentación** y **Adaptar mi CV**: se descargan como Word con el nombre `CV_Becquer Melgarejo_<empresa>`. La IA tiene prohibido inventar experiencia.
- **Responder** una pregunta del formulario de postulación.

«✨ Analizar con IA las 10 primeras» lo hace en lote, una consulta cada 4,5 s.

En **Funciones activas** (dentro de Ajustes) marcas solo las que quieras usar; las desmarcadas desaparecen del panel. Si las desmarcas todas, el botón ✨ IA se oculta.

Privacidad: la clave se guarda solo en tu navegador (sin cifrar, como cualquier dato de extensión). Tu CV y la oferta viajan directo al proveedor que elegiste, y solo cuando pulsas un botón ✨. El código está en `extension/ia/`.

Si un portal cambia su web, en «Estado de los portales» aparecerá ⚠ o ✖. Los lectores de cada portal están en `extension/empleo/portales.js`.

### Cómo se verifican las fechas
- Solo se acepta una fecha si aparece cerca de palabras como «fecha límite», «cierre», «hasta el», «deadline» o «apply by». Si no hay ninguna, la beca queda como **«Fecha por confirmar»**: nunca se inventa una fecha.
- Si el listado no trae fecha, se abre la página de la beca (máximo 12 por fuente y por día). Cada beca se re-verifica al menos una vez por semana.
- Si una fecha cambia respecto al día anterior, la beca muestra la etiqueta **«Fecha cambió»** durante 14 días.
- Las vencidas se muestran atenuadas 14 días y luego se borran.

## Hoja de ruta
- [x] **Fase 1**: recolector y pestaña Becas. Pestaña Empleo con el perfil.
- [x] **Fase 2**: ofertas de empleo y prácticas de Bumeran, Computrabajo y Talento Perú, filtradas por tus perfiles. Cada oferta tiene su % de coincidencia con tu CV, etiqueta «Minera» y el prompt para adaptar el CV.
- [x] **v0.3**: requisitos indispensables vs. deseables, aprendizaje de tus decisiones, ofertas repetidas unidas, registro de postulaciones e IA opcional con tu propia clave.
- [x] **v4.0**: oportunidades verificadas por Claude, rutas de empleo, prompt de CV y revisión con cualquier IA.
- [x] **v4.1**: botón «Enviar a Claude Code» (oferta en JSON), reglas únicas para los prompts de CV y nombre de archivo sin tildes.
- [x] **v4.2 (Fase 2b)**: portales de empleo de Antamina, Minsur, Alpayana, Poderosa, Cerro Verde y MARSA (vía Bumeran), y enlaces a LinkedIn, Indeed y otras bolsas.
- [ ] **Fase 3**: autocompletado de formularios portal por portal y registro de postulaciones.
