export function clasificar(puntaje) {
    const valor = Number(puntaje);

    if (valor >= 75) {
        return "Recomendada";
    }

    if (valor >= 50) {
        return "Revisar";
    }

    return "Rechazada";
}

export function evaluarConIA(solicitud, zonaFranca) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (!solicitud || !zonaFranca) {
                    throw new Error("La solicitud o la zona franca no están disponibles.");
                }

                const sectorSolicitud = normalizarTexto(solicitud.sector);
                const sectoresPermitidos = Array.isArray(zonaFranca.sectoresPermitidos)
                    ? zonaFranca.sectoresPermitidos.map(normalizarTexto)
                    : [];

                const puntosSector = sectoresPermitidos.includes(sectorSolicitud) ? 40 : 0;

                const inversionProyectada = numeroSeguro(solicitud.inversionProyectada);
                const inversionMinima = numeroSeguro(zonaFranca.inversionMinima);
                const puntosInversion = calcularPuntajeProporcional(inversionProyectada, inversionMinima, 30);

                const empleosProyectados = numeroSeguro(solicitud.empleosProyectados);
                const empleosMinimos = numeroSeguro(zonaFranca.empleosMinimos);
                const puntosEmpleos = calcularPuntajeProporcional(empleosProyectados, empleosMinimos, 30);

                const puntaje = Math.max(
                    0,
                    Math.min(100, Math.round(puntosSector + puntosInversion + puntosEmpleos))
                );

                const justificacion = construirJustificacion({
                    puntosSector,
                    puntosInversion,
                    puntosEmpleos,
                    sectorPermitido: puntosSector === 40,
                    inversionProyectada,
                    inversionMinima,
                    empleosProyectados,
                    empleosMinimos
                });

                resolve({
                    empresa: solicitud.empresa,
                    puntaje,
                    justificacion
                });
            } catch (error) {
                reject(error);
            }
        }, 450);
    });
}

function calcularPuntajeProporcional(valor, minimo, maximoPuntos) {
    if (minimo <= 0) {
        return valor >= 0 ? maximoPuntos : 0;
    }

    const proporcion = valor / minimo;
    const puntos = proporcion * maximoPuntos;

    return Math.max(0, Math.min(maximoPuntos, puntos));
}

function construirJustificacion(datos) {
    const sector = datos.sectorPermitido
        ? "Sector permitido: cumple el criterio y obtiene 40/40 puntos."
        : "Sector permitido: no coincide con los sectores de la zona y obtiene 0/40 puntos.";

    const inversion = `Inversión: ${Math.round(datos.puntosInversion)}/30 puntos. Proyectada: ${datos.inversionProyectada}; mínimo de la zona: ${datos.inversionMinima}.`;

    const empleos = `Empleos: ${Math.round(datos.puntosEmpleos)}/30 puntos. Proyectados: ${datos.empleosProyectados}; mínimo de la zona: ${datos.empleosMinimos}.`;

    return `${sector}\n${inversion}\n${empleos}`;
}

function normalizarTexto(valor) {
    return String(valor ?? "").trim().toLowerCase();
}

function numeroSeguro(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : 0;
}
