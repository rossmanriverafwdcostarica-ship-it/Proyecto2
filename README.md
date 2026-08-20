# ZoFranca CR — Integrante 1: Solicitudes e IA

Módulo académico encargado del registro de zonas francas, solicitudes de instalación, evaluación simulada mediante IA y decisión final del analista.

## Rama de trabajo

```bash
git switch feacture-rossman
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
- `json-server`
- Backend local: `http://localhost:3001`

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

## Ejecutar el backend

Desde la raíz del proyecto:

```bash
npx json-server --watch db.json --port 3001
```

Si se utiliza una versión reciente de `json-server` que no reconoce `--watch`, se puede ejecutar:

```bash
npx json-server db.json --port 3001
```

El backend debe quedar disponible en:

```text
http://localhost:3001
```

## Ejecutar el frontend

Los ES Modules deben servirse mediante HTTP. No se recomienda abrir los HTML directamente con `file://`.

Una opción sencilla en Visual Studio Code es utilizar Live Server.

También puede utilizarse cualquier servidor HTTP local disponible en el equipo, siempre que no cambie la arquitectura del proyecto.

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

Los documentos seleccionados se guardan como metadatos en el arreglo `documentos`, porque `json-server` trabaja con JSON y no funciona como un servidor de archivos binarios.

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

La información se almacena en `db.json` mediante `json-server`.

Al refrescar el navegador, los datos se vuelven a consultar desde el backend.

### RF-17 — Arquitectura extensible

Las zonas se consultan desde `/zonasFrancas`.

No existe una lista fija de zonas dentro del JavaScript, por lo que pueden agregarse nuevas zonas sin modificar la lógica principal.

## Flujo recomendado de prueba

1. Iniciar `json-server` en el puerto 3001.
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
git push -u origin feacture-rossman

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
compare: feacture-rossman
```

El Integrante 1 debe integrarse primero y el Integrante 2 revisará el Pull Request antes del merge.
## Documento formal de requerimientos

El documento formal de requerimientos de ZoFranca CR se entrega como artefacto documental separado para no alterar la arquitectura acordada del proyecto. Incluye portada, introducción, objetivos, análisis, entrevista simulada, proceso actual, reglas de negocio, glosario, RF-01 a RF-18, RNF-01 a RNF-09, historias de usuario, criterios Dado/Cuando/Entonces, proceso automatizado, evidencia de apoyo con IA, matriz de trazabilidad y hoja de ruta futura.

La validación final permanece pendiente y corresponde al Integrante 2.

