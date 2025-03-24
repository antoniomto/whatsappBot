function procesarMensaje(text) {
    // Regex para precios de 3 o más dígitos (con o sin símbolo $)
    const regexPrecio = /\$?\b\d{3,}(\.\d+)?\b/g;
    // Regex para identificar precios asociados a "anticipo" o "apartado"
    const regexApartado = /\b(?:apartado|anticipo|anricpo|anticpo|antcipo|anticp)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para identificar precios asociados a "contado"
    const regexContado = /\b(?:contado|cntado|cntd)\s+\$?\d{3,}(\.\d+)?\b/gi;
    // Regex para cualquier texto seguido de un precio válido
    const regexDescripcionYPrecio = /([\w\s.,/áéíóúñ]*?)\s*\$?\b(\d{3,}(\.\d+)?)\b/g;

    // Limpiar precios asociados a "contado" o "apartado"
    text = text.replace(",","");
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

        let incremento = 1.20;
        if (precioOriginal >= 100 && precioOriginal <= 500) {
            incremento = 1.20; // Agregar 15%
        }if (precioOriginal >= 100 && precioOriginal <= 1000) {
            incremento = 1.20; // Agregar 15%
        } else if (precioOriginal > 1000 && precioOriginal <= 2000) {
            incremento = 1.15; // Agregar 13%
        } else if (precioOriginal > 2000 && precioOriginal <= 5000) {
            incremento = 1.12; // Agregar 10%
        } else if (precioOriginal > 5000) {
            incremento = 1.10; // Agregar 8%
        }

        // Calcular precio con incremento
        let precioConIncremento = Math.round((precioOriginal * incremento) / 10) * 10;
        
        // Asegurar que la ganancia sea de al menos $100
        if (precioConIncremento - precioOriginal < 100) {
            precioConIncremento = precioOriginal + 100;
        }

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
