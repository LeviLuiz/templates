const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const raiz = path.join(__dirname, "..");

function criarStorage(valores = {}) {
    const dados = new Map(Object.entries(valores));
    return {
        dados,
        getItem: (chave) => dados.has(chave) ? dados.get(chave) : null,
        setItem: (chave, valor) => dados.set(chave, String(valor)),
        removeItem: (chave) => dados.delete(chave),
    };
}

function elemento(id, handlers) {
    return {
        id,
        value: id === "segmento" ? "restaurante" : id === "cidade" ? "São Paulo" : "",
        textContent: "",
        hidden: false,
        disabled: false,
        addEventListener: (evento, fn) => handlers.set(`${id}:${evento}`, fn),
        appendChild() {},
    };
}

test("script.js salva o telefone WhatsApp como número, não como true/false", async () => {
    const handlers = new Map();
    const ids = ["buscar", "segmento", "cidade", "status", "contador", "empresa-atual", "nao", "sim", "enviar", "proxima", "emp-nome", "emp-nota", "emp-categoria", "emp-endereco", "emp-motivo", "emp-contato", "emp-site"];
    const elementos = Object.fromEntries(ids.map((id) => [id, elemento(id, handlers)]));
    const storage = criarStorage();
    const empresa = {
        nome: "Restaurante Central",
        whatsapp: "5511912345678",
        celular: "5511912345678",
        telefoneNormalizado: "5511912345678",
        categoria: "restaurant",
        endereco: "Rua Central, 1",
        nota: 80,
        podeEnviar: true,
    };
    const contexto = {
        URLSearchParams,
        localStorage: storage,
        document: { getElementById: (id) => elementos[id] || null },
        fetch: async () => ({ ok: true, json: async () => ({ empresas: [empresa] }) }),
        console,
        Date,
        window: { location: {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(raiz, "js/script.js"), "utf8"), contexto);
    await handlers.get("buscar:click")();
    handlers.get("sim:click")();

    assert.equal(storage.getItem("whatsapp"), "5511912345678");
    assert.equal(JSON.parse(storage.getItem("empresaProposta")).whatsapp, "5511912345678");
});

test("proposta.js recupera o número salvo quando o objeto selecionado não o contém", () => {
    const handlers = new Map();
    const ids = ["empresa", "mensagem", "gerar", "whatsapp", "visualizar-template", "proxima"];
    const elementos = Object.fromEntries(ids.map((id) => [id, elemento(id, handlers)]));
    const empresa = { nome: "Restaurante Central", categoria: "restaurant", segmento: "restaurante" };
    const storage = criarStorage({
        filaProspeccao: JSON.stringify([empresa]),
        indiceProspeccao: "0",
        empresaProposta: JSON.stringify(empresa),
        whatsapp: "5511912345678",
    });
    const contexto = {
        URL,
        URLSearchParams,
        document: { getElementById: (id) => elementos[id] || null },
        localStorage: storage,
        window: { location: { href: "https://leviluiz.github.io/templates/proposta.html" }, open() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(raiz, "js/proposta.js"), "utf8"), contexto);

    assert.equal(elementos.whatsapp.disabled, false);
    handlers.get("whatsapp:click")();
});

test("proposta.js ignora os valores booleanos antigos gravados como WhatsApp", () => {
    for (const legado of ["true", "false", "1"]) {
        const handlers = new Map();
        const ids = ["empresa", "mensagem", "gerar", "whatsapp", "visualizar-template", "proxima"];
        const elementos = Object.fromEntries(ids.map((id) => [id, elemento(id, handlers)]));
        const empresa = { nome: "Comércio sem celular", segmento: "loja", categoria: "shop" };
        const storage = criarStorage({
            filaProspeccao: JSON.stringify([empresa]),
            indiceProspeccao: "0",
            empresaProposta: JSON.stringify(empresa),
            whatsapp: legado,
        });
        const contexto = {
            URL,
            URLSearchParams,
            document: { getElementById: (id) => elementos[id] || null },
            localStorage: storage,
            window: { location: { href: "https://leviluiz.github.io/templates/proposta.html" }, open() {} },
        };
        vm.runInNewContext(fs.readFileSync(path.join(raiz, "js/proposta.js"), "utf8"), contexto);
        assert.equal(elementos.whatsapp.disabled, true, `valor legado ${legado} não é um telefone`);
        assert.equal(storage.getItem("whatsapp"), "");
    }
});

test("telefone fixo normalizado não habilita o botão de WhatsApp", () => {
    const handlers = new Map();
    const ids = ["empresa", "mensagem", "gerar", "whatsapp", "visualizar-template", "proxima"];
    const elementos = Object.fromEntries(ids.map((id) => [id, elemento(id, handlers)]));
    const empresa = {
        nome: "Comércio com telefone fixo",
        segmento: "loja",
        categoria: "shop",
        telefoneNormalizado: "551133334444",
    };
    const storage = criarStorage({
        filaProspeccao: JSON.stringify([empresa]),
        indiceProspeccao: "0",
        empresaProposta: JSON.stringify(empresa),
    });
    const contexto = {
        URL,
        URLSearchParams,
        document: { getElementById: (id) => elementos[id] || null },
        localStorage: storage,
        window: { location: { href: "https://leviluiz.github.io/templates/proposta.html" }, open() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(raiz, "js/proposta.js"), "utf8"), contexto);

    assert.equal(elementos.whatsapp.disabled, true);
    assert.equal(storage.getItem("whatsapp"), "");
});

test("avançar para empresa sem WhatsApp limpa o telefone anterior", () => {
    const handlers = new Map();
    const ids = ["empresa", "mensagem", "gerar", "whatsapp", "visualizar-template", "proxima"];
    const elementos = Object.fromEntries(ids.map((id) => [id, elemento(id, handlers)]));
    const primeira = { nome: "Comércio A", segmento: "loja", categoria: "shop", whatsapp: "5511912345678" };
    const segunda = { nome: "Comércio B", segmento: "loja", categoria: "shop" };
    const storage = criarStorage({
        filaProspeccao: JSON.stringify([primeira, segunda]),
        indiceProspeccao: "0",
        empresaProposta: JSON.stringify(primeira),
        whatsapp: primeira.whatsapp,
    });
    const contexto = {
        URL,
        URLSearchParams,
        document: { getElementById: (id) => elementos[id] || null },
        localStorage: storage,
        window: { location: { href: "https://leviluiz.github.io/templates/proposta.html" }, open() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(raiz, "js/proposta.js"), "utf8"), contexto);
    handlers.get("proxima:click")();

    assert.equal(storage.getItem("whatsapp"), "");
    assert.equal(elementos.whatsapp.disabled, true);
});
