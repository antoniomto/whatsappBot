// app.js – WPPConnect con sistema de códigos y Google Sheets
require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { procesarMensaje, initializeCounters, getProveedorClave } = require('./utils.js');
const { initializeSheets, saveProduct, updateProductStatus, findProductByAlias } = require('./sheets.js');

// === Configuración de grupos ===
const grupoProveedores = ["Ventas usa clouthes andys", "Proveedor Fake", "Mayoristas VIP 2"];
const GRUPO_REVISION = "ReviewKairam";
let GRUPO_DESTINO = "Kairam333 Clouthes";
const GRUPO_ADMIN = "BotAdmin";

const now = () => new Date().toLocaleString();

// === NUEVO: Función para detectar mensajes administrativos ===
function esMensajeAdministrativo(texto) {
  if (!texto) return false;
  
  const textoLower = texto.toLowerCase();
  
  // Regla 1: Mensajes muy largos (probablemente informativos)
  if (texto.length > 300) return true;
  
  // Regla 2: Patrones promocionales de mayoreo
  const patronesPromo = [
    /hello!!|hola!!/i,  // Saludos con múltiples exclamaciones
    /venta de mayoreo|mayoreo desde/i,  // Menciones de mayoreo
    /te esperamos|los esperamos/i,  // Frases de invitación
    /estamos en el grupo|grupo.*https/i,  // Referencias a grupos
    /precio de mayoreo/i,  // Precios mayoristas
    /anticipo.*obligator/i,  // Términos de anticipo
    /envio.*gratis.*primera/i  // Políticas de envío
  ];
  
  // Si coincide con 2 o más patrones promocionales
  const coincidenciasPromo = patronesPromo.filter(patron => patron.test(texto)).length;
  if (coincidenciasPromo >= 2) return true;
  
  // Regla 3: Patrones de calendario
  const patronCalendario = /\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d+.*[-–]/i;
  if (patronCalendario.test(texto)) return true;
  
  // Regla 4: Múltiples días de la semana
  const diasSemana = (texto.match(/\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi) || []).length;
  if (diasSemana >= 2) return true;
  
  return false;
}

// === NUEVO: Detectar confirmaciones de pedidos ===
function detectarConfirmacion(texto, chatId) {
  if (!texto) return null;
  
  // Patrones: "Confirmado A01", "CONFIRMADO V02", "confirmado C03"
  const match = texto.match(/\b(?:confirmado|confirmed)\s+([A-Z]\d{2})\b/i);
  if (match) {
    return {
      alias: match[1].toUpperCase(),
      cliente: chatId
    };
  }
  
  return null;
}

// ---------- Utilidades ----------
const looksLikeBase64 = (s = "") =>
  typeof s === "string" &&
  s.length > 200 &&
  /^[A-Za-z0-9+/=\r\n]+$/.test(s) &&
  !s.includes(' ') && !s.includes('\t');

const extFromMime = (mime = "") => {
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('pdf')) return '.pdf';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('mp3')) return '.mp3';
  return '.bin';
};

async function sendMediaWithCaption(client, toId, mediaObj, caption) {
  // mediaObj: { mimetype, data }
  const prefixed = mediaObj.data.startsWith('data:')
    ? mediaObj.data
    : `data:${mediaObj.mimetype};base64,${mediaObj.data}`;
  const filename = `file${extFromMime(mediaObj.mimetype)}`;

  // 1) Intento con sendImage (suele reconocer mejor base64 con prefijo)
  try {
    await client.sendImage(toId, prefixed, filename, caption);
    return true;
  } catch (e1) {
    // 2) Fallback a sendFile (acepta base64 con prefijo)
    try {
      await client.sendFile(toId, prefixed, filename, caption);
      return true;
    } catch (e2) {
      // 3) Último recurso: escribir archivo temporal y mandarlo por ruta
      try {
        const tmpPath = path.join(os.tmpdir(), `kairam-${Date.now()}${extFromMime(mediaObj.mimetype)}`);
        fs.writeFileSync(tmpPath, Buffer.from(mediaObj.data, 'base64'));
        await client.sendFile(toId, tmpPath, filename, caption);
        fs.unlink(tmpPath, () => {});
        return true;
      } catch (e3) {
        console.error(`[${now()}] ❌ Falló envío media (todos los intentos):`, e3?.message || e3);
        return false;
      }
    }
  }
}

