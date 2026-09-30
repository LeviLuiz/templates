const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
const { buscarEmpresas } = require("./buscar-e-avaliar");

dotenv.config();

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});