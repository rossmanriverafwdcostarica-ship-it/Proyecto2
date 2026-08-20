export function validarTexto(valor, nombreCampo, minimo = 2) {
    const texto = String(valor ?? "").trim();

    if (!texto) {
        return `${nombreCampo} es obligatorio.`;
    }

    if (texto.length < minimo) {
        return `${nombreCampo} debe tener al menos ${minimo} caracteres.`;
    }

    return "";
}

export function validarNumero(valor, nombreCampo, minimo = 0) {
    if (valor === "" || valor === null || valor === undefined) {
        return `${nombreCampo} es obligatorio.`;
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return `${nombreCampo} debe ser un número válido.`;
    }

    if (numero < minimo) {
        return `${nombreCampo} debe ser mayor o igual a ${minimo}.`;
    }

    return "";
}

export function validarSolicitud(datos) {
    const errores = {};

    errores.empresa = validarTexto(datos.empresa, "La empresa");
    errores.sector = validarTexto(datos.sector, "El sector");
    errores.inversionProyectada = validarNumero(datos.inversionProyectada, "La inversión proyectada", 0);
    errores.empleosProyectados = validarNumero(datos.empleosProyectados, "Los empleos proyectados", 0);

    if (datos.zonaFrancaId === "" || datos.zonaFrancaId === null || datos.zonaFrancaId === undefined) {
        errores.zonaFrancaId = "Debe seleccionar una zona franca.";
    } else {
        errores.zonaFrancaId = "";
    }

    return limpiarErrores(errores);
}

export function validarZona(datos) {
    const errores = {};

    errores.nombre = validarTexto(datos.nombre, "El nombre de la zona");
    errores.inversionMinima = validarNumero(datos.inversionMinima, "La inversión mínima", 0);
    errores.empleosMinimos = validarNumero(datos.empleosMinimos, "Los empleos mínimos", 0);

    if (!Array.isArray(datos.sectoresPermitidos) || datos.sectoresPermitidos.length === 0) {
        errores.sectoresPermitidos = "Debe indicar al menos un sector permitido.";
    } else {
        errores.sectoresPermitidos = "";
    }

    return limpiarErrores(errores);
}

function limpiarErrores(errores) {
    return Object.fromEntries(
        Object.entries(errores).filter(([, mensaje]) => Boolean(mensaje))
    );
}

export function tieneErrores(errores) {
    return Object.keys(errores).length > 0;
}
