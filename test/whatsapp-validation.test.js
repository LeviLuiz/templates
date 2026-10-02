const test = require("node:test");
const assert = require("node:assert/strict");
const {
    normalizarTelefoneWhatsAppBR,
    interpretarResultadoRegistro,
    consultarRegistro,
    validarTelefone,
} = require("../whatsapp-validation");
const { transformarElemento } = require("../buscar-e-avaliar");

test("normaliza apenas números brasileiros reconhecíveis sem mudar seus dígitos", () => {
    assert.equal(normalizarTelefoneWhatsAppBR("(11) 91234-5678"), "+5511912345678");
    assert.equal(normalizarTelefoneWhatsAppBR("+55 11 3333-4444"), "+551133334444");
    assert.equal(normalizarTelefoneWhatsAppBR("5511912345678"), "+5511912345678");
    assert.equal(normalizarTelefoneWhatsAppBR("(55) 3333-4444"), "+555533334444");
    assert.equal(normalizarTelefoneWhatsAppBR("(10) 91234-5678"), null);
    assert.equal(normalizarTelefoneWhatsAppBR("011 91234-5678"), null);
    assert.equal(normalizarTelefoneWhatsAppBR("+44 20 1234 5678"), null);
});

test("empresa do Overpass carrega telefone encontrado e destino E.164 para consulta", () => {
    const empresa = transformarElemento({
        type: "node",
        id: 123,
        tags: {
            name: "Padaria Central",
            shop: "bakery",
            phone: "+55 (11) 91234-5678",
        },
    }, "padaria");

    assert.equal(empresa.telefoneEncontrado, "+55 (11) 91234-5678");
    assert.equal(empresa.telefoneWhatsApp, "+5511912345678");
});

test("consulta indisponível permanece unknown e não vira false", async () => {
    const resultado = await validarTelefone("+5511912345678");
    assert.deepEqual(resultado, { exists: null, status: "unknown" });
    assert.notEqual(resultado.exists, false);
});

test("interpreta os três resultados do onWhatsApp sem inferir quando a resposta falta", () => {
    assert.deepEqual(interpretarResultadoRegistro([{ exists: true }]), { exists: true, status: "yes" });
    assert.deepEqual(interpretarResultadoRegistro([{ exists: false }]), { exists: false, status: "no" });
    assert.deepEqual(interpretarResultadoRegistro([]), { exists: null, status: "unknown" });
    assert.deepEqual(interpretarResultadoRegistro([{ jid: "5511@s.whatsapp.net" }]), { exists: null, status: "unknown" });
});

test("fluxo Overpass para onWhatsApp usa o número normalizado e preserva unknown", async () => {
    const empresa = transformarElemento({
        type: "node",
        id: 456,
        tags: { name: "Comércio", shop: "bakery", phone: "(11) 91234-5678" },
    }, "padaria");
    let numeroConsultado;
    const socketFake = {
        onWhatsApp: async (numero) => {
            numeroConsultado = numero;
            return [{ jid: "5511912345678@s.whatsapp.net", exists: true }];
        },
    };

    const resultado = await consultarRegistro(socketFake, empresa.telefoneWhatsApp);
    assert.equal(numeroConsultado, "+5511912345678");
    assert.deepEqual(resultado, { exists: true, status: "yes" });

    socketFake.onWhatsApp = async () => [];
    assert.deepEqual(await consultarRegistro(socketFake, empresa.telefoneWhatsApp), {
        exists: null,
        status: "unknown",
    });
});
