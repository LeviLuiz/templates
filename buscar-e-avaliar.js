const axios = require("axios");

const cacheLocais = new Map();
const OVERPASS_ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
];
let proximoEndpoint = 0;

const SEGMENTOS = {
    // Busca ampla para quem quer prospectar vários tipos de comércio de uma vez.
    comercio: {
        shop: ["*"],
        craft: ["*"],
        office: ["*"],
        amenity: ["restaurant", "fast_food", "cafe", "bar", "pub", "pharmacy", "clinic", "doctors", "dentist", "veterinary", "laundry", "car_wash", "fuel"],
        tourism: ["hotel", "guest_house"],
        leisure: ["fitness_centre"],
    },
    "estabelecimentos": {
        shop: ["*"],
        craft: ["*"],
        office: ["*"],
        amenity: ["restaurant", "fast_food", "cafe", "bar", "pub", "pharmacy", "clinic", "doctors", "dentist", "veterinary", "laundry", "car_wash", "fuel"],
        tourism: ["hotel", "guest_house"],
        leisure: ["fitness_centre"],
    },
    business: {
        shop: ["*"],
        craft: ["*"],
        office: ["*"],
        amenity: ["restaurant", "fast_food", "cafe", "bar", "pub", "pharmacy", "clinic", "doctors", "dentist", "veterinary", "laundry", "car_wash", "fuel"],
        tourism: ["hotel", "guest_house"],
        leisure: ["fitness_centre"],
    },
    padaria: { shop: ["bakery"] },
    confeitaria: { shop: ["bakery", "pastry", "confectionery"] },
    mercado: { shop: ["supermarket", "convenience", "greengrocer"] },
    market: { shop: ["supermarket", "convenience", "greengrocer"] },
    supermarket: { shop: ["supermarket"] },
    furniture: { shop: ["furniture"] },
    coffee: { amenity: ["cafe"] },
    mercearia: { shop: ["convenience", "greengrocer"] },
    acougue: { shop: ["butcher"] },
    "açougue": { shop: ["butcher"] },
    farmacia: { shop: ["chemist"], amenity: ["pharmacy"] },
    "farmácia": { shop: ["chemist"], amenity: ["pharmacy"] },
    restaurante: { amenity: ["restaurant", "fast_food"] },
    lanchonete: { amenity: ["fast_food", "cafe"] },
    cafe: { amenity: ["cafe"] },
    "café": { amenity: ["cafe"] },
    bar: { amenity: ["bar", "pub"] },
    oficina: { shop: ["car_repair", "motorcycle_repair"] },
    mecanica: { shop: ["car_repair"] },
    "mecânica": { shop: ["car_repair"] },
    autopecas: { shop: ["car_parts"] },
    "autopeças": { shop: ["car_parts"] },
    salao: { shop: ["hairdresser", "beauty"] },
    "salão": { shop: ["hairdresser", "beauty"] },
    barbearia: { shop: ["hairdresser"] },
    clinica: { amenity: ["clinic", "doctors", "dentist"] },
    "clínica": { amenity: ["clinic", "doctors", "dentist"] },
    dentista: { amenity: ["dentist"] },
    petshop: { shop: ["pet"] },
    "pet shop": { shop: ["pet"] },
    academia: { leisure: ["fitness_centre"] },
    hotel: { tourism: ["hotel", "guest_house"] },
    pousada: { tourism: ["guest_house", "hostel"] },
    loja: { shop: ["yes", "clothes", "gift", "variety"] },
    roupa: { shop: ["clothes", "fashion"] },
    calcado: { shop: ["shoes"] },
    "calçado": { shop: ["shoes"] },
    moveis: { shop: ["furniture"] },
    "móveis": { shop: ["furniture"] },
    eletro: { shop: ["electronics", "appliance"] },
    papelaria: { shop: ["stationery"] },
    floricultura: { shop: ["florist"] },
    lavanderia: { shop: ["laundry"], amenity: ["laundry"] },
    advocacia: { office: ["lawyer"] },
    contabilidade: { office: ["accountant"] },
    imobiliaria: { office: ["estate_agent"] },
    "imobiliária": { office: ["estate_agent"] },
};

const SIGLAS_ESTADOS = {
    ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas", ba: "Bahia",
    ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo", go: "Goiás",
    ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul", mg: "Minas Gerais",
    pa: "Pará", pb: "Paraíba", pr: "Paraná", pe: "Pernambuco", pi: "Piauí",
    rj: "Rio de Janeiro", rn: "Rio Grande do Norte", rs: "Rio Grande do Sul",
    ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina", sp: "São Paulo",
    se: "Sergipe", to: "Tocantins",
};

