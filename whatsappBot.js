const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const procesarMensaje = require("./utils");

const app = express(); // Agregar Express para Vercel

const grupoProveedores = ["Ventas usa clouthes andys", "Proveedor Fake"];

// Inicializar cliente
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./.wwebjs_auth", // Ruta relativa para autenticación
    }),
});

// Escuchar eventos del cliente
client.on("qr", (qr) => {
    console.log("Escanea este código QR para iniciar sesión:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("¡Cliente conectado y listo!");
});

// Escuchar mensajes
client.on("message", async (message) => {
    try {
        const chat = await message.getChat();
        if (grupoProveedores.includes(chat.name.trim())) {
            console.log(`Mensaje recibido de ${chat.name}: ${message.body || "Solo imagen"}`);

            if (message.hasMedia && !message.body) {
                const targetGroup = await obtenerGrupo("ReviewKairam", client);
                if (targetGroup) {
                    const media = await message.downloadMedia();
                    await client.sendMessage(targetGroup.id._serialized, media);
                    console.log(`Imagen enviada al grupo ${targetGroup.name}`);
                }
            } else if (!message.hasMedia && message.body) {
                const reviewGroup = await obtenerGrupo("ReviewKairam", client);
                if (reviewGroup) {
                    await client.sendMessage(reviewGroup.id._serialized, message.body);
                    console.log(`Mensaje de texto enviado al grupo de revisión ${reviewGroup.name}`);
                }
            } else if (message.hasMedia && message.body) {
                const processedMessage = procesarMensaje(message.body);
                if (processedMessage.isValid) {
                    const targetGroup = await obtenerGrupo("Prueba Kairam", client);
                    if (targetGroup) {
                        const media = await message.downloadMedia();
                        await client.sendMessage(
                            targetGroup.id._serialized,
                            media,
                            { caption: processedMessage.text }
                        );
                        console.log(
                            `Mensaje con imagen y texto enviado al grupo ${targetGroup.name}: ${processedMessage.text}`
                        );
                    }
                } else {
                    const reviewGroup = await obtenerGrupo("ReviewKairam", client);
                    if (reviewGroup) {
                        const media = await message.downloadMedia();
                        if (message.hasMedia) {
                            await client.sendMessage(reviewGroup.id._serialized, media, {
                                caption: message.body,
                            });
                        } else {
                            await client.sendMessage(reviewGroup.id._serialized, message.body);
                        }
                        console.log(`Mensaje con imagen y texto enviado a revisión ${reviewGroup.name}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error al procesar el mensaje:", error);
    }
});

// Función para obtener el grupo de destino
async function obtenerGrupo(nombreGrupo, client) {
    const chats = await client.getChats();
    return chats.find((chat) => chat.name === nombreGrupo);
}

// Inicializar cliente de WhatsApp
client.initialize();

// Servidor HTTP necesario para Vercel
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot de WhatsApp ejecutándose."));
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
