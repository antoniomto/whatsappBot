// test-connection.js
require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function testConnection() {
  console.log('🔍 Probando conexión a Google Sheets...');
  
  try {
    console.log('1. Creando autenticación...');
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('2. Conectando al documento...');
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    
    console.log('3. Cargando información...');
    await doc.loadInfo();
    
    console.log('✅ ÉXITO! Conectado a:', doc.title);
    console.log('📄 Hojas disponibles:');
    doc.sheetsByIndex.forEach((sheet, index) => {
      console.log(`  ${index + 1}. ${sheet.title}`);
    });
    
  } catch (error) {
    console.error('❌ ERROR de conexión:');
    console.error('Tipo:', error.name);
    console.error('Mensaje:', error.message);
    
    if (error.message.includes('permission')) {
      console.error('\n🔧 SOLUCIÓN: Compartir el Google Sheet con la cuenta de servicio');
    }
    if (error.message.includes('not found')) {
      console.error('\n🔧 SOLUCIÓN: Verificar el SPREADSHEET_ID en .env');
    }
  }
}

testConnection();