const AMENITIES_COMERCIAIS = new Set([
    "restaurant",
    "fast_food",
    "cafe",
    "bar",
    "pub",
    "pharmacy",
    "clinic",
    "doctors",
    "dentist",
    "veterinary",
    "laundry",
    "car_wash",
    "fuel",
    "bank",
    "atm",
]);

const AMENITIES_IGNORAR = new Set([
    "school",
    "college",
    "university",
    "kindergarten",
    "hospital",
    "place_of_worship",
    "townhall",
    "police",
    "fire_station",
    "courthouse",
    "prison",
    "library",
    "community_centre",
    "social_facility",
    "public_building",
]);

const OFFICES_IGNORAR = new Set([
    "government",
    "ngo",
    "association",
    "political_party",
    "religion",
    "educational_institution",
]);

const REDES_SOCIAIS = /instagram\.com|facebook\.com|fb\.com|linktr\.ee|bio\.site|tiktok\.com|twitter\.com|x\.com|wa\.me|api\.whatsapp\.com/i;

function escaparRegex(texto) {
    return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chaveSegmento(segmento) {
    return (segmento || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function mapaDoSegmento(segmento) {
    const original = (segmento || "").toLowerCase().trim();
    const semAcento = chaveSegmento(segmento);
    return SEGMENTOS[original] || SEGMENTOS[semAcento] || null;
}

function montarFiltrosOverpass(segmento, bbox, areaId = null, timeout = 25) {
    const [latMin, lonMin, latMax, lonMax] = bbox;
    const recorte = areaId ? "(area.busca)" : `(${latMin},${lonMin},${latMax},${lonMax})`;
    const prepararArea = areaId
        ? `rel(${areaId})->.limite;\n.limite map_to_area->.busca;`
        : "";
    const mapa = mapaDoSegmento(segmento);
    const blocos = [];

    if (mapa) {
        for (const [chave, valores] of Object.entries(mapa)) {
            if (valores.includes("*")) {
                blocos.push(`nwr["${chave}"]["name"]${recorte};`);
                continue;
            }
            const lista = valores.map(escaparRegex).join("|");
            blocos.push(`nwr["${chave}"~"^(${lista})$"]["name"]${recorte};`);
        }
    } else {
        const termo = escaparRegex(segmento);
        blocos.push(
            `nwr["shop"]["name"~"${termo}",i]${recorte};`,
            `nwr["craft"]["name"~"${termo}",i]${recorte};`,
            `nwr["office"]["name"~"${termo}",i]${recorte};`,
            `nwr["amenity"~"restaurant|fast_food|cafe|bar|pub|pharmacy|clinic|dentist"]["name"~"${termo}",i]${recorte};`,
        );
    }

    return `
[out:json][timeout:${timeout}];
${prepararArea}
(
${blocos.join("\n")}
);
out center tags;
`.trim();
}

async function geocodificarLocal(localInformado) {
    const chave = localInformado.toLocaleLowerCase("pt-BR").trim();
    if (cacheLocais.has(chave)) {
        return cacheLocais.get(chave);
    }

    const sigla = chave.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const estado = SIGLAS_ESTADOS[sigla]
        || Object.values(SIGLAS_ESTADOS).find((nome) => chaveSegmento(nome) === sigla)
        || null;
    const parametros = {
        format: "json",
        limit: 1,
        addressdetails: 1,
        countrycodes: "br",
    };
    if (estado) {
        parametros.state = estado;
        parametros.country = "Brasil";
    } else {
        parametros.q = `${localInformado}, Brasil`;
    }

    const resposta = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
            params: parametros,
            headers: {
                "User-Agent": "prospeccao-sites/1.0 (contato local)",
            },
            timeout: 10000,
        },
    );

    if (!resposta.data.length) {
        return null;
    }

    const local = resposta.data[0];
    const boundingbox = local.boundingbox.map(Number);
    const tipoLocal = estado ? "state" : local.addresstype || local.type || "local";
    const areaId = local.osm_type === "relation"
        && /^(state|city|town|village|municipality|county)$/i.test(tipoLocal)
        && /^\d+$/.test(String(local.osm_id))
        ? Number(local.osm_id)
        : null;
    const resultado = {
        nome: local.display_name,
        tipo: tipoLocal,
        areaId,
        latitudeMin: boundingbox[0],
        latitudeMax: boundingbox[1],
        longitudeMin: boundingbox[2],
        longitudeMax: boundingbox[3],
    };

    cacheLocais.set(chave, resultado);
    return resultado;
}

async function consultarOverpass(consulta, timeoutMs = 16000) {
    let ultimoErro = null;
    // Tente no máximo dois espelhos por busca e alterne o primeiro para evitar
    // que uma indisponibilidade do espelho principal imponha até 112 s de espera.
    const inicio = proximoEndpoint++ % OVERPASS_ENDPOINTS.length;
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const endpoint = OVERPASS_ENDPOINTS[(inicio + tentativa) % OVERPASS_ENDPOINTS.length];
        try {
            const resposta = await axios.post(
                endpoint,
                new URLSearchParams({ data: consulta }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "prospeccao-sites/1.0 (contato local)",
                    },
                    timeout: timeoutMs,
                },
            );

            if (resposta.data?.elements) {
                return resposta.data.elements;
            }
        } catch (erro) {
            ultimoErro = erro;
        }
    }

    const falha = new Error("Overpass indisponível");
    falha.causa = ultimoErro;
    throw falha;
}