function hasMedia(msg) {
  return Boolean(msg.mimetype) ||
         Boolean(msg.isMedia) ||
         ['image', 'video', 'audio', 'document', 'ptt', 'sticker'].includes(msg.type);
}

// === NUEVO: Función mejorada para descargar media ===
async function downloadMediaSafely(client, message) {
  try {
    console.log(`[${now()}] 📄 Descargando media...`);
    
    // Diferentes métodos de descarga según la versión de WPPConnect
    let media = null;
    
    // Método 1: downloadMedia estándar
    try {
      media = await client.downloadMedia(message);
      if (media && (media.data || media.base64)) {
        console.log(`[${now()}] ✅ Media descargada con downloadMedia`);
        return media;
      }
    } catch (e1) {
      console.log(`[${now()}] ⚠️ downloadMedia falló, intentando alternativa...`);
    }

    // Método 2: decryptFile si existe
    try {
      if (client.decryptFile && message.mediaKey) {
        const rawMedia = await client.decryptFile(message);
        if (rawMedia) {
          console.log(`[${now()}] ✅ Media descargada con decryptFile`);
          
          // Corrección: Convertir Buffer/objeto a base64 string
          let base64Data;
          if (Buffer.isBuffer(rawMedia)) {
            base64Data = rawMedia.toString('base64');
          } else if (typeof rawMedia === 'object' && rawMedia.data) {
            base64Data = Buffer.isBuffer(rawMedia.data) 
              ? rawMedia.data.toString('base64') 
              : rawMedia.data;
          } else if (typeof rawMedia === 'string') {
            base64Data = rawMedia;
          } else {
            base64Data = Buffer.from(rawMedia).toString('base64');
          }
          
          return { 
            data: base64Data, 
            mimetype: message.mimetype || 'image/jpeg' 
          };
        }
      }
    } catch (e2) {
      console.log(`[${now()}] ⚠️ decryptFile falló:`, e2?.message);
    }

    // Método 3: intentar con downloadFile si existe URL
    try {
      if (message.clientUrl && client.downloadFile) {
        const rawMedia = await client.downloadFile(message.clientUrl);
        if (rawMedia) {
          console.log(`[${now()}] ✅ Media descargada con downloadFile`);
          
          // Convertir Buffer/objeto a base64 string
          let base64Data;
          if (Buffer.isBuffer(rawMedia)) {
            base64Data = rawMedia.toString('base64');
          } else if (typeof rawMedia === 'string') {
            base64Data = rawMedia;
          } else {
            base64Data = Buffer.from(rawMedia).toString('base64');
          }
          
          return { 
            data: base64Data, 
            mimetype: message.mimetype || 'image/jpeg' 
          };
        }
      }
    } catch (e3) {
      console.log(`[${now()}] ⚠️ downloadFile falló:`, e3?.message);
    }

    console.error(`[${now()}] ❌ No se pudo descargar la media con ningún método`);
    return null;
    
  } catch (error) {
    console.error(`[${now()}] ❌ Error en downloadMediaSafely:`, error?.message || error);
    return null;
  }
}

// === NUEVO: Función para guardar producto en sheets ===
async function guardarProductoEnSheets(productData) {
  try {
    const success = await saveProduct({
      idLargo: productData.idLargo,
      alias: productData.productCode,
      fecha: new Date().toISOString(),
      proveedor: productData.proveedorClave,
      producto: productData.descripcionLimpia,
      precioBase: productData.precioOriginal,
      precioVenta: productData.precioConIncremento,
      status: 'Disponible'
    });
    
    return success;
  } catch (error) {
    console.error(`[${now()}] ❌ Error guardando en sheets:`, error.message);
    return false;
  }
}

