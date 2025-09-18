function procesarMensaje(text) {
    if (!text || text.trim().length === 0) {
        return { isValid: false, text };
    }

    // Paso 1: Limpieza inicial básica
    text = text.replace(/,/g, "").trim();

    // Paso 2: Limpieza de patrones problemáticos ANTES de evaluar
    let textoLimpio = text
        .replace(/modelo\s+\d+/gi, "") // Eliminar "modelo 1060"
        .replace(/talla\s+\d+/gi, "") // Eliminar "talla 42"
        .replace(/\d+\s*(?:ml|cm|mm|onzas?|kg|gr|litros?)/gi, "") // Eliminar medidas "750ml", "30 onzas"
        .replace(/referencia\s+\d+/gi, "") // Eliminar "referencia 123"
        .replace(/código\s+\d+/gi, "") // Eliminar "código 456"
        .replace(/ref\s+\d+/gi, "") // Eliminar "ref 789"
        // NUEVO: Eliminar precios de anticipo/contado/adelantado
        .replace(/(?:anticipo|apartado|contado|adelantado|anricpo|anticpo|anticpo|antiicpo|anticp)\s+\$?\d+/gi, "")
        .replace(/\s+/g, " ") // Normalizar espacios
        .trim();

    // Paso 3: Buscar números de 3+ dígitos en texto limpio (candidatos a precio)
    const numerosTresDigitos = textoLimpio.match(/\b\d{3,}\b/g) || [];

    // Paso 4: Validar según cantidad de números encontrados
    if (numerosTresDigitos.length === 0) {
        return { isValid: false, text }; // Sin precios válidos → revisión
    }

    if (numerosTresDigitos.length > 1) {
        return { isValid: false, text }; // Múltiples precios → revisión
    }

    // Paso 5: Validar rango del único precio encontrado
    const precioOriginal = parseInt(numerosTresDigitos[0]);
    if (precioOriginal < 100 || precioOriginal > 50000) {
        return { isValid: false, text }; // Fuera de rango → revisión
    }

    // Paso 6: Aplicar márgenes (tu lógica original)
    let incremento = 1.20;
    if (precioOriginal >= 100 && precioOriginal <= 1000) {
        incremento = 1.20; // 20%
    } else if (precioOriginal > 1000 && precioOriginal <= 2000) {
        incremento = 1.15; // 15%
    } else if (precioOriginal > 2000 && precioOriginal <= 5000) {
        incremento = 1.12; // 12%
    } else if (precioOriginal > 5000) {
        incremento = 1.10; // 10%
    }

    // Calcular precio con incremento
    let precioConIncremento = Math.round((precioOriginal * incremento) / 10) * 10;
    
    // Asegurar que la ganancia sea de al menos $100
    if (precioConIncremento - precioOriginal < 100) {
        precioConIncremento = precioOriginal + 100;
    }

    // Paso 7: Generar descripción limpia para el mensaje final
    const descripcionLimpia = textoLimpio
        .replace(/\$?\d{3,}/g, "") // Eliminar números de precio
        .replace(/precio\s*:?\s*/gi, "") // Eliminar palabra "precio"
        .replace(/costo\s*:?\s*/gi, "") // Eliminar palabra "costo"
        .replace(/vale\s*/gi, "") // Eliminar "vale"
        .replace(/\s+/g, " ") // Normalizar espacios
        .trim();

    // Construir mensaje final
    const mensajeFinal = descripcionLimpia 
        ? `${descripcionLimpia} precio: $${precioConIncremento}` 
        : `$${precioConIncremento}`;

    return { 
        isValid: true, 
        text: mensajeFinal 
    };
}

module.exports = procesarMensaje;