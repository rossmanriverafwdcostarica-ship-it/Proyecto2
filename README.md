# ZoFranca CR — Integrante 1: Solicitudes e IA

Módulo académico encargado del registro de zonas francas, solicitudes de instalación, evaluación simulada mediante IA y decisión final del analista.

## Rama de trabajo

```bash
git switch feature-rossman
git status
```

No desarrollar directamente sobre `main`.

## Tecnologías

- HTML5
- CSS3
- JavaScript vanilla
- ES Modules
- `fetch`
- `Promise`
- `async/await`
- `Promise.all`
- `try/catch/finally`
- Node.js
- Node.js con persistencia en `db.json` y contrato REST de las colecciones del laboratorio
- Servidor integrado: `http://localhost:3001`

No se utiliza ningún framework.

## Archivos del Integrante 1

```text
index.html
db.json
README.md
.gitignore
assets/css/base.css
assets/css/solicitudes.css
js/config/config.js
js/utils/ui.js
js/utils/validators.js
js/services/solicitudesService.js
js/services/iaService.js
js/modules/solicitudes.js
js/modules/detalleSolicitud.js
pages/solicitud.html
pages/solicitudes.html
pages/detalle-solicitud.html
```

Los archivos de cumplimiento, alertas, historial y dashboard pertenecen al Integrante 2 y no se modifican en esta rama.

## Estructura esperada después de integrar ambas ramas

```text
Proyecto2/
├── index.html
├── db.json
├── README.md
├── .gitignore
├── pages/
│   ├── solicitud.html
│   ├── solicitudes.html
│   ├── detalle-solicitud.html
│   ├── reporte-cumplimiento.html
│   ├── alertas.html
│   ├── historial.html
│   └── dashboard.html
├── assets/
│   ├── css/
│   │   ├── base.css
│   │   ├── solicitudes.css
│   │   ├── cumplimiento.css
│   │   └── dashboard.css
│   └── img/
└── js/
    ├── config/
    │   └── config.js
    ├── services/
    │   ├── solicitudesService.js
    │   ├── iaService.js
    │   ├── empresasService.js
    │   └── reportesService.js
    ├── modules/
    │   ├── solicitudes.js
    │   ├── detalleSolicitud.js
    │   ├── cumplimiento.js
    │   ├── alertas.js
    │   ├── historial.js
    │   └── dashboard.js
    └── utils/
        ├── ui.js
        └── validators.js
```

## Ejecutar la aplicación integrada

La entrega integrada usa un único servidor Node (`server.js`) para servir la interfaz, los archivos estáticos y la API REST respaldada por `db.json`. De esta forma no es necesario abrir Live Server ni levantar un segundo proceso para navegar la aplicación.

Desde la raíz del proyecto:

```bash
npm start
```

Abrir únicamente:

```text
http://localhost:3001
```

El servidor conserva las cinco colecciones y endpoints REST acordados para el laboratorio y agrega rutas auxiliares para las funciones integradas de autenticación, roles, soporte, auditoría, papelera, exportación y seguimiento.

Para desarrollo también está disponible:

```bash
npm run dev
```

> Si el puerto 3001 ya está ocupado, cierre el proceso anterior antes de ejecutar `npm start`.

## Endpoints acordados

```text
GET/POST      /zonasFrancas
GET/POST/PATCH /solicitudes
GET/POST      /empresas
GET/POST      /reportesCumplimiento
GET/POST      /decisiones
```

Este módulo utiliza principalmente:

- `/zonasFrancas`
- `/solicitudes`
- `/decisiones`

Las colecciones `/empresas` y `/reportesCumplimiento` se dejan disponibles en `db.json` para la integración con el Integrante 2.

## RF implementados

### RF-01 — Registrar zona franca con criterios mínimos

En `pages/solicitud.html` existe un formulario para registrar:

- Nombre
- Inversión mínima
- Empleos mínimos
- Sectores permitidos

Los sectores se introducen separados por comas y se almacenan como arreglo.

Los valores incluidos inicialmente en `db.json` son datos de demostración académica. No representan montos oficiales ni legislación de PROCOMER.

### RF-02 — Registrar/enviar solicitud

El formulario utiliza exactamente estas propiedades:

```text
empresa
sector
inversionProyectada
empleosProyectados
documentos
zonaFrancaId
estado
puntajeIA
justificacionIA
clasificacionIA
decisionFinal
analista
fechaSolicitud
```

Los documentos seleccionados se guardan como metadatos en el arreglo `documentos`, porque el backend académico persiste JSON y no funciona como un repositorio de archivos binarios.

### RF-03 — Guardar y consultar solicitudes asíncronamente

