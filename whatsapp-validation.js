const path = require("node:path");

const AUTH_DIR = path.join(__dirname, ".baileys_auth");
const INTERVALO_CONSULTA_MS = 2000;
const LIMITE_FILA = 30;
const DDDS_BR = new Set([
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24",
    "27", "28", "31", "32", "33", "34", "35", "37", "38", "41", "42", "43",
    "44", "45", "46", "47", "48", "49", "51", "53", "54", "55", "61", "62",
    "63", "64", "65", "66", "67", "68", "69", "71", "73", "74", "75", "77",
    "79", "81", "82", "83", "84", "85", "86", "87", "88", "89", "91", "92",
    "93", "94", "95", "96", "97", "98", "99",
]);

let sockAtual = null;
let baileysApi = null;
let estadoConexao = "desconectado";
let fila = [];
let processando = false;
let ultimaConsulta = 0;
let reconexaoAgendada = false;
const cacheResultados = new Map();

function normalizarTelefoneWhatsAppBR(valor) {
    if (typeof valor !== "string" && typeof valor !== "number") return null;
    const original = String(valor).trim();
    if (!original || !/^[+\d\s().-]+$/.test(original)) return null;

    const digitos = original.replace(/\D/g, "");
    if (!digitos) return null;
    const numeroNacionalValido = (nacional) => {
        if (!DDDS_BR.has(nacional.slice(0, 2))) return false;
        const assinante = nacional.slice(2);
        return /^[2-9]\d{7}$/.test(assinante) || /^9\d{8}$/.test(assinante);
    };

    // Não remova prefixos de operadora/longa distância nem acrescente o 9º dígito.
    if (original.startsWith("+")) {
        if (!digitos.startsWith("55")) return null;
        const nacional = digitos.slice(2);
        if (!numeroNacionalValido(nacional)) return null;
        return `+${digitos}`;
    }

    if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
        const nacional = digitos.slice(2);
        if (!numeroNacionalValido(nacional)) return null;
        return `+${digitos}`;
    }

    if (digitos.length === 10 || digitos.length === 11) {
        if (!numeroNacionalValido(digitos)) return null;
        return `+55${digitos}`;
    }

    return null;
}

function obterEstado() {
    return { connected: estadoConexao === "conectado", status: estadoConexao };
}

function interpretarResultadoRegistro(registros) {
    const registro = Array.isArray(registros) ? registros[0] : null;
    if (registro?.exists === true) return { exists: true, status: "yes" };
    if (registro?.exists === false) return { exists: false, status: "no" };
    return { exists: null, status: "unknown" };
}

async function consultarRegistro(sock, numero) {
    const registros = await sock.onWhatsApp(numero);
    const digitosAlvo = numero.replace(/\D/g, "");
    const registro = Array.isArray(registros)
        ? registros.find((item) => String(item.jid || "").replace(/\D/g, "").startsWith(digitosAlvo)) || registros[0]
        : null;
    return interpretarResultadoRegistro(registro ? [registro] : null);
}

async function iniciarConexao() {
    if (sockAtual || estadoConexao === "iniciando") return;
    estadoConexao = "iniciando";

    try {
        // Baileys 6.7.24 é ESM; import dinâmico mantém o restante do app CommonJS.
        baileysApi = baileysApi || await import("@whiskeysockets/baileys");
        const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileysApi;
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const qrcode = require("qrcode-terminal");
        const sock = makeWASocket({ auth: state, printQRInTerminal: false });
        sockAtual = sock;

        sock.ev.on("creds.update", saveCreds);
        sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
            if (qr) {
                estadoConexao = "aguardando_qr";
                console.log("\nEscaneie este QR code no WhatsApp (Aparelhos conectados):");
                qrcode.generate(qr, { small: true });
            }

            if (connection === "open") {
                estadoConexao = "conectado";
                console.log("WhatsApp conectado. Consultas de registro habilitadas.");
            }

            if (connection === "close") {
                sockAtual = null;
                const codigo = lastDisconnect?.error?.output?.statusCode;
                const deslogado = codigo === DisconnectReason.loggedOut;
                estadoConexao = deslogado ? "desconectado" : "reconectando";
                if (!deslogado && !reconexaoAgendada) {
                    reconexaoAgendada = true;
                    setTimeout(() => {
                        reconexaoAgendada = false;
                        iniciarConexao();
                    }, 3000).unref?.();
                }
            }
        });
    } catch (erro) {
        sockAtual = null;
        estadoConexao = "indisponivel";
        console.error("Não foi possível iniciar Baileys:", erro.message);
    }
}

function aguardar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processarFila() {
    if (processando) return;
    processando = true;

    while (fila.length) {
        const item = fila.shift();
        try {
            const espera = Math.max(0, INTERVALO_CONSULTA_MS - (Date.now() - ultimaConsulta));
            if (espera) await aguardar(espera);
            if (!sockAtual || estadoConexao !== "conectado") {
                item.resolve({ exists: null, status: "unknown" });
                continue;
            }

            ultimaConsulta = Date.now();
            const resposta = await consultarRegistro(sockAtual, item.numero);

            if (resposta.status !== "unknown") {
                cacheResultados.set(item.numero, { ...resposta, at: Date.now() });
                item.resolve(resposta);
            } else {
                item.resolve(resposta);
            }
        } catch (erro) {
            console.warn("Consulta de registro WhatsApp indisponível:", erro.message);
            item.resolve({ exists: null, status: "unknown" });
        }
    }

    processando = false;
}

function validarTelefone(valor) {
    const numero = normalizarTelefoneWhatsAppBR(valor);
    if (!numero) return Promise.resolve({ exists: null, status: "unknown" });

    const cache = cacheResultados.get(numero);
    if (cache && Date.now() - cache.at < 60 * 60 * 1000) {
        return Promise.resolve({ exists: cache.exists, status: cache.status });
    }
    if (!sockAtual || estadoConexao !== "conectado") {
        return Promise.resolve({ exists: null, status: "unknown" });
    }
    if (fila.length >= LIMITE_FILA) {
        return Promise.resolve({ exists: null, status: "unknown" });
    }

    return new Promise((resolve) => {
        fila.push({ numero, resolve });
        processarFila();
    });
}

module.exports = {
    normalizarTelefoneWhatsAppBR,
    interpretarResultadoRegistro,
    consultarRegistro,
    obterEstado,
    iniciarConexao,
    validarTelefone,
};
