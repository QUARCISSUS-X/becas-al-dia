# Becas al Día

Extensión de navegador (Chrome / Edge) con dos pestañas:

- **🎓 Becas**: becas y convocatorias con fecha límite, días restantes, filtros (nivel, país, área, financiamiento completo, Perú/LatAm), favoritas y avisos de cierre (7, 3, 1 y 0 días).
- **💼 Empleo y prácticas**: perfil para la postulación semiautomática. La búsqueda de ofertas llega en la Fase 2 y el autocompletado en la Fase 3. Siempre eres tú quien da clic en «Postular».

**No usa IA ni tokens.** Un recolector gratuito corre cada mañana en GitHub Actions. Lee las webs oficiales, extrae las fechas con reglas fijas, compara con el día anterior y publica `data/becas.json`. La extensión solo descarga ese archivo.

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
1. Abre `chrome://extensions` (o `edge://extensions`).
2. Activa **Modo de desarrollador**.
3. Haz clic en **Cargar descomprimida** y elige la carpeta `extension/`.
4. Haz clic en el ícono 🎓 para abrir el panel lateral.

Si usas otro nombre de repo o de cuenta, cámbialo en ⚙ **Ajustes** dentro del panel.

## Mantenimiento

- **Una fuente falla.** En el panel, abre «Estado de las fuentes». Si una aparece con ✖ varios días, su web cambió. Corrige su `url` o su `filtro` en `collector/fuentes.json`, o desactívala con `"activa": false`.
- **Agregar una fuente.** Añade un bloque a `collector/fuentes.json` con uno de estos tipos:
  - `rss`: un feed.
  - `html`: una página con una lista de enlaces.
  - `programa`: una beca recurrente con su página oficial.
- **Pruebas.** Se ejecutan con `cd collector && npm install && npm test`. Cubren el recolector y la búsqueda de empleo, y usan webs simuladas, sin internet.

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

   Debajo verás ✔ lo que coincide y ✖ lo que falta.
4. **📋 Prompt para CV** copia un prompt que puedes pegar en cualquier chat de IA. El prompt incluye la oferta, el análisis y tu CV. Pide adaptar el CV sin inventar nada y nombrar el archivo `CV_Bécquer Melgarejo_<empresa>`.

Si un portal cambia su web, en «Estado de los portales» aparecerá ⚠ o ✖. Los lectores de cada portal están en `extension/empleo/portales.js`.

### Cómo se verifican las fechas
- Solo se acepta una fecha si aparece cerca de palabras como «fecha límite», «cierre», «hasta el», «deadline» o «apply by». Si no hay ninguna, la beca queda como **«Fecha por confirmar»**: nunca se inventa una fecha.
- Si el listado no trae fecha, se abre la página de la beca (máximo 12 por fuente y por día). Cada beca se re-verifica al menos una vez por semana.
- Si una fecha cambia respecto al día anterior, la beca muestra la etiqueta **«Fecha cambió»** durante 14 días.
- Las vencidas se muestran atenuadas 14 días y luego se borran.

## Hoja de ruta
- [x] **Fase 1**: recolector y pestaña Becas. Pestaña Empleo con el perfil.
- [x] **Fase 2**: ofertas de empleo y prácticas de Bumeran, Computrabajo y Talento Perú, filtradas por tus perfiles. Cada oferta tiene su % de coincidencia con tu CV, etiqueta «Minera» y el prompt para adaptar el CV.
- [ ] **Fase 2b**: portales de carrera de las mineras (Antamina, Southern, Cerro Verde, Las Bambas…).
- [ ] **Fase 3**: autocompletado de formularios portal por portal y registro de postulaciones.