Las solicitudes se crean y consultan con `fetch`, `async/await` y manejo de errores.

### RF-04 — Evaluación simulada con IA

La función `evaluarConIA()` retorna una `Promise` y produce:

```javascript
{
    empresa,
    puntaje,
    justificacion
}
```

### RF-05 — Clasificación

- `>= 75`: `Recomendada`
- `>= 50`: `Revisar`
- `< 50`: `Rechazada`

### Regla de puntuación 40/30/30

La evaluación utiliza:

- Sector permitido: máximo 40 puntos.
- Inversión: máximo 30 puntos.
- Empleos: máximo 30 puntos.

Para inversión y empleo se asigna el puntaje proporcional al criterio mínimo de la zona hasta alcanzar el máximo.

Ejemplo:

```text
inversionProyectada / inversionMinima × 30
```

El resultado nunca supera 30 puntos en esa categoría.

La puntuación final se limita entre 0 y 100.

### RF-10 — Indicadores de carga

Los botones de acciones asíncronas cambian su estado, se deshabilitan durante el proceso y se muestran mensajes de carga.

### RF-11 — Manejo de errores

Las operaciones de red utilizan:

```text
try
catch
finally
```

Los mensajes visibles para el usuario son simples y no técnicos.

El detalle técnico se envía con:

```javascript
console.error(...)
```

### RF-12 — Decisión humana

La pantalla de detalle permite:

- Confirmar la recomendación de la IA.
- Cambiar la decisión.
- Rechazar la recomendación.
- Registrar analista.
- Registrar observación.
- Guardar fecha y decisión en `/decisiones`.

La actualización de la solicitud solo modifica la decisión final, el analista y el estado. No se sobrescriben:

```text
puntajeIA
justificacionIA
clasificacionIA
```

### RF-13 — Promise.all

El botón **Evaluar pendientes** consulta las solicitudes pendientes y realiza las evaluaciones en paralelo mediante `Promise.all`.

Las actualizaciones de los resultados también se ejecutan en paralelo mediante un segundo `Promise.all`.

### RF-15 — Filtros

El listado permite filtrar por:

- Estado
- Zona franca
- Sector
- Fecha

### RF-16 — Persistencia

La información se almacena persistentemente en `db.json` mediante el servidor Node integrado.

Al refrescar el navegador, los datos se vuelven a consultar desde el backend.

### RF-17 — Arquitectura extensible

Las zonas se consultan desde `/zonasFrancas`.

No existe una lista fija de zonas dentro del JavaScript, por lo que pueden agregarse nuevas zonas sin modificar la lógica principal.

## Flujo recomendado de prueba

1. Ejecutar `npm start` desde la raíz del proyecto para iniciar el servidor Node en el puerto 3001.
2. Abrir `pages/solicitud.html`.
3. Crear una nueva zona franca.
4. Registrar una solicitud.
5. Abrir `pages/solicitudes.html`.
6. Confirmar que la solicitud aparece.
7. Utilizar los filtros.
8. Presionar **Evaluar pendientes**.
9. Confirmar que aparece puntaje, justificación y clasificación.
10. Abrir el detalle de una solicitud evaluada.
11. Ingresar el nombre del analista.
12. Confirmar, cambiar o rechazar la sugerencia.
13. Refrescar el navegador.
14. Confirmar que los datos permanecen almacenados.

## Commits sugeridos

```bash
git add .
git commit -m "feat: implement request form and persistence"
git push -u origin feature-rossman

git add .
git commit -m "feat: add AI scoring and classification"
git push

git add .
git commit -m "feat: add analyst final decision"
git push
```

Cuando la rama esté completa, abrir un Pull Request con:

```text
base: main
compare: feature-rossman
```

El Integrante 1 debe integrarse primero y el Integrante 2 revisará el Pull Request antes del merge.
## Documento formal de requerimientos

El documento formal de requerimientos de ZoFranca CR se entrega como artefacto documental separado para no alterar la arquitectura acordada del proyecto. Incluye portada, introducción, objetivos, análisis, entrevista simulada, proceso actual, reglas de negocio, glosario, RF-01 a RF-18, RNF-01 a RNF-09, historias de usuario, criterios Dado/Cuando/Entonces, proceso automatizado, evidencia de apoyo con IA, matriz de trazabilidad y hoja de ruta futura.

La validación final permanece pendiente y corresponde al Integrante 2.


## Servidor Node integrado

La entrega incluye `server.js`, que sirve **la interfaz y las cinco colecciones del backend desde el mismo proceso Node.js**. No requiere Express ni dependencias externas.

### Iniciar en Windows

Desde PowerShell, dentro de `Proyecto2`:

```powershell
npm start
```

