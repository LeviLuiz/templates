const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
const { buscarEmpresas } = require("./buscar-e-avaliar");
const whatsappValidation = require("./whatsapp-validation");

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2kb" }));
app.use(express.static(path.join(__dirname)));

app.get("/geocodificar", async (req, res) => {
    try {
        const cidade = req.query.cidade?.trim();

        if (!cidade) {
            return res.status(400).json({
                erro: "Informe uma cidade.",
            });
        }

        const resposta = await axios.get(
            "https://nominatim.openstreetmap.org/search",
            {
                params: {
                    q: `${cidade}, Brasil`,
                    format: "json",
                    limit: 1,
                },
                headers: {
                    "User-Agent": "prospeccao-sites/1.0 (contato local)",
                },
                timeout: 10000,
            },
        );

        if (!resposta.data.length) {
            return res.status(404).json({
                erro: "Cidade não encontrada.",
            });
        }

        const local = resposta.data[0];

        res.json({
            cidade: local.display_name,
            latitude: Number(local.lat),
            longitude: Number(local.lon),
            boundingbox: local.boundingbox,
        });
    } catch (erro) {
        console.error("Erro no geocodificador:", erro.message);

        res.status(500).json({
            erro: "Erro ao localizar a cidade.",
            mensagem: erro.message,
        });
    }
});

app.get("/buscar", buscarEmpresas);

app.get("/whatsapp/status", (_req, res) => {
    res.json(whatsappValidation.obterEstado());
});

app.post("/whatsapp/validar", async (req, res) => {
    const enderecoRemoto = req.socket.remoteAddress;
    if (!new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]).has(enderecoRemoto)) {
        return res.status(403).json({ exists: null, status: "unknown" });
    }

    const numero = whatsappValidation.normalizarTelefoneWhatsAppBR(req.body?.telefone);
    if (!numero) {
        return res.status(400).json({ exists: null, status: "unknown" });
    }

    const resultado = await whatsappValidation.validarTelefone(numero);
    res.json(resultado);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    whatsappValidation.iniciarConexao();
});
