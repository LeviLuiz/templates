const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../js/script.js"), "utf8");

for (const caso of [
    { resultado: { exists: true, status: "yes" }, texto: "WhatsApp: SIM" },
    { resultado: { exists: false, status: "no" }, texto: "WhatsApp: NÃO" },
    { resultado: { exists: null, status: "unknown" }, texto: "WhatsApp: NÃO FOI POSSÍVEL VERIFICAR" },
]) {
    test(`interface mostra ${caso.resultado.status} sem converter unknown em NÃO`, async () => {
        const handlers = new Map();
        const elementos = {};
        for (const id of ["buscar", "segmento", "cidade", "status", "contador", "empresa-atual", "nao", "sim", "enviar", "proxima", "emp-nome", "emp-nota", "emp-categoria", "emp-endereco", "emp-motivo", "emp-contato", "emp-whatsapp", "emp-site"]) {
            elementos[id] = {
                value: id === "segmento" ? "padaria" : id === "cidade" ? "São Paulo" : "",
                textContent: "",
                dataset: {},
                hidden: false,
                disabled: false,
                addEventListener: (evento, fn) => handlers.set(`${id}:${evento}`, fn),
                appendChild() {},
            };
        }

        const empresa = {
            nome: "Padaria Central",
            telefoneEncontrado: "(11) 91234-5678",
            telefoneWhatsApp: "+5511912345678",
            categoria: "bakery",
            nota: 80,
            podeEnviar: true,
        };
        const storage = new Map([["segmentoPesquisa", "padaria"], ["localPesquisa", "S?o Paulo"]]);
        let telefoneConsultado;
        const contexto = {
            localStorage: {
                getItem: (chave) => storage.get(chave) ?? null,
                setItem: (chave, valor) => storage.set(chave, String(valor)),
                removeItem: (chave) => storage.delete(chave),
            },
            document: { getElementById: (id) => elementos[id] || null, createElement: () => ({}) },
            fetch: async (url, opcoes = {}) => {
                if (url === "/whatsapp/validar") {
                    telefoneConsultado = JSON.parse(opcoes.body).telefone;
                    return { ok: true, json: async () => caso.resultado };
                }
                return { ok: true, json: async () => ({ empresas: [empresa] }) };
            },
            console,
            Date,
            window: { location: {} },
        };

        vm.runInNewContext(script, contexto);
        await handlers.get("buscar:click")();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(telefoneConsultado, "+5511912345678");
        assert.equal(elementos["emp-contato"].textContent, "Telefone: (11) 91234-5678");
        assert.equal(elementos["emp-whatsapp"].textContent, caso.texto);
    });
}
