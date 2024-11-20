function procesarMensaje(text) {
    // Regex para precios de 3 o más dígitos (con o sin símbolo $)
    const regexPrecio = /^\$?\b\d{3,}(\.\d+)?\b$/;
    // Regex para detectar cualquier precio en el texto
    const regexCualquierPrecio = /\$?\b\d{3,}(\.\d+)?\b/;

    // Si el texto contiene solo un precio, procesarlo directamente
    if (regexPrecio.test(text.trim())) {
        const precioOriginal = parseFloat(text.trim().replace(/[^0-9.]/g, ""));
        const precioConIncremento = Math.round((precioOriginal * 1.13) / 10) * 10;
        return { isValid: true, text: `$${precioConIncremento}` };
    }

    // Si el texto contiene solo descripción (sin precios), devolverlo tal cual
    if (!regexCualquierPrecio.test(text.trim())) {
        return { isValid: true, text: text.trim() };
    }

    // Regex para identificar precios asociados a "anticipo" o "apartado"
    const regexApartado = /\b(?:apartado|anticipo|anticpo|antcipo|anticp)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para identificar precios asociados a "contado"
    const regexContado = /\b(?:contado|cntado|cntd)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para cualquier texto seguido de un precio válido
    const regexDescripcionYPrecio = /([\w\s.,/áéíóúñ]+?)\s*\$?\b(\d{3,}(\.\d+)?)\b/gi;

    // Limpiar precios asociados a "contado" o "apartado"
    let textoLimpio = text.replace(regexContado, "").replace(regexApartado, "").trim();

    // Procesar descripciones y precios válidos
    const matches = [...textoLimpio.matchAll(regexDescripcionYPrecio)];
    const resultados = matches.map(match => {
        let descripcion = match[1].trim();
        const precioOriginal = parseFloat(match[2].replace(/[^0-9.]/g, ""));

        // Eliminar palabras clave innecesarias de la descripción
        descripcion = descripcion.replace(/\b(?:apartado|anticipo)\b/i, "").trim();

        // Calcular precio con incremento del 13% redondeado al múltiplo de 10
        const precioConIncremento = Math.round((precioOriginal * 1.13) / 10) * 10;
        return { descripcion: descripcion || null, precio: precioConIncremento };
    });

    // Construir mensaje final si hay precios válidos
    if (resultados.length > 0) {
        const partesMensaje = resultados.map(r => {
            const desc = r.descripcion ? `${r.descripcion},` : "";
            return `${desc} precio: $${r.precio}`;
        });

        return { isValid: true, text: partesMensaje.join("; ") };
    }

    // Si no se encontró suficiente información
    return { isValid: false, text };
}

module.exports = procesarMensaje;
