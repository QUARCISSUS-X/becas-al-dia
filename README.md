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
- **Pruebas.** Se ejecutan con `cd collector && npm install && npm test`. Usan webs simuladas, sin internet.

### Cómo se verifican las fechas
- Solo se acepta una fecha si aparece cerca de palabras como «fecha límite», «cierre», «hasta el», «deadline» o «apply by». Si no hay ninguna, la beca queda como **«Fecha por confirmar»**: nunca se inventa una fecha.
- Si el listado no trae fecha, se abre la página de la beca (máximo 12 por fuente y por día). Cada beca se re-verifica al menos una vez por semana.
- Si una fecha cambia respecto al día anterior, la beca muestra la etiqueta **«Fecha cambió»** durante 14 días.
- Las vencidas se muestran atenuadas 14 días y luego se borran.

## Hoja de ruta
- [x] **Fase 1**: recolector y pestaña Becas. Pestaña Empleo con el perfil.
- [ ] **Fase 2**: ofertas de empleo y prácticas (Bumeran, Computrabajo, Talento Perú, carreras de mineras), filtradas por tus perfiles y con % de coincidencia con tu CV.
- [ ] **Fase 3**: autocompletado de formularios portal por portal, registro de postulaciones y botón «Generar prompt para adaptar CV».
