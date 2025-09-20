const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

let doc = null;
let prodsSheet = null;
let pedidosSheet = null;
let currentSheetCode = 'P1';

const now = () => new Date().toLocaleString();

// Inicializar conexión con Google Sheets
async function initializeSheets() {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    // Buscar o crear hoja "PRODS_ACTUAL"
    prodsSheet = doc.sheetsByTitle['PRODS_ACTUAL'];
    if (!prodsSheet) {
      prodsSheet = await doc.addSheet({ 
        title: 'PRODS_ACTUAL',
        headerValues: ['ID_Largo', 'Alias', 'Fecha', 'Proveedor', 'Producto', 'Precio_Base', 'Precio_Venta', 'Status']
      });
      // Agregar código de hoja inicial en K1
      await prodsSheet.loadCells('K1');
      prodsSheet.getCell(0, 10).value = 'P1'; // K1 = columna 10, fila 0
      await prodsSheet.saveUpdatedCells();
    }
    
    // Buscar o crear hoja "PEDIDO_ACTUAL"
    pedidosSheet = doc.sheetsByTitle['PEDIDO_ACTUAL'];
    if (!pedidosSheet) {
      pedidosSheet = await doc.addSheet({ 
        title: 'PEDIDO_ACTUAL',
        headerValues: ['ID_Largo', 'Alias', 'Fecha_Prod', 'Fecha_Pedido', 'Proveedor', 'Producto', 'Precio_Base', 'Precio_Venta', 'Cliente', 'Status']
      });
    }
    
    // Leer código de hoja actual
    await prodsSheet.loadCells('K1');
    const cellValue = prodsSheet.getCell(0, 10).value;
    currentSheetCode = cellValue || 'P1';
    
    console.log(`[${now()}] ✅ Google Sheets conectado: ${doc.title} - Código hoja: ${currentSheetCode}`);
    return true;
  } catch (error) {
    console.error(`[${now()}] ❌ Error conectando Google Sheets:`, error.message);
    return false;
  }
}

// Leer código de hoja actual desde K1
async function getSheetCode() {
  try {
    if (!prodsSheet) {
      console.warn(`[${now()}] ⚠️ ProdsSheet no disponible, usando P1`);
      return 'P1';
    }
    
    await prodsSheet.loadCells('K1');
    const codigo = prodsSheet.getCell(0, 10).value;
    
    if (codigo && codigo !== currentSheetCode) {
      currentSheetCode = codigo;
      console.log(`[${now()}] 🔄 Código de hoja actualizado: ${currentSheetCode}`);
    }
    
    return currentSheetCode || 'P1';
  } catch (error) {
    console.error(`[${now()}] ❌ Error leyendo código de hoja:`, error.message);
    return currentSheetCode || 'P1';
  }
}

// Obtener último alias del día para un proveedor con código de hoja
async function getLastAliasOfDay(proveedorClave) {
  try {
    if (!prodsSheet) {
      console.warn(`[${now()}] ⚠️ PRODS_ACTUAL no disponible, retornando alias 0`);
      return 0;
    }

    // Obtener código de hoja actual
    const sheetCode = await getSheetCode();
    const aliasPrefix = `${proveedorClave}${sheetCode}`;

    const rows = await prodsSheet.getRows();
    const today = new Date().toISOString().split('T')[0];
    
    const todayRows = rows.filter(row => 
      row.get('Fecha')?.startsWith(today) && 
      row.get('Alias')?.startsWith(aliasPrefix)
    );
    
    if (todayRows.length === 0) return 0;
    
    const aliases = todayRows
      .map(row => row.get('Alias'))
      .filter(alias => alias && alias.startsWith(aliasPrefix))
      .map(alias => parseInt(alias.replace(aliasPrefix, '')) || 0);
    
    return Math.max(...aliases);
  } catch (error) {
    console.error(`[${now()}] ❌ Error obteniendo último alias:`, error.message);
    return 0;
  }
}

// Guardar producto en PRODS_ACTUAL
async function saveProduct(productData) {
  try {
    if (!prodsSheet) {
      console.warn(`[${now()}] ⚠️ PRODS_ACTUAL no disponible, guardando solo en memoria`);
      return false;
    }

    await prodsSheet.addRow({
      'ID_Largo': productData.idLargo,
      'Alias': productData.alias,
      'Fecha': productData.fecha,
      'Proveedor': productData.proveedor,
      'Producto': productData.producto,
      'Precio_Base': productData.precioBase,
      'Precio_Venta': productData.precioVenta || '',
      'Status': 'Disponible'
    });

    console.log(`[${now()}] ✅ Producto ${productData.alias} guardado en PRODS_ACTUAL`);
    return true;
  } catch (error) {
    console.error(`[${now()}] ❌ Error guardando en PRODS_ACTUAL:`, error.message);
    return false;
  }
}

// Confirmar pedido: copiar de PRODS_ACTUAL a PEDIDO_ACTUAL y actualizar status
async function updateProductStatus(alias, cliente, status = 'Confirmado') {
  try {
    if (!prodsSheet || !pedidosSheet) {
      console.warn(`[${now()}] ⚠️ Sheets no disponibles para actualizar ${alias}`);
      return false;
    }

    // 1. Buscar producto en PRODS_ACTUAL
    const prodsRows = await prodsSheet.getRows();
    const prodRow = prodsRows.find(r => r.get('Alias') === alias);
    
    if (!prodRow) {
      console.warn(`[${now()}] ⚠️ Alias ${alias} no encontrado en PRODS_ACTUAL`);
      return false;
    }

    // 2. Verificar que no esté ya pedido
    if (prodRow.get('Status') === 'Pedido') {
      console.warn(`[${now()}] ⚠️ ${alias} ya está confirmado como pedido`);
      return false;
    }

    // 3. Copiar a PEDIDO_ACTUAL
    await pedidosSheet.addRow({
      'ID_Largo': prodRow.get('ID_Largo'),
      'Alias': prodRow.get('Alias'),
      'Fecha_Prod': prodRow.get('Fecha'),
      'Fecha_Pedido': new Date().toISOString(),
      'Proveedor': prodRow.get('Proveedor'),
      'Producto': prodRow.get('Producto'),
      'Precio_Base': prodRow.get('Precio_Base'),
      'Precio_Venta': prodRow.get('Precio_Venta'),
      'Cliente': cliente,
      'Status': status
    });

    // 4. Actualizar status en PRODS_ACTUAL
    prodRow.set('Status', 'Pedido');
    await prodRow.save();

    console.log(`[${now()}] ✅ ${alias} confirmado: copiado a PEDIDO_ACTUAL - Cliente: ${cliente}`);
    return true;
  } catch (error) {
    console.error(`[${now()}] ❌ Error confirmando pedido ${alias}:`, error.message);
    return false;
  }
}

// Buscar producto por alias en PRODS_ACTUAL
async function findProductByAlias(alias) {
  try {
    if (!prodsSheet) return null;

    const rows = await prodsSheet.getRows();
    const row = rows.find(r => r.get('Alias') === alias);
    
    if (!row) return null;

    return {
      idLargo: row.get('ID_Largo'),
      alias: row.get('Alias'),
      producto: row.get('Producto'),
      precioBase: row.get('Precio_Base'),
      precioVenta: row.get('Precio_Venta'),
      status: row.get('Status')
    };
  } catch (error) {
    console.error(`[${now()}] ❌ Error buscando ${alias}:`, error.message);
    return null;
  }
}

module.exports = {
  initializeSheets,
  getLastAliasOfDay,
  saveProduct,
  updateProductStatus,
  findProductByAlias,
  getSheetCode
};