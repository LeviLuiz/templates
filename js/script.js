const botaoBuscar = document.getElementById("buscar");
const segmentoInput = document.getElementById("segmento");
const cidadeInput = document.getElementById("cidade");
const statusEl = document.getElementById("status");
const contador = document.getElementById("contador");
const empresaAtual = document.getElementById("empresa-atual");
const botaoNao = document.getElementById("nao");
const botaoSim = document.getElementById("sim");
const botaoEnviar = document.getElementById("enviar");
const botaoProximo = document.getElementById("proxima");

const empNome = document.getElementById("emp-nome");
const empNota = document.getElementById("emp-nota");
const empCategoria = document.getElementById("emp-categoria");
const empEndereco = document.getElementById("emp-endereco");
const empMotivo = document.getElementById("emp-motivo");
const empContato = document.getElementById("emp-contato");
const empSite = document.getElementById("emp-site");

const DIAS_BLOQUEIO = 30;

let empresas = [];
let indiceAtual = 0;

botaoBuscar.addEventListener("click", buscarEmpresas);
botaoNao.addEventListener("click", rejeitarEmpresa);
botaoSim.addEventListener("click", aceitarEmpresa);
botaoEnviar.addEventListener("click", enviarWhatsApp);
botaoProximo.addEventListener("click", pularEmpresa);

segmentoInput.addEventListener("keydown", enviarSeEnter);
cidadeInput.addEventListener("keydown", enviarSeEnter);

function enviarSeEnter(evento) {
    if (evento.key === "Enter") {
        buscarEmpresas();
    }
}

