const { getLastAliasOfDay, getSheetCode } = require('./sheets.js');

// Contadores en memoria para alias
const aliasCounters = {
    'A': 0,
    'V': 0,
    'F': 0
};

// Mapeo de nombres de grupos a claves de proveedor
const proveedorMap = {
    'Ventas usa clouthes andys': 'A',
    'Proveedor Fake': 'F',
    'Mayoristas VIP 2': 'V'
};

// Inicializar contadores desde Sheets al arrancar
async function initializeCounters() {
    for (const [proveedor, clave] of Object.entries(proveedorMap)) {
        try {
            const lastAlias = await getLastAliasOfDay(clave);
            aliasCounters[clave] = lastAlias;
            console.log(`Contador ${clave} inicializado en: ${lastAlias}`);
        } catch (error) {
            console.warn(`Error inicializando contador ${clave}, usando 0`);
            aliasCounters[clave] = 0;
        }
    }
}

// Generar ID largo único
function generateLongId(proveedorClave) {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-1);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    const millisecond = now.getMilliseconds().toString().padStart(3, '0');
    
    return `${proveedorClave}${year}${month}${day}${hour}${minute}${second}${millisecond}`;
}

// Generar alias con código de hoja
async function generateAlias(proveedorClave) {
    try {
        // Obtener código de hoja actual
        const sheetCode = await getSheetCode();
        
        // Incrementar contador
        aliasCounters[proveedorClave] = (aliasCounters[proveedorClave] || 0) + 1;
        const numero = aliasCounters[proveedorClave].toString().padStart(3, '0');
        
        // Formato: [Proveedor][CódigoHoja][Secuencial]
        return `${proveedorClave}${sheetCode}${numero}`;
    } catch (error) {
        console.error('Error generando alias:', error);
        // Fallback sin código de hoja
        aliasCounters[proveedorClave] = (aliasCounters[proveedorClave] || 0) + 1;
        const numero = aliasCounters[proveedorClave].toString().padStart(3, '0');
        return `${proveedorClave}P1${numero}`;
    }
}

// Obtener clave de proveedor por nombre de grupo
function getProveedorClave(groupName) {
    for (const [nombreGrupo, clave] of Object.entries(proveedorMap)) {
        if (groupName.includes(nombreGrupo)) {
            return clave;
        }
    }
    return null;
}

async function procesarMensaje(text, shouldGenerateCode = false, groupName = '') {
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

    // Paso 8: NUEVO - Generar código si se requiere
    let mensajeFinal = descripcionLimpia 
        ? `${descripcionLimpia} precio: $${precioConIncremento}` 
        : `$${precioConIncremento}`;

    let productCode = null;
    let idLargo = null;
    let proveedorClave = null;

    if (shouldGenerateCode && groupName) {
        proveedorClave = getProveedorClave(groupName);
        if (proveedorClave) {
            idLargo = generateLongId(proveedorClave);
            productCode = await generateAlias(proveedorClave);
            mensajeFinal += ` - Código: ${productCode}`;
        }
    }

    return { 
        isValid: true, 
        text: mensajeFinal,
        productCode,
        idLargo,
        proveedorClave,
        precioOriginal,
        precioConIncremento,
        descripcionLimpia
    };
}

module.exports = {
    procesarMensaje,
    initializeCounters,
    getProveedorClave
};