También puede ejecutarse `INICIAR_ZOFRANCA.bat` con doble clic.

Luego abra:

```text
http://localhost:3001
```

El servidor redirige automáticamente al Dashboard.

Para comprobar que el backend está activo:

```text
http://localhost:3001/health
```

Endpoints disponibles:

```text
/zonasFrancas
/solicitudes
/empresas
/reportesCumplimiento
/decisiones
```

### Flujo conectado

1. Abra **Solicitudes** y pulse **Evaluar pendientes**.
2. Entre al detalle de una solicitud evaluada.
3. Si el analista registra la decisión `Recomendada`, el sistema crea o reactiva automáticamente su registro en `/empresas`.
4. La empresa aparece en **Cumplimiento**.
5. Al registrar el reporte, se compara contra `empleosProyectados` e `inversionProyectada` de la solicitud original.
6. Si existe incumplimiento, el reporte se guarda con `estado: "con alerta"` y sus alertas aparecen en **Alertas**.
7. **Historial** reconstruye solicitud + IA + decisión + reportes.
8. **Dashboard** consolida la información de las cuatro colecciones relacionadas.

`db.json` continúa siendo la fuente persistente de datos del proyecto.


## Ejecución unificada

La versión actual funciona como una sola aplicación web servida por Node.js. No se necesita Live Server ni un segundo proceso de json-server.

```bash
npm start
```

Abrir únicamente:

```text
http://localhost:3001
```

Dashboard, Solicitudes, Nueva Solicitud, Detalle, Cumplimiento, Alertas e Historial cambian dentro del mismo `index.html`. Los endpoints `/solicitudes`, `/empresas`, `/reportesCumplimiento`, `/decisiones` y `/zonasFrancas` son rutas internas de la API del mismo servidor y no son páginas que el usuario deba abrir.

## Integración de funciones avanzadas de NovaAdmin CR

Esta versión incorpora al dominio de **ZoFranca CR** las funciones reutilizables del proyecto NovaAdmin CR sin convertir la aplicación en una tienda y sin reemplazar el diseño verde estilo Stitch.

### Funciones incorporadas

- Inicio de sesión con contraseña SHA-256.
- Sesión por token y roles **Administrador**, **Analista** y **Empresa**.
- Registro público de una cuenta Empresa con estado **Pendiente**.
- Aprobación y rechazo administrativo con motivo, revisor y fecha.
- Perfil global desde la tarjeta superior: datos personales, foto comprimida y cambio de contraseña.
- Tema claro/oscuro opcional; el tema claro mantiene el diseño original.
- Sonidos locales para clic, éxito, advertencia y error.
- Búsqueda global con debounce para solicitudes, empresas y zonas.
- Paginación automática del listado cuando supera 10 registros.
- Centro ZoFranca CR desde **Soporte Técnico** con:
  - Asistente IA contextual basado en reglas y datos reales del servidor.
  - CRUD de usuarios.
  - Edición y administración de zonas francas.
  - Administración de empresas.
  - Tickets de soporte.
  - Papelera con restauración y eliminación definitiva.
  - Actividad/auditoría.
  - Exportación JSON y CSV.
  - Vista imprimible / Guardar como PDF.
  - Respaldo administrativo.
  - Conversión de inversión CRC/USD mediante la referencia BCCR disponible vía Frankfurter.
- Integridad referencial: una zona, solicitud o empresa con relaciones dependientes no se elimina de forma insegura.
- Código de seguimiento automático `ZF-AAAA-00000` para las solicitudes.
- Línea de seguimiento del expediente actualizada con cambios de estado y decisiones.
- Microanimaciones para acciones y compatibilidad con `prefers-reduced-motion`.
- Set separado de **205 registros sintéticos** en `data/datos_prueba_205_zofranca.json`.

### Adaptación de funciones específicas de la tienda

Las funciones de NovaAdmin que pertenecían al dominio comercial se trasladaron a equivalentes útiles para ZoFranca CR:

| NovaAdmin CR | ZoFranca CR |
|---|---|
| Clientes / Proveedores / roles | Administrador / Analista / Empresa |
| Solicitud de proveedor | Solicitud de acceso de Empresa |
| CRUD de proveedores | Administración de empresas instaladas |
| CRUD de productos | Administración de zonas y criterios |
| Garantías / tickets | Tickets de soporte |
| Rastreo de paquetes | Seguimiento del expediente |
| Comprobante / PDF | Reporte imprimible de solicitudes |
| Papelera | Papelera de zonas, solicitudes, empresas y usuarios |
| Asistente NovaAI | Asistente contextual ZoFranca |
| Conversión CRC/USD | Conversión de inversión proyectada |
| Historial de compras | Auditoría e historial de solicitudes y cumplimiento |