function primeiroValor(tags, chaves) {
    for (const chave of chaves) {
        if (tags[chave]) {
            return String(tags[chave]).trim();
        }
    }
    return null;
}

function soDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
}

function normalizarTelefoneBR(valor) {
    if (!valor) {
        return null;
    }

    let digitos = soDigitos(valor);
    if (!digitos) {
        return null;
    }

    if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
        return digitos;
    }

    if (digitos.startsWith("0")) {
        digitos = digitos.replace(/^0+/, "");
    }

    if (digitos.length === 10 || digitos.length === 11) {
        return `55${digitos}`;
    }

    return digitos.length >= 10 ? digitos : null;
}

function ehCelularBR(e164) {
    if (!e164) {
        return false;
    }
    // 55 + DDD(2) + 9 + 8 dígitos
    return /^55\d{2}9\d{8}$/.test(e164);
}

function classificarSite(url) {
    if (!url) {
        return { tipo: "nenhum", precisaDeSite: true };
    }

    if (REDES_SOCIAIS.test(url)) {
        return { tipo: "rede_social", precisaDeSite: true };
    }

    return { tipo: "proprio", precisaDeSite: false };
}

function ehFranquia(tags) {
    return Boolean(tags.brand || tags.brandwikidata || tags["brand:wikidata"]);
}

function deveIgnorar(tags, nome) {
    if (AMENITIES_IGNORAR.has(tags.amenity)) {
        return true;
    }

    if (OFFICES_IGNORAR.has(tags.office)) {
        return true;
    }

    const texto = `${nome} ${tags.operator || ""}`.toLowerCase();
    const palavras = [
        "prefeitura",
        "governo",
        "universidade",
        "unb",
        "escola municipal",
        "escola estadual",
        "hospital",
        "igreja",
        "secretaria",
        "câmara",
        "camara",
        "ministério",
        "ministerio",
    ];

    return palavras.some((palavra) => texto.includes(palavra));
}

function ehComercio(tags) {
    if (tags.shop || tags.craft) {
        return true;
    }

    if (tags.office && !OFFICES_IGNORAR.has(tags.office)) {
        return true;
    }

    if (tags.amenity && AMENITIES_COMERCIAIS.has(tags.amenity)) {
        return true;
    }

    if (tags.tourism === "hotel" || tags.tourism === "guest_house") {
        return true;
    }

    if (tags.leisure === "fitness_centre") {
        return true;
    }

    return false;
}

function montarEndereco(tags) {
    const partes = [
        tags["addr:street"],
        tags["addr:housenumber"],
        tags["addr:suburb"],
        tags["addr:city"],
    ].filter(Boolean);

    return {
        texto: partes.length ? partes.join(", ") : null,
        completo: Boolean(tags["addr:street"] && tags["addr:city"]),
    };
}

function avaliarEmpresa(empresa) {
    let nota = empresa.precisaDeSite ? 40 : -20;
    if (empresa.precisaDeSite && empresa.motivoSite === "sem_site") nota += 5;
    if (empresa.celular) nota += 25;
    else if (empresa.telefone) nota += 8;
    if (empresa.enderecoOk) nota += 10;
    else if (empresa.endereco) nota += 4;
    if (empresa.instagram && empresa.precisaDeSite) nota += 5;
    if (empresa.ehFranquia) nota -= 40;
    if (!empresa.categoria) nota -= 5;
    empresa.nota = Math.min(100, Math.max(0, nota));
    empresa.podeEnviar = Boolean(
        empresa.celular && empresa.precisaDeSite && !empresa.ehFranquia,
    );
    return empresa;
}

