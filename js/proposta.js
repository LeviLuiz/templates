const caixaEmpresa = document.getElementById("empresa");
const empNome = document.getElementById("emp-nome");
const empNota = document.getElementById("emp-nota");
const empCategoria = document.getElementById("emp-categoria");
const empEndereco = document.getElementById("emp-endereco");
const empMotivo = document.getElementById("emp-motivo");
const empContato = document.getElementById("emp-contato");
const empSite = document.getElementById("emp-site");
const mensagemEl = document.getElementById("mensagem");
const botaoGerar = document.getElementById("gerar");
const botaoWhatsApp = document.getElementById("whatsapp");
const botaoPreview = document.getElementById("visualizar-template");
const botaoProxima = document.getElementById("proxima");

let empresa = null;
let fila = [];
let indiceAtual = 0;

function on(el, evento, fn) {
    if (el) {
        el.addEventListener(evento, fn);
    }
}

function setDisabled(el, valor) {
    if (el) {
        el.disabled = valor;
    }
}

function setText(el, valor) {
    if (el) {
        el.textContent = valor;
    }
}

function textoMotivo(item) {
    if (!item) {
        return "";
    }
    if (item.motivoSite === "sem_site") {
        return "ainda não tem um site próprio";
    }
    if (item.motivoSite === "so_rede_social") {
        return "o contato aparece só em rede social";
    }
    return "pode ganhar um site mais direto para o cliente";
}

function numeroWhatsApp(item) {
    if (!item) {
        return null;
    }
    return item.celular || item.whatsapp || item.telefoneNormalizado || null;
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function escolherTemplate(item) {
    const termo = normalizarTexto(`${item.segmento || ""} ${item.categoria || ""}`);
    if (/padaria|bakery|confeitaria|pastry/.test(termo)) return "padaria.html";
    if (/salao|barbearia|hairdresser|beauty/.test(termo)) return "salao.html";
    if (/oficina|mecanica|autopecas|car_repair|motorcycle_repair|car_parts/.test(termo)) return "oficina.html";
    if (/restaurante|lanchonete|cafe|bar|restaurant|fast_food|pub/.test(termo)) return "restaurante.html";
    return "loja.html";
}

function linkDemonstracao(item) {
    const parametros = new URLSearchParams();
    const telefone = numeroWhatsApp(item);

    parametros.set("nome", item.nome || "Seu negócio");
    parametros.set("categoria", item.segmento || item.categoria || "Comércio");
    if (item.endereco && item.endereco !== "Endereço não informado") {
        parametros.set("endereco", item.endereco);
    }
    if (telefone) {
        parametros.set("telefone", item.telefone || telefone);
        parametros.set("whatsapp", telefone);
    }

    const url = new URL(
        `templates/${escolherTemplate(item)}`,
        "https://leviluiz.github.io/templates/",
    );
    url.search = parametros.toString();
    return url.toString();
}

function montarMensagem(item) {
    const onde =
        item.endereco && item.endereco !== "Endereço não informado"
            ? `, na região de ${item.endereco}`
            : "";

    return (
        `Olá, tudo bem? Vi a ${item.nome}${onde} e notei que ${textoMotivo(item)}. ` +
        `Faço site simples para comércio: horário, fotos, mapa e botão de WhatsApp. ` +
        `Quer que eu te mostre um exemplo de 1 página?`
    );
}

function mensagemComLink(item) {
    return `${montarMensagem(item)}\n\nExemplo de site: ${linkDemonstracao(item)}`;
}

function preencherEmpresa(item) {
    empresa = item;

    const nome = item.nome || "Nome não informado";
    const nota = item.nota != null ? `Nota ${item.nota}/100` : "";
    const categoria = item.categoria || "Categoria não informada";
    const endereco = item.endereco || "Endereço não informado";
    const motivo = `Motivo: ${textoMotivo(item)}.`;
    const contato = numeroWhatsApp(item) || item.telefone || "Telefone não informado";
    const site = item.site || "Sem site cadastrado";

    if (empNome) {
        setText(empNome, nome);
        setText(empNota, nota);
        setText(empCategoria, categoria);
        setText(empEndereco, endereco);
        setText(empMotivo, motivo);
        setText(empContato, contato);

        if (empSite) {
            empSite.innerHTML = "";
            if (item.site) {
                const link = document.createElement("a");
                link.href = item.site;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = item.site;
                empSite.appendChild(link);
            } else {
                empSite.textContent = site;
            }
        }
    } else if (caixaEmpresa) {
        const siteHtml = item.site
            ? `<a href="${item.site}" target="_blank" rel="noopener noreferrer">${item.site}</a>`
            : "Sem site cadastrado";

        caixaEmpresa.innerHTML = `
            <article class="card">
                <header class="card-topo">
                    <h2>${nome}</h2>
                    <span class="nota">${nota}</span>
                </header>
                <p class="categoria">${categoria}</p>
                <p>${endereco}</p>
                <p>${motivo}</p>
                <p>${contato}</p>
                <p>${siteHtml}</p>
            </article>
        `;
    }

    if (mensagemEl) {
        mensagemEl.value = mensagemComLink(item);
    }
    setDisabled(botaoWhatsApp, !numeroWhatsApp(item));
    setDisabled(botaoPreview, false);
}

function carregar() {
    try {
        fila = JSON.parse(localStorage.getItem("filaProspeccao") || "[]");
        indiceAtual = Number(localStorage.getItem("indiceProspeccao") || 0);
        empresa = JSON.parse(localStorage.getItem("empresaProposta") || "null");
    } catch {
        empresa = null;
        fila = [];
    }

    if (!empresa) {
        if (empNome) {
            setText(empNome, "Nenhuma empresa selecionada");
            setText(empEndereco, "Volte à fila e toque em Talvez.");
        } else if (caixaEmpresa) {
            caixaEmpresa.innerHTML = "<p>Nenhuma empresa selecionada. Volte à fila e toque em Talvez.</p>";
        }
        setDisabled(botaoGerar, true);
        setDisabled(botaoWhatsApp, true);
        setDisabled(botaoPreview, true);
        setDisabled(botaoProxima, true);
        return;
    }

    preencherEmpresa(empresa);
}

on(botaoGerar, "click", () => {
    if (!empresa || !mensagemEl) {
        return;
    }
    mensagemEl.value = mensagemComLink(empresa);
    setDisabled(botaoWhatsApp, !numeroWhatsApp(empresa));
});

on(botaoWhatsApp, "click", () => {
    if (!empresa) {
        return;
    }

    const numero = numeroWhatsApp(empresa);
    if (!numero) {
        return;
    }

    const texto = (mensagemEl && mensagemEl.value.trim()) || mensagemComLink(empresa);
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");
});

on(botaoPreview, "click", () => {
    if (!empresa) return;
    window.open(linkDemonstracao(empresa), "_blank", "noopener,noreferrer");
});

on(botaoProxima, "click", () => {
    indiceAtual += 1;
    localStorage.setItem("indiceProspeccao", String(indiceAtual));

    if (indiceAtual >= fila.length) {
        localStorage.removeItem("empresaProposta");
        window.location.href = "index.html";
        return;
    }

    const proxima = fila[indiceAtual];
    localStorage.setItem("empresaProposta", JSON.stringify(proxima));
    preencherEmpresa(proxima);
});

carregar();
