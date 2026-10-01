const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const {
    geocodificarLocal,
    montarFiltrosOverpass,
    transformarElemento,
} = require("../buscar-e-avaliar");

test("consulta por segmento conhecido exige nome e restringe a categoria", () => {
    const consulta = montarFiltrosOverpass("padaria", [-23.6, -46.8, -23.4, -46.5]);
    assert.match(consulta, /nwr\["shop"~"\^\(bakery\)\$"\]\["name"\]/);
    assert.match(consulta, /out center tags;/);
});

test("consulta estadual usa a fronteira da relação OSM, não a caixa retangular", () => {
    const consulta = montarFiltrosOverpass("padaria", [-34, -74, 5, -34], 12345, 40);
    assert.match(consulta, /\[timeout:40\]/);
    assert.match(consulta, /rel\(12345\)->\.limite;/);
    assert.match(consulta, /\.limite map_to_area->\.busca;/);
    assert.match(consulta, /nwr\["shop"~"\^\(bakery\)\$"\]\["name"\]\(area\.busca\);/);
    assert.doesNotMatch(consulta, /-34,-74,5,-34/);
});

test("aceita sigla de estado e geocodifica com busca estruturada", async () => {
    const getOriginal = axios.get;
    let parametrosRecebidos;
    axios.get = async (_url, opcoes) => {
        parametrosRecebidos = opcoes.params;
        return { data: [{
            display_name: "São Paulo, Brasil",
            addresstype: "state",
            osm_type: "relation",
            osm_id: 12345,
            boundingbox: ["-34", "-20", "-54", "-44"],
        }] };
    };

    try {
        const local = await geocodificarLocal("SP");
        assert.equal(parametrosRecebidos.state, "São Paulo");
        assert.equal(parametrosRecebidos.country, "Brasil");
        assert.equal(parametrosRecebidos.q, undefined);
        assert.equal(local.tipo, "state");
        assert.equal(local.areaId, 12345);
    } finally {
        axios.get = getOriginal;
    }
});

test("transforma comércio válido e calcula nota e elegibilidade", () => {
    const empresa = transformarElemento({
        type: "node",
        id: 123,
        lat: -23.5,
        lon: -46.6,
        tags: {
            name: "Padaria Central",
            shop: "bakery",
            phone: "+55 11 91234-5678",
            "addr:street": "Rua A",
            "addr:city": "São Paulo",
        },
    }, "padaria");

    assert.equal(empresa.nome, "Padaria Central");
    assert.equal(empresa.celular, "5511912345678");
    assert.equal(empresa.podeEnviar, true);
    assert.equal(empresa.nota, 80);
    assert.equal(empresa.latitude, -23.5);
});

test("remove elementos sem nome e categorias não comerciais", () => {
    assert.equal(transformarElemento({ tags: { shop: "bakery" } }, "padaria"), null);
    assert.equal(transformarElemento({ tags: { name: "Escola", amenity: "school" } }, "padaria"), null);
    assert.equal(transformarElemento({ tags: { name: "Prefeitura", shop: "bakery" } }, "padaria"), null);
});

test("mantém lavanderia como comércio válido", () => {
    const empresa = transformarElemento({
        type: "node",
        id: 456,
        tags: { name: "Lavanderia Limpa", amenity: "laundry" },
    }, "lavanderia");

    assert.equal(empresa.nome, "Lavanderia Limpa");
    assert.equal(empresa.podeEnviar, false);
});