function transformarElemento(elemento, segmento) {
    const tags = elemento.tags || {};
    const nome = tags.name;

    if (!nome) {
        return null;
    }

    const site = primeiroValor(tags, [
        "website",
        "contact:website",
        "url",
        "contact:url",
        "website:mobile",
    ]);

    const classificacaoSite = classificarSite(site);

    const whatsappBruto = primeiroValor(tags, ["contact:whatsapp"]);
    const celularBruto = primeiroValor(tags, ["contact:mobile", "mobile"]);
    const telefoneBruto = primeiroValor(tags, ["phone", "contact:phone"]);

    const whatsapp = normalizarTelefoneBR(whatsappBruto);
    const celular = normalizarTelefoneBR(celularBruto);
    const telefone = normalizarTelefoneBR(telefoneBruto);
    const melhorNumero = whatsapp || celular || telefone;
    const temCelular = ehCelularBR(melhorNumero);

    const endereco = montarEndereco(tags);
    const categoria =
        tags.shop ||
        tags.craft ||
        tags.office ||
        tags.amenity ||
        tags.tourism ||
        tags.leisure ||
        null;

    let motivoSite = "tem_site";
    if (!site) {
        motivoSite = "sem_site";
    } else if (classificacaoSite.tipo === "rede_social") {
        motivoSite = "so_rede_social";
    }

    const empresa = {
        nome,
        endereco: endereco.texto || "Endereço não informado",
        enderecoOk: endereco.completo,
        latitude: elemento.lat ?? elemento.center?.lat ?? null,
        longitude: elemento.lon ?? elemento.center?.lon ?? null,
        osm_id: elemento.id,
        osm_tipo: elemento.type,
        site,
        telefone: telefoneBruto || null,
        telefoneNormalizado: melhorNumero,
        celular: temCelular ? melhorNumero : null,
        whatsapp: whatsapp || (temCelular ? melhorNumero : null),
        instagram: primeiroValor(tags, ["contact:instagram", "instagram"]),
        facebook: primeiroValor(tags, ["contact:facebook", "facebook"]),
        categoria,
        ehFranquia: ehFranquia(tags),
        precisaDeSite: classificacaoSite.precisaDeSite,
        motivoSite,
        operador: tags.operator || "",
        segmento,
    };
    if (!ehComercio(tags) || deveIgnorar(tags, nome)) {
        return null;
    }

    return avaliarEmpresa(empresa);
}

async function buscarEmpresas(req, res) {
    try {
        const segmento = req.query.segmento?.trim();
        const localInformado = (req.query.local || req.query.cidade)?.trim();

        if (!segmento || !localInformado) {
            return res.status(400).json({
                erro: "Informe segmento e cidade ou estado.",
            });
        }

        const local = await geocodificarLocal(localInformado);
        if (!local) {
            return res.status(404).json({
                erro: "Cidade não encontrada.",
            });
        }

        const consulta = montarFiltrosOverpass(segmento, [
            local.latitudeMin,
            local.longitudeMin,
            local.latitudeMax,
            local.longitudeMax,
        ], local.areaId, local.tipo === "state" ? 40 : 25);

        let elementos;
        try {
            elementos = await consultarOverpass(consulta, local.tipo === "state" ? 45000 : 16000);
        } catch (erro) {
            console.error("Overpass falhou:", erro.causa?.code || erro.message);
            return res.status(503).json({
                erro: "O serviço de busca está ocupado. Tente novamente.",
            });
        }

        const unicas = new Map();
        for (const elemento of elementos) {
            if (!elemento.tags?.name) {
                continue;
            }
            unicas.set(`${elemento.type}/${elemento.id}`, elemento);
        }

        const empresas = Array.from(unicas.values())
            .map((elemento) => transformarElemento(elemento, segmento))
            .filter(Boolean)
            .sort((a, b) => {
                if (b.podeEnviar !== a.podeEnviar) {
                    return Number(b.podeEnviar) - Number(a.podeEnviar);
                }
                return b.nota - a.nota;
            });

        res.json({
            segmento,
            cidade: local.nome,
            quantidade: empresas.length,
            enviaveis: empresas.filter((empresa) => empresa.podeEnviar).length,
            empresas,
        });
    } catch (erro) {
        console.error("Erro no /buscar:", erro.response?.data || erro.message);
        res.status(500).json({
            erro: "Não foi possível fazer a busca.",
            mensagem: erro.message,
        });
    }
}

module.exports = {
    buscarEmpresas,
    geocodificarLocal,
    montarFiltrosOverpass,
    transformarElemento,
};

/*
No server.js:

const { buscarEmpresas } = require("./buscar-e-avaliar");
app.get("/buscar", buscarEmpresas);
*/