async function buscarEmpresas() {
    const segmento = segmentoInput.value.trim();
    const cidade = cidadeInput.value.trim();

    if (!segmento || !cidade) {
        statusEl.textContent = "Informe o segmento e a cidade.";
        return;
    }

    statusEl.textContent = "Buscando empresas...";
    contador.textContent = "";
    empresaAtual.hidden = true;
    botaoNao.disabled = true;
    botaoSim.disabled = true;
    botaoEnviar.disabled = true;
    botaoProximo.disabled = true;

    try {
        const url = `/buscar?segmento=${encodeURIComponent(segmento)}&cidade=${encodeURIComponent(cidade)}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || dados.mensagem || "Erro na busca.");
        }

        empresas = (dados.empresas || []).filter((empresa) => !estaBloqueada(empresa));
        empresas.sort((a, b) => {
            if (b.podeEnviar !== a.podeEnviar) {
                return Number(b.podeEnviar) - Number(a.podeEnviar);
            }
            return b.nota - a.nota;
        });

        indiceAtual = 0;
        localStorage.removeItem("filaProspeccao");
        localStorage.removeItem("indiceProspeccao");

        if (empresas.length === 0) {
            statusEl.textContent = "Nenhuma empresa disponível para triagem.";
            return;
        }

        const enviaveis = empresas.filter((empresa) => empresa.podeEnviar).length;
        statusEl.textContent = `${empresas.length} empresas disponíveis. ${enviaveis} com WhatsApp.`;
        mostrarEmpresa();
    } catch (erro) {
        console.error(erro);
        statusEl.textContent = erro.message || "Erro ao buscar empresas.";
    }
}

function textoMotivo(empresa) {
    if (empresa.motivoSite === "sem_site") {
        return "Ainda não tem site próprio.";
    }
    if (empresa.motivoSite === "so_rede_social") {
        return "O contato aparece só em rede social.";
    }
    if (empresa.site) {
        return "Já tem site cadastrado.";
    }
    return "Precisa conferir o site.";
}

function mostrarEmpresa() {
    if (indiceAtual >= empresas.length) {
        empNome.textContent = "Fim da lista";
        empNota.textContent = "";
        empCategoria.textContent = "";
        empEndereco.textContent = "Você terminou a triagem dessas empresas.";
        empMotivo.textContent = "";
        empContato.textContent = "";
        empSite.textContent = "";
        contador.textContent = "Nenhuma empresa restante.";
        empresaAtual.hidden = false;
        botaoNao.disabled = true;
        botaoSim.disabled = true;
        botaoEnviar.disabled = true;
        botaoProximo.disabled = true;
        return;
    }

    const empresa = empresas[indiceAtual];
    const telefone = empresa.celular || empresa.whatsapp || empresa.telefone || "Telefone não informado";

    contador.textContent = `${indiceAtual + 1} de ${empresas.length}`;
    empNome.textContent = empresa.nome || "Nome não informado";
    empNota.textContent = `Nota ${empresa.nota ?? "—"}/100`;
    empCategoria.textContent = empresa.categoria || "Categoria não informada";
    empEndereco.textContent = empresa.endereco || "Endereço não informado";
    empMotivo.textContent = textoMotivo(empresa);
    empContato.textContent = telefone;

    if (empresa.site) {
        empSite.innerHTML = "";
        const link = document.createElement("a");
        link.href = empresa.site;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = empresa.site;
        empSite.appendChild(link);
    } else {
        empSite.textContent = "Sem site cadastrado";
    }

    empresaAtual.hidden = false;
    botaoNao.disabled = false;
    botaoSim.disabled = false;
    botaoProximo.disabled = false;
    botaoEnviar.disabled = !empresa.podeEnviar;
}

function rejeitarEmpresa() {
    const empresa = empresas[indiceAtual];
    if (!empresa) {
        return;
    }
    bloquearEmpresa(empresa);
    proximaEmpresa();
}

function aceitarEmpresa() {
    const empresa = empresas[indiceAtual];
    if (!empresa) {
        return;
    }

    localStorage.setItem("filaProspeccao", JSON.stringify(empresas));
    localStorage.setItem("indiceProspeccao", String(indiceAtual));
    localStorage.setItem("empresaProposta", JSON.stringify(empresa));
    window.location.href = "proposta.html";
}

function pularEmpresa() {
    proximaEmpresa();
}

function montarMensagem(empresa) {
    const onde = empresa.endereco && empresa.endereco !== "Endereço não informado"
        ? ` (${empresa.endereco})`
        : "";
    const motivo = textoMotivo(empresa).toLowerCase();

    return (
        `Olá, tudo bem? Vi a ${empresa.nome}${onde} e notei que ${motivo} ` +
        `Faço site simples para comércio: horário, fotos, mapa e botão de WhatsApp. ` +
        `Quer que eu te mostre um exemplo de 1 página?`
    );
}

function enviarWhatsApp() {
    const empresa = empresas[indiceAtual];
    if (!empresa) {
        return;
    }

    const numero = empresa.celular || empresa.whatsapp || empresa.telefoneNormalizado;
    if (!numero) {
        statusEl.textContent = "Essa empresa não tem celular para WhatsApp.";
        return;
    }

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagem(empresa))}`;
    window.open(url, "_blank", "noopener,noreferrer");
}

function proximaEmpresa() {
    indiceAtual += 1;
    localStorage.setItem("indiceProspeccao", String(indiceAtual));
    mostrarEmpresa();
}

function bloquearEmpresa(empresa) {
    const bloqueadas = obterBloqueadas().filter(
        (item) => item.id !== identificarEmpresa(empresa),
    );

    bloqueadas.push({
        id: identificarEmpresa(empresa),
        nome: empresa.nome,
        bloqueadoAte: Date.now() + DIAS_BLOQUEIO * 24 * 60 * 60 * 1000,
    });

    localStorage.setItem("empresasBloqueadas", JSON.stringify(bloqueadas));
}

function estaBloqueada(empresa) {
    const bloqueadas = obterBloqueadas();
    const id = identificarEmpresa(empresa);
    const bloqueio = bloqueadas.find((item) => item.id === id);

    if (!bloqueio) {
        return false;
    }

    if (bloqueio.bloqueadoAte > Date.now()) {
        return true;
    }

    localStorage.setItem(
        "empresasBloqueadas",
        JSON.stringify(bloqueadas.filter((item) => item.id !== id)),
    );
    return false;
}

function identificarEmpresa(empresa) {
    if (empresa.osm_id) {
        return `osm:${empresa.osm_tipo || "nwr"}/${empresa.osm_id}`;
    }
    return (`nome:${empresa.nome || ""}|telefone:${empresa.telefone || ""}`).toLowerCase();
}

function obterBloqueadas() {
    try {
        return JSON.parse(localStorage.getItem("empresasBloqueadas")) || [];
    } catch {
        return [];
    }
}

function continuarFilaSalva() {
    const filaDados = localStorage.getItem("filaProspeccao");
    const indiceDados = localStorage.getItem("indiceProspeccao");

    if (!filaDados || indiceDados === null) {
        return false;
    }

    try {
        const fila = JSON.parse(filaDados);
        const indice = Number(indiceDados);

        if (!Array.isArray(fila) || !fila.length || indice >= fila.length) {
            return false;
        }

        empresas = fila;
        indiceAtual = indice;
        statusEl.textContent = `${empresas.length} empresas na fila.`;
        mostrarEmpresa();
        return true;
    } catch {
        return false;
    }
}

if (!continuarFilaSalva()) {
    statusEl.textContent = "Informe o segmento e a cidade.";
}