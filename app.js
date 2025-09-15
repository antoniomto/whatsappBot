// app.js – WPPConnect robusto (versión corregida)
const wppconnect = require('@wppconnect-team/wppconnect');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const os = require('os');
const path = require('path');

const procesarMensaje = require('./utils.js');

// === Configuración de grupos ===
const grupoProveedores = ["Ventas usa clouthes andys", "Proveedor Fake", "Mayoristas VIP 2"];
const GRUPO_REVISION = "ReviewKairam";
let GRUPO_DESTINO = "Kairam333 Clouthes";
const GRUPO_ADMIN = "BotAdmin";

const now = () => new Date().toLocaleString();

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

// ✅ FUNCIÓN CORREGIDA PARA MANEJAR MEDIA
async function sendMediaWithCaption(client, toId, mediaObj, caption) {
  try {
    console.log(`[${now()}] 🔄 Intentando enviar media...`);
    
    // Verificar que mediaObj existe y tiene datos
    if (!mediaObj) {
      console.error(`[${now()}] ❌ mediaObj es null o undefined`);
      return false;
    }

    // WPPConnect puede retornar diferentes estructuras, verificamos todas
    let mediaData = mediaObj.data || mediaObj.base64 || mediaObj;
    let mimeType = mediaObj.mimetype || mediaObj.mime || 'image/jpeg';
    
    if (!mediaData) {
      console.error(`[${now()}] ❌ No se encontraron datos de media en el objeto`);
      console.log(`[${now()}] 🔍 Estructura del mediaObj:`, Object.keys(mediaObj));
      return false;
    }

    // Asegurar que los datos estén en formato correcto
    if (typeof mediaData !== 'string') {
      console.error(`[${now()}] ❌ mediaData no es string, es:`, typeof mediaData);
      return false;
    }

    // Preparar el formato correcto para envío
    const prefixed = mediaData.startsWith('data:') 
      ? mediaData 
      : `data:${mimeType};base64,${mediaData}`;
    
    const filename = `file${extFromMime(mimeType)}`;

    // 1) Intentar con sendImage
    try {
      await client.sendImage(toId, prefixed, filename, caption || '');
      console.log(`[${now()}] ✅ Media enviada con sendImage`);
      return true;
    } catch (e1) {
      // 2) Fallback a sendFile (silencioso)
      try {
        await client.sendFile(toId, prefixed, filename, caption || '');
        console.log(`[${now()}] ✅ Media enviada con sendFile`);
        return true;
      } catch (e2) {
        
        // 3) Último recurso: archivo temporal
        try {
          const tmpPath = path.join(os.tmpdir(), `kairam-${Date.now()}${extFromMime(mimeType)}`);
          const buffer = Buffer.from(mediaData.replace(/^data:[^;]+;base64,/, ''), 'base64');
          fs.writeFileSync(tmpPath, buffer);
          
          await client.sendFile(toId, tmpPath, filename, caption || '');
          console.log(`[${now()}] ✅ Media enviada con archivo temporal`);
          
          // Limpiar archivo temporal
          fs.unlink(tmpPath, () => {});
          return true;
        } catch (e3) {
          console.error(`[${now()}] ❌ Todos los métodos fallaron:`, e3?.message || e3);
          return false;
        }
      }
    }
  } catch (error) {
    console.error(`[${now()}] ❌ Error en sendMediaWithCaption:`, error?.message || error);
    return false;
  }
}

// ✅ FUNCIÓN MEJORADA PARA DETECTAR MEDIA
function hasMedia(msg) {
  return Boolean(msg.mimetype) ||
         Boolean(msg.isMedia) ||
         Boolean(msg.mediaKey) ||
         Boolean(msg.clientUrl) ||
         ['image', 'video', 'audio', 'document', 'ptt', 'sticker'].includes(msg.type);
}

// ✅ FUNCIÓN MEJORADA PARA DESCARGAR MEDIA
async function downloadMediaSafely(client, message) {
  try {
    console.log(`[${now()}] 🔄 Descargando media...`);
    
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
          
          // 🔧 CORRECCIÓN: Convertir Buffer/objeto a base64 string
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
            // Intentar convertir cualquier cosa a Buffer y luego a base64
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
          
          // 🔧 CORRECCIÓN: Convertir Buffer/objeto a base64 string
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

// ---------- Inicio del cliente ----------
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

setInterval(async () => {
    try {
      await client.isConnected();
      console.log('🏓 Ping OK');
    } catch (error) {
      console.log('❌ Conexión perdida, saliendo...');
      process.exit(1);
    }
  }, 2 * 60 * 1000);

  client.onMessage(async (message) => {
    try {
      const chat = await client.getChatById(message.chatId);
      const chatName = chat?.name || '';
      const senderName = message.isGroupMsg ? `${chatName} (Grupo)` : `${chatName} (Contacto)`;

      const mediaFlag = hasMedia(message);
      const texto = mediaFlag ? (message.caption || "(solo media)") : (message.body || "(sin texto)");

      // Log claro (sin base64)
      console.log(`[${now()}] 📩 ${senderName} :: ${mediaFlag ? (message.caption ? 'MEDIA+CAPTION' : 'SOLO MEDIA') : 'SOLO TEXTO'} :: ${mediaFlag ? (message.caption || '') : (looksLikeBase64(texto) ? '(base64 omitido)' : texto)}`);

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
          const review = await obtenerGrupo(GRUPO_REVISION, client);
          if (review) {
            await client.sendText(review.id, texto);
            console.log(`[${now()}] ✅ Texto reenviado a revisión`);
          }
        }

        // MEDIA + CAPTION
        else if (mediaFlag && message.caption) {
          const processed = procesarMensaje(message.caption);
          const media = await downloadMediaSafely(client, message);
          if (!media) {
            console.error(`[${now()}] ❌ No se pudo descargar media con caption`);
            return;
          }

          const destinoOk = processed.isValid ? await obtenerGrupo(GRUPO_DESTINO, client) : null;
          const reviewOk = !processed.isValid ? await obtenerGrupo(GRUPO_REVISION, client) : null;

          if (processed.isValid && destinoOk) {
            const ok = await sendMediaWithCaption(client, destinoOk.id, media, processed.text);
            if (ok) console.log(`[${now()}] ✅ Img+texto a destino: ${processed.text}`);
          } else if (!processed.isValid && reviewOk) {
            const ok = await sendMediaWithCaption(client, reviewOk.id, media, message.caption);
            if (ok) console.log(`[${now()}] ✅ Img+texto enviado a revisión`);
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
process.on('uncaughtException', (error) => {
  console.error('💥 Error fatal:', error.message);
  process.exit(1);
});
}).catch(err => console.error('❌ Error iniciando WPPConnect:', err));

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