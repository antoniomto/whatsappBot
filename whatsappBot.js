const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const procesarMensaje = require("./utils");

const grupoProveedores = ["Ventas usa clouthes andys", "Proveedor Fake", "Mayoristas VIP 2"];
const GRUPO_REVISION = "ReviewKairam";
let GRUPO_DESTINO = "Kairam333 Clouthes";
const GRUPO_ADMIN = "BotAdmin";

function getFormattedDateTime() {
    const now = new Date();
    return now.toLocaleString();
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--single-process',
            '--no-zygote'
        ]
    }
});

client.on("qr", (qr) => {
    console.log(`[${getFormattedDateTime()}] Escanea este código QR para iniciar sesión:`);
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log(`[${getFormattedDateTime()}] ¡Cliente conectado y listo!`);
});

client.on("disconnected", (reason) => {
    console.error(`[${getFormattedDateTime()}] Cliente desconectado. Razón: ${reason}`);
    console.log(`[${getFormattedDateTime()}] Intentando reconectar...`);
    client.initialize();
});

setInterval(async () => {
    try {
        const chats = await client.getChats();
        console.log(`[${getFormattedDateTime()}] Ping exitoso. Número de chats: ${chats.length}`);
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al enviar ping. Intentando reconectar...`);
        client.initialize();
    }
}, 300000); // 5 minutos

client.on("error", (error) => {
    console.error(`[${getFormattedDateTime()}] Error inesperado: ${error}`);
    console.log(`[${getFormattedDateTime()}] Intentando reconectar...`);
    client.initialize();
});

client.on("message", async (message) => {
    try {
        const chat = await message.getChat();
        const senderName = chat.isGroup ? `${chat.name} (Grupo)` : `${chat.name} (Contacto)`;
        const messageContent = message.body || "Solo imagen";

        console.log(`[${getFormattedDateTime()}] Mensaje recibido de ${senderName}: ${messageContent}`);

        if (chat.name === GRUPO_ADMIN) {
            if (messageContent.toLowerCase() === "activar") {
                GRUPO_DESTINO = "Kairam333 Clouthes";
                console.log(`[${getFormattedDateTime()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
            } else if (messageContent.toLowerCase() === "desactivar") {
                GRUPO_DESTINO = "Prueba Kairam";
                console.log(`[${getFormattedDateTime()}] Grupo destino cambiado a: ${GRUPO_DESTINO}`);
            }
            return;
        }

        if (grupoProveedores.some(grupo => chat.name.includes(grupo))) {
            if (message.hasMedia && !message.body) {
                const targetGroup = await obtenerGrupo(GRUPO_REVISION, client);
                if (targetGroup) {
                    const media = await message.downloadMedia();
                    if (!media) {
                        console.warn(`[${getFormattedDateTime()}] No se pudo descargar media. Se omite.`);
                        return;
                    }
                    await client.sendMessage(targetGroup.id._serialized, media);
                    console.log(`[${getFormattedDateTime()}] Imagen enviada al grupo ${GRUPO_REVISION}`);
                }
            } else if (!message.hasMedia && message.body) {
                if (message.body.toLowerCase() === 'vendido' || message.body.toLowerCase() === 'vendidos') {
                    console.log(`[${getFormattedDateTime()}] Mensaje ignorado por ser notificación de 'vendido'.`);
                    return;
                }

                const reviewGroup = await obtenerGrupo(GRUPO_REVISION, client);
                if (reviewGroup) {
                    await client.sendMessage(reviewGroup.id._serialized, message.body);
                    console.log(`[${getFormattedDateTime()}] Mensaje de texto enviado al grupo de revisión ${GRUPO_REVISION}`);
                }
            } else if (message.hasMedia && message.body) {
                const processedMessage = procesarMensaje(message.body);

                console.log(`[${getFormattedDateTime()}] Texto original: ${message.body} → Procesado: ${processedMessage.text}`);

                if (processedMessage.isValid) {
                    const targetGroup = await obtenerGrupo(GRUPO_DESTINO, client);
                    if (targetGroup) {
                        const media = await message.downloadMedia();
                        if (!media) {
                            console.warn(`[${getFormattedDateTime()}] No se pudo descargar media. Se omite.`);
                            return;
                        }
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
                        if (!media) {
                            console.warn(`[${getFormattedDateTime()}] No se pudo descargar media. Se omite.`);
                            return;
                        }
                        await client.sendMessage(reviewGroup.id._serialized, media, {
                            caption: message.body,
                        });
                        console.log(`[${getFormattedDateTime()}] Mensaje con imagen y texto enviado a revisión ${GRUPO_REVISION}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al procesar el mensaje: ${error}`);
    }
});

async function obtenerGrupo(nombreGrupo, client) {
    try {
        const chats = await client.getChats();
        return chats.find((chat) => chat.name.includes(nombreGrupo));
    } catch (error) {
        console.error(`[${getFormattedDateTime()}] Error al obtener grupo: ${error}`);
        return null;
    }
}

client.initialize();
