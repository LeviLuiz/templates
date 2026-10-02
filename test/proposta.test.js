const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");

const raiz = path.join(__dirname, "..");
const propostaScript = fs.readFileSync(path.join(raiz, "js/proposta.js"), "utf8");

function abrirProposta(empresa) {
    const handlers = new Map();
    const abertos = [];
    const ids = ["empresa", "mensagem", "gerar", "whatsapp", "visualizar-template", "proxima"];
    const elementos = Object.fromEntries(ids.map((id) => [id, {
        id,
        value: "",
        disabled: false,
        classList: { toggle() {} },
        addEventListener(evento, callback) {
            handlers.set(`${id}:${evento}`, callback);
        },
    }]));
    const local = new Map([
        ["filaProspeccao", JSON.stringify([empresa])],
        ["indiceProspeccao", "0"],
        ["empresaProposta", JSON.stringify(empresa)],
    ]);
    const contexto = {
        URL,
        URLSearchParams,
        console,
        document: { getElementById: (id) => elementos[id] || null },
        localStorage: {
            getItem: (chave) => local.get(chave) ?? null,
            setItem: (chave, valor) => local.set(chave, valor),
            removeItem: (chave) => local.delete(chave),
        },
        window: {
            location: { href: "https://leviluiz.github.io/templates/proposta.html", hostname: "leviluiz.github.io" },
            open: (url) => abertos.push(url),
        },
    };
    vm.runInNewContext(propostaScript, contexto);
    return { elementos, handlers, abertos };
}

const exemplos = [
    ["padaria", "bakery", "padaria.html"],
    ["salão", "hairdresser", "salao.html"],
    ["oficina", "car_repair", "oficina.html"],
    ["restaurante", "restaurant", "restaurante.html"],
    ["supermercado", "supermarket", "supermercado.html"],
    ["hortifruti", "greengrocer", "hortifruti.html"],
    ["sacolão", "greengrocer", "hortifruti.html"],
    ["papelaria", "stationery", "loja.html"],
];

for (const [segmento, categoria, arquivo] of exemplos) {
    test(`gera e abre a demonstração correta para ${segmento}`, () => {
        const empresa = {
            nome: "Comércio São José",
            segmento,
            categoria,
            endereco: "Rua Central, 42, São Paulo",
            celular: "5511912345678",
            telefone: "+55 11 91234-5678",
            precisaDeSite: true,
            motivoSite: "sem_site",
        };
        const { elementos, handlers, abertos } = abrirProposta(empresa);
        const mensagem = elementos.mensagem.value;
        const link = mensagem.match(/https:\/\/leviluiz\.github\.io\/templates\/templates\/[^\s]+/)[0];
        const url = new URL(link);

        assert.equal(url.pathname, `/templates/templates/${arquivo}`);
        assert.equal(url.searchParams.get("nome"), empresa.nome);
        assert.equal(url.searchParams.get("endereco"), empresa.endereco);
        assert.equal(url.searchParams.get("whatsapp"), empresa.celular);

        handlers.get("visualizar-template:click")();
        assert.equal(abertos[0], link);

        handlers.get("whatsapp:click")();
        const whatsapp = new URL(abertos[1]);
        assert.equal(whatsapp.hostname, "wa.me");
        assert.equal(whatsapp.pathname, `/${empresa.celular}`);
        assert.ok(whatsapp.searchParams.get("text").includes(link));
    });
}

test("todos os modelos carregam o script base e o Pages publica arquivos com underscore", () => {
    assert.ok(fs.existsSync(path.join(raiz, ".nojekyll")));
    for (const [, , arquivo] of exemplos) {
        const html = fs.readFileSync(path.join(raiz, "templates", arquivo), "utf8");
        assert.match(html, /<script\s+src="_base\.js"><\/script>/);
    }
});

test("servidor estático entrega os cinco modelos e templates/_base.js", async (t) => {
    const app = express();
    app.use(express.static(raiz));
    const servidor = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve, reject) => {
        servidor.close((erro) => erro ? reject(erro) : resolve());
    }));
    await new Promise((resolve) => servidor.once("listening", resolve));

    const base = `http://127.0.0.1:${servidor.address().port}`;
    for (const [, , arquivo] of exemplos) {
        const resposta = await fetch(`${base}/templates/${arquivo}`);
        assert.equal(resposta.status, 200, `${arquivo} deve ser servido`);
        assert.match(await resposta.text(), /src="_base\.js"/);
    }

    const script = await fetch(`${base}/templates/_base.js`);
    assert.equal(script.status, 200, "_base.js deve estar acessível por HTTP");
});

test("_base.js preenche dados, WhatsApp, mapa e telefone a partir da URL", () => {
    const baseScript = fs.readFileSync(path.join(raiz, "templates/_base.js"), "utf8");
    const campos = ["nome", "nome", "categoria", "endereco", "horario"]
        .map((chave, indice) => ({ tagName: indice === 0 ? "TITLE" : "P", chave, textContent: "" }));
    const whatsapp = [{ style: {}, href: "" }];
    const mapas = [{ href: "" }];
    const telefones = [{ style: {}, textContent: "", href: "" }];
    const atributos = (lista, attr) => lista.map((el) => ({
        ...el,
        getAttribute: () => el.chave,
        set textContent(valor) { el.textContent = valor; },
        get textContent() { return el.textContent; },
    }));
    const contexto = {
        URLSearchParams,
        encodeURIComponent,
        location: { search: "?nome=Mercado%20S%C3%A3o%20Jos%C3%A9&categoria=Mercado&endereco=Rua%20Central&telefone=%2B5511912345678&whatsapp=5511912345678" },
        document: {
            body: { dataset: {} },
            querySelectorAll(seletor) {
                if (seletor === "[data-campo]") return atributos(campos, "data-campo");
                if (seletor === "[data-whatsapp]") return whatsapp;
                if (seletor === "[data-mapa]") return mapas;
                if (seletor === "[data-tel]") return telefones;
                return [];
            },
        },
    };
    vm.runInNewContext(baseScript, contexto);
    assert.equal(campos[0].textContent, "Mercado São José");
    assert.equal(campos[1].textContent, "Mercado São José");
    assert.equal(campos[2].textContent, "Mercado");
    assert.equal(campos[3].textContent, "Rua Central");
    assert.ok(whatsapp[0].href.startsWith("https://wa.me/5511912345678?"));
    assert.match(mapas[0].href, /google\.com\/maps/);
    assert.equal(telefones[0].href, "tel:+5511912345678");
});