No se añadieron conceptos de tienda como carrito o compra dentro de la interfaz principal, porque no corresponden al dominio de zonas francas; su funcionalidad de selección/procesamiento en lote ya está cubierta por `Promise.all` para solicitudes.

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@zofranca.cr` | `Admin123*` |
| Analista | `analista@zofranca.cr` | `Analista123*` |
| Empresa | `empresa@demo.cr` | `Empresa123*` |

## Ejecutar esta versión

```powershell
npm start
```

Abrir únicamente:

```text
http://localhost:3001
```

El frontend, API, autenticación, archivos estáticos y persistencia en `db.json` se sirven desde el mismo proceso Node.



## Integración pública — Ministerio de Hacienda

La aplicación mantiene un único punto de entrada en `index.html`, ubicado en la raíz del proyecto. La carpeta `pages/` conserva vistas auxiliares/legadas, pero el servidor Node entrega la SPA principal desde `http://localhost:3001`.

Se agregó el módulo **Hacienda CR**, consumido a través del servidor Node para evitar llamadas duplicadas desde el navegador y aplicar caché temporal. Incluye:

- Consulta de contribuyente (`/fe/ae`).
- Tipo de cambio del dólar y euro (`/indicadores/tc`, `/dolar`, `/euro`).
- Histórico del dólar (`/indicadores/tc/dolar/historico`).
- Consulta de exoneraciones (`/fe/ex`).
- Registros agropecuarios (`/fe/agropecuario`).
- Registros de pesca/acuicultura (`/fe/pesca`).
- Catálogo CABYS (`/fe/cabys`).

Las consultas externas no se guardan como datos oficiales del expediente. Se muestran como información pública de apoyo y respetan la separación entre la evaluación académica y la decisión humana.

### Administración de empresas

El Administrador dispone de dos acciones distintas desde **Centro ZoFranca CR → Empresas**:

- **Papelera**: eliminación reversible cuando las reglas de integridad lo permiten.
- **Eliminar BD**: eliminación definitiva de la empresa y sus reportes de cumplimiento. La solicitud y la decisión asociadas se conservan para trazabilidad histórica.

### Tema

El botón de tema en la barra superior alterna entre modo claro y oscuro y guarda la preferencia en el perfil del usuario.

## Modularidad y buenas prácticas JavaScript

El código se reorganizó con ES Modules (`import` / `export`) para que cada archivo tenga una responsabilidad clara y pueda mantenerse sin modificar módulos no relacionados.

Estructura principal agregada:

```text
js/
├── core/
│   ├── dom.js            # Selectores y escape de HTML
│   ├── feedback.js       # Loading, mensajes y toast
│   ├── formatters.js     # Fechas, números, moneda y badges
│   ├── httpClient.js     # fetch, res.ok, token y errores de red
│   ├── reports.js        # Orden y selección del último reporte
│   ├── sound.js          # Sonidos de interacción
│   ├── state.js          # Estado compartido de la SPA
│   └── theme.js          # Modo claro / oscuro
├── features/
│   ├── hacienda.js       # Integración visual con Hacienda
│   ├── interactions.js   # Animaciones y sonidos de acciones
│   └── search.js         # Búsqueda global y paginación
├── services/             # Servicios académicos originales
├── modules/              # Módulos funcionales originales
├── app.js                # Coordinador principal de ZoFranca
└── enhancements.js       # Coordinador de funciones extendidas
```

El servidor también separa configuración, persistencia, autenticación, reglas de negocio e integración con Hacienda:

```text
server/
├── core/
│   ├── auth.js
│   ├── config.js
│   ├── database.js
│   ├── http.js
│   └── utils.js
├── domain/
│   └── business.js
└── integrations/
    └── hacienda.js
```

Buenas prácticas aplicadas:

- Una responsabilidad principal por módulo.
- Named exports para utilidades y `export default` para el cliente HTTP principal.
- Nombres descriptivos y consistentes.
- `fetch` centralizado con validación de `response.ok`.
- `throw` para propagar errores de red/HTTP hacia el módulo que debe manejarlos.
- `try/catch/finally` en operaciones que pueden fallar y en estados de carga.
- `Promise.all` para consultas que pueden ejecutarse en paralelo.
- Mensajes comprensibles al usuario y `console.error` para el detalle técnico.
- Escape de HTML centralizado para reducir riesgos al renderizar datos dinámicos.
- Persistencia serializada de `db.json` para reducir conflictos en escrituras simultáneas.
- Script de comprobación de sintaxis antes de hacer commit.

Validar JavaScript:

```powershell
npm run check
```