// ---------- Inicio del cliente ----------
async function startBot() {
  // Inicializar Google Sheets
  const sheetsOk = await initializeSheets();
  if (!sheetsOk) {
    console.warn(`[${now()}] ⚠️ Sheets no disponible, continuando sin sincronización`);
  }
  
  // Inicializar contadores
  await initializeCounters();

  wppconnect.create({
    session: 'kairam',
    headless: true,
    catchQR: (base64Qr) => qrcode.generate(base64Qr, { small: true }),
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    },
    disableWelcome: true,
    autoClose: 0
  }).then(client => {
    console.log(`[${now()}] ✅ Cliente conectado y listo!`);

    // === NUEVO: Keep-alive simple ===
    setInterval(async () => {
      try {
        await client.isConnected();
        console.log(`[${now()}] 🔄 Ping OK`);
      } catch (error) {
        console.log(`[${now()}] ❌ Conexión perdida, saliendo...`);
        process.exit(1); // PM2 lo reiniciará automáticamente
      }
    }, 2 * 60 * 1000); // Cada 2 minutos

    client.onMessage(async (message) => {
      try {
        const chat = await client.getChatById(message.chatId);
        const chatName = chat?.name || '';
        const senderName = message.isGroupMsg ? `${chatName} (Grupo)` : `${chatName} (Contacto)`;

        const mediaFlag = hasMedia(message);
        const texto = mediaFlag ? (message.caption || "(solo media)") : (message.body || "(sin texto)");

        // Log claro (sin base64)
        console.log(`[${now()}] 📩 ${senderName} :: ${mediaFlag ? (message.caption ? 'MEDIA+CAPTION' : 'SOLO MEDIA') : 'SOLO TEXTO'} :: ${mediaFlag ? (message.caption || '') : (looksLikeBase64(texto) ? '(base64 omitido)' : texto)}`);

        // === NUEVO: Detectar confirmaciones en cualquier chat ===
        const confirmacion = detectarConfirmacion(texto, message.from);
        if (confirmacion) {
          console.log(`[${now()}] 🔔 Confirmación detectada: ${confirmacion.alias} por ${confirmacion.cliente}`);
          
          const producto = await findProductByAlias(confirmacion.alias);
          if (producto) {
            const success = await updateProductStatus(confirmacion.alias, confirmacion.cliente);
            if (success) {
              await client.sendText(message.chatId, `✅ Pedido ${confirmacion.alias} confirmado`);
            } else {
              await client.sendText(message.chatId, `⚠️ Error actualizando ${confirmacion.alias}`);
            }
          } else {
            await client.sendText(message.chatId, `❌ Código ${confirmacion.alias} no encontrado`);
          }
          return;
        }

        // --- Control desde BotAdmin ---
        if (chatName === GRUPO_ADMIN) {
          const lc = (texto || '').toLowerCase();
          if (lc === "activar") {
            GRUPO_DESTINO = "Kairam333 Clouthes";
            console.log(`[${now()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
          } else if (lc === "desactivar") {
            GRUPO_DESTINO = "Prueba Kairam";
            console.log(`[${now()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
          }
          
          // === NUEVO: Comando /confirmar en BotAdmin ===
          else if (texto.startsWith('/confirmar ')) {
            const parts = texto.split(' ');
            if (parts.length >= 3) {
              const alias = parts[1];
              const cliente = parts[2];
              
              console.log(`[${now()}] 🔧 Comando confirmar: ${alias} para ${cliente}`);
              const success = await updateProductStatus(alias, cliente);
              if (success) {
                await client.sendText(message.chatId, `✅ ${alias} confirmado para ${cliente}`);
              } else {
                await client.sendText(message.chatId, `❌ Error confirmando ${alias}`);
              }
            } else {
              await client.sendText(message.chatId, `❌ Uso: /confirmar [ALIAS] [CLIENTE]`);
            }
          }
          
          return;
        }

        // --- Lógica para proveedores ---
        if (grupoProveedores.some(grupo => chatName.includes(grupo))) {

          // SOLO MEDIA
          if (mediaFlag && !message.caption) {
            const review = await obtenerGrupo(GRUPO_REVISION, client);
            if (review) {
              const media = await downloadMediaSafely(client, message);
              if (media) {
                const ok = await sendMediaWithCaption(client, review.id, media, undefined);
                if (ok) console.log(`[${now()}] ✅ Imagen enviada a revisión`);
              } else {
                console.error(`[${now()}] ❌ No se pudo descargar la media`);
              }
            }
          }

          // SOLO TEXTO (evitar base64)
          else if (!mediaFlag && texto && !looksLikeBase64(texto)) {
            const lc = texto.toLowerCase();
            if (lc === "vendido" || lc === "vendidos") {
              console.log(`[${now()}] ↪️ Ignorado 'vendido(s)'`);
              return;
            }

            // === NUEVO: Filtrar mensajes administrativos ===
            if (esMensajeAdministrativo(texto)) {
              console.log(`[${now()}] 📋 Ignorado mensaje administrativo (solo texto)`);
              return;
            }

            const review = await obtenerGrupo(GRUPO_REVISION, client);
            if (review) {
              await client.sendText(review.id, texto);
              console.log(`[${now()}] ✅ Texto reenviado a revisión`);
            }
          }

          // MEDIA + CAPTION (NUEVA LÓGICA CON CÓDIGOS)
          else if (mediaFlag && message.caption) {
            
            // === NUEVO: Filtrar mensajes administrativos PRIMERO ===
            if (esMensajeAdministrativo(message.caption)) {
              console.log(`[${now()}] 📋 Ignorado mensaje administrativo (con imagen)`);
              return;
            }

            // Procesar mensaje CON generación de código
            const processed = await procesarMensaje(message.caption, true, chatName);
            
            if (!processed.isValid) {
              // Si no es válido, enviar a revisión SIN código
              const media = await downloadMediaSafely(client, message);
              if (media) {
                const reviewOk = await obtenerGrupo(GRUPO_REVISION, client);
                if (reviewOk) {
                  const ok = await sendMediaWithCaption(client, reviewOk.id, media, message.caption);
                  if (ok) console.log(`[${now()}] 📋 Img+texto enviado a revisión (no válido)`);
                }
              }
              return;
            }

            // Si es válido, procesar con código
            const media = await downloadMediaSafely(client, message);
            if (!media) {
              console.error(`[${now()}] ❌ No se pudo descargar media con caption`);
              return;
            }

            // === NUEVO: Guardar en Sheets ANTES de republicar ===
            if (processed.productCode) {
              const savedToSheets = await guardarProductoEnSheets(processed);
              if (savedToSheets) {
                console.log(`[${now()}] 📊 Producto ${processed.productCode} guardado en PRODS_ACTUAL`);
              } else {
                console.log(`[${now()}] ⚠️ Producto ${processed.productCode} no guardado en PRODS_ACTUAL, continuando`);
              }
            }

            // Republicar al grupo destino CON código
            const destinoOk = await obtenerGrupo(GRUPO_DESTINO, client);
            if (destinoOk) {
              const ok = await sendMediaWithCaption(client, destinoOk.id, media, processed.text);
              if (ok) {
                console.log(`[${now()}] ✅ Img+código a destino: ${processed.productCode} - ${processed.text}`);
              }
            }
          }

          // CASO RARO: Parece base64 en body pero sin flags de media
          else if (!mediaFlag && looksLikeBase64(message.body || '')) {
            console.warn(`[${now()}] ⚠️ Body parece base64; intento forzar descarga y envío a revisión.`);
            const review = await obtenerGrupo(GRUPO_REVISION, client);
            if (review) {
              try {
                const media = await downloadMediaSafely(client, message);
                if (media) {
                  const ok = await sendMediaWithCaption(client, review.id, media, message.caption);
                  if (ok) console.log(`[${now()}] ✅ Media enviada a revisión (caso base64-body)`);
                }
              } catch (err) {
                console.error(`[${now()}] ❌ No fue posible convertir base64-body a media:`, err?.message || err);
              }
            }
          }
        }
      } catch (e) {
        console.error(`[${now()}] ❌ Error procesando mensaje:`, e?.message || e);
        console.error(`[${now()}] 🔍 Stack trace:`, e?.stack);
      }
    });

    // === NUEVO: Detectar errores fatales ===
    process.on('uncaughtException', (error) => {
      console.error(`[${now()}] 💥 Error fatal:`, error.message);
      process.exit(1); // PM2 reinicia automáticamente
    });

  }).catch(err => console.error('❌ Error iniciando WPPConnect:', err));
}

// === Utilidad: buscar grupo por nombre ===
async function obtenerGrupo(nombre, client) {
  try {
    const chats = await client.listChats();
    return chats.find(c => c.name && c.name.includes(nombre));
  } catch (e) {
    console.error(`[${now()}] ❌ Error obteniendo grupo:`, e?.message || e);
    return null;
  }
}

// Inicializar bot
startBot().catch(err => {
  console.error('❌ Error fatal iniciando bot:', err);
  process.exit(1);
});