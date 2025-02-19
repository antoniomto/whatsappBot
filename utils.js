function procesarMensaje(text) {
    // Regex para precios de 3 o más dígitos (con o sin símbolo $)
    const regexPrecio = /\$?\b\d{3,}(\.\d+)?\b/g;
    // Regex para identificar precios asociados a "anticipo" o "apartado"
    const regexApartado = /\b(?:apartado|anticipo|anticpo|antcipo|anticp)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para identificar precios asociados a "contado"
    const regexContado = /\b(?:contado|cntado|cntd)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para cualquier texto seguido de un precio válido
    const regexDescripcionYPrecio = /([\w\s.,/áéíóúñ]*?)\s*\$?\b(\d{3,}(\.\d+)?)\b/g;

    // Limpiar precios asociados a "contado" o "apartado"
    let textoLimpio = text.replace(regexContado, "").replace(regexApartado, "").trim();
    textoLimpio = textoLimpio.replace(/costo|costó|Costo|Costó/g, "").trim();

    // Procesar descripciones y precios válidos
    const matches = [...textoLimpio.matchAll(regexDescripcionYPrecio)];
    const resultados = matches.map(match => {
        let descripcion = match[1].trim();
        const precioOriginal = parseFloat(match[2].replace(/[^0-9.]/g, ""));

        // Si no hay descripción, solo el precio
        if (!descripcion) {
            descripcion = null;
        }

        let incremento = 1.13;
        if (precioOriginal >= 100 && precioOriginal <= 1000) {
            incremento = 1.15; // Agregar 15%
        } else if (precioOriginal > 1000 && precioOriginal <= 2000) {
            incremento = 1.13; // Agregar 13%
        } else if (precioOriginal > 2000 && precioOriginal <= 5000) {
            incremento = 1.10; // Agregar 10%
        } else if (precioOriginal > 5000) {
            incremento = 1.08; // Agregar 8%
        }
        // Calcular precio con incremento del 13% redondeado al múltiplo de 10
        const precioConIncremento = Math.round((precioOriginal * incremento) / 10) * 10;
        return { descripcion, precio: precioConIncremento };
    });

    // Si no hay precios válidos
    if (resultados.length === 0) {
        return { isValid: false, text };
    }

    // Construir mensaje final si hay precios válidos
    const partesMensaje = resultados.map(r => {
        if (r.descripcion) {
            return `${r.descripcion} precio: $${r.precio}`;
        } else {
            return `$${r.precio}`;
        }
    });

    return { isValid: true, text: partesMensaje.join("; ") };
}

module.exports = procesarMensaje;
