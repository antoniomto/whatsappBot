// test-sheets.js
require('dotenv').config();
const { initializeSheets, saveProduct, getSheetCode } = require('./sheets.js');

async function testSheets() {
  console.log('Test de Google Sheets...');
  
  try {
    const connected = await initializeSheets();
    if (!connected) return;
    
    const sheetCode = await getSheetCode();
    console.log('Código:', sheetCode);
    
    const testProduct = {
      idLargo: `TEST${Date.now()}`,
      alias: `A${sheetCode}999`,
      fecha: new Date().toISOString(),
      proveedor: 'A',
      producto: 'Test producto',
      precioBase: 1000,
      precioVenta: 1200
    };
    
    const saved = await saveProduct(testProduct);
    console.log(saved ? 'Guardado OK' : 'Error guardando');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSheets();