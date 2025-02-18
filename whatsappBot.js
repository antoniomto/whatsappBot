const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const procesarMensaje = require("./utils");

const grupoProveedores = ["Ventas usa clouthes andys", "Proveedor Fake"];
const GRUPO_REVISION = "ReviewKairam"; // Grupo para revisión
let GRUPO_DESTINO = "Kairam333 Clouthes"; // Kairam333 Clouthes  --  ReviewKairam   Grupo de destino final (inicial)
const GRUPO_ADMIN = "BotAdmin"; // Grupo para comandos de administración

// Función para obtener la fecha y hora actuales en formato legible
function getFormattedDateTime() {
    const now = new Date();
    return now.toLocaleString(); // Ejemplo: "18/11/2024, 14:30:15"
}

// Inicializar cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Escuchar eventos del cliente
client.on("qr", (qr) => {
    console.log(`[${getFormattedDateTime()}] Escanea este código QR para iniciar sesión:`);
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log(`[${getFormattedDateTime()}] ¡Cliente conectado y listo!`);
});

// Reconectar automáticamente en caso de desconexión
client.on("disconnected", (reason) => {
    console.error(`[${getFormattedDateTime()}] Cliente desconectado. Razón: ${reason}`);
    console.log(`[${getFormattedDateTime()}] Intentando reconectar...`);
    client.initialize();
});

// Ping periódico para mantener la conexión activa
setInterval(async () => {
    try {
        const chats = await client.getChats();
        console.log(`[${getFormattedDateTime()}] Ping exitoso. Número de chats: ${chats.length}`);
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al enviar ping. Intentando reconectar...`);
        client.initialize();
    }
}, 300000); // Cada 5 min

// Manejo global de errores
client.on("error", (error) => {
    console.error(`[${getFormattedDateTime()}] Error inesperado: ${error}`);
    console.log(`[${getFormattedDateTime()}] Intentando reconectar...`);
    client.initialize();
});

// Escuchar mensajes
client.on("message", async (message) => {
    try {
        const chat = await message.getChat();
        const senderName = chat.isGroup ? `${chat.name} (Grupo)` : `${chat.name} (Contacto)`;
        const messageContent = message.body || "Solo imagen";

        console.log(`[${getFormattedDateTime()}] Mensaje recibido de ${senderName}: ${messageContent}`);

        // Verificar si es el grupo de administración
        if (chat.name === GRUPO_ADMIN) {
            if (messageContent.toLowerCase() === "activar") {
                GRUPO_DESTINO = "Kairam333 Clouthes";
                console.log(`[${getFormattedDateTime()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
            } else if (messageContent.toLowerCase() === "desactivar") {
                GRUPO_DESTINO = "Prueba Kairam";
                console.log(`[${getFormattedDateTime()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
            }
            return; // No procesar más para el grupo de administración
        }

        // Verificar si es un grupo de proveedores
        if (grupoProveedores.some(grupo => chat.name.includes(grupo))) {
            if (message.hasMedia && !message.body) {
                // Mensaje con solo imagen
                const targetGroup = await obtenerGrupo(GRUPO_REVISION, client);
                if (targetGroup) {
                    const media = await message.downloadMedia();
                    await client.sendMessage(targetGroup.id._serialized, media);
                    console.log(`[${getFormattedDateTime()}] Imagen enviada al grupo ${GRUPO_REVISION}`);
                }
            } else if (!message.hasMedia && message.body) {
                if (message.body.toLowerCase() === 'vendido' || message.body.toLowerCase() === 'vendidos') {
                    console.log(`[${getFormattedDateTime()}] Mensaje ignorado por ser notificacion de 'vendido'.`);
                    return;
                }
                // Mensaje con solo texto
                const reviewGroup = await obtenerGrupo(GRUPO_REVISION, client);
                if (reviewGroup) {
                    await client.sendMessage(reviewGroup.id._serialized, message.body);
                    console.log(`[${getFormattedDateTime()}] Mensaje de texto enviado al grupo de revisión ${GRUPO_REVISION}`);
                }
            } else if (message.hasMedia && message.body) {
                // Mensaje con texto e imagen
                const processedMessage = procesarMensaje(message.body);

                if (processedMessage.isValid) {
                    const targetGroup = await obtenerGrupo(GRUPO_DESTINO, client);
                    if (targetGroup) {
                        const media = await message.downloadMedia();
                        await client.sendMessage(
                            targetGroup.id._serialized,
                            media,
                            { caption: processedMessage.text }
                        );
                        console.log(`[${getFormattedDateTime()}] Mensaje con imagen y texto enviado al grupo ${GRUPO_DESTINO}: ${processedMessage.text}`);
                    }
                } else {
                    const reviewGroup = await obtenerGrupo(GRUPO_REVISION, client);
                    if (reviewGroup) {
                        const media = await message.downloadMedia();
                        if (message.hasMedia) {
                            await client.sendMessage(reviewGroup.id._serialized, media, {
                                caption: message.body,
                            });
                        } else {
                            await client.sendMessage(reviewGroup.id._serialized, message.body);
                        }
                        console.log(`[${getFormattedDateTime()}] Mensaje con imagen y texto enviado a revisión ${GRUPO_REVISION}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al procesar el mensaje: ${error}`);
    }
});

// Función para obtener el grupo de destino
async function obtenerGrupo(nombreGrupo, client) {
    try {
        const chats = await client.getChats();
        return chats.find((chat) => chat.name.includes(nombreGrupo));
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al obtener grupo: ${error}`);
        return null;
    }
}


// Inicializar cliente
client.initialize();
