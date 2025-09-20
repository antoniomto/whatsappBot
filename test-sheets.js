require('dotenv').config();
const { initializeSheets, saveProduct, getLastAliasOfDay, getSheetCode } = require('./sheets.js');
const { initializeCounters } = require('./utils.js');

async function testSheets() {
  console.log('🧪 Iniciando prueba de Google Sheets...');
  
  try {
    // Test 1: Conexión
    console.log('1️⃣ Probando conexión...');
    const connected = await initializeSheets();
    if (!connected) {
      console.error('❌ Falló la conexión');
      return;
    }
    
    // Test 1.5: Probar código de hoja
    console.log('1️⃣.5 Probando código de hoja...');
    const sheetCode = await getSheetCode();
    console.log(`Código de hoja: ${sheetCode}`);
    
    // Test 2: Inicializar contadores
    console.log('2️⃣ Inicializando contadores...');
    await initializeCounters();
    
    // Test 3: Leer último alias
    console.log('3️⃣ Probando lectura de alias...');
    const lastAlias = await getLastAliasOfDay('A');
    console.log(`Último alias A: ${lastAlias}`);
    
    // Test 4: Guardar producto de prueba
    console.log('4️⃣ Probando guardado de producto...');
    const testProduct = {
      idLargo: 'AP125092014301234',
      alias: 'AP1001',
      fecha: new Date().toISOString(),
      proveedor: 'A',
      producto: 'Producto de prueba',
      precioBase: 1000,
      precioVenta: 1200
    };
    
    const saved = await saveProduct(testProduct);
    if (saved) {
      console.log('✅ Producto de prueba guardado correctamente');
    } else {
      console.log('❌ Error guardando producto de prueba');
    }
    
    console.log('🎉 Prueba completada');
    
  } catch (error) {
    console.error('💥 Error en prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSheets();