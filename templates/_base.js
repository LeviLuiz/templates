(function () {
    const p = new URLSearchParams(location.search);

    const dados = {
        nome: p.get("nome") || document.body.dataset.nome || "Seu negócio",
        categoria: p.get("categoria") || document.body.dataset.categoria || "",
        endereco: p.get("endereco") || "Endereço a confirmar",
        telefone: p.get("telefone") || "",
        whatsapp: (p.get("whatsapp") || p.get("telefone") || "").replace(/\D/g, ""),
        horario: p.get("horario") || "Seg a Sáb, 8h às 18h",
        frase: p.get("frase") || document.body.dataset.frase || "",
    };

    document.querySelectorAll("[data-campo]").forEach((el) => {
        const chave = el.getAttribute("data-campo");
        const valor = dados[chave];
        if (!valor) {
            return;
        }
        if (el.tagName === "TITLE") {
            el.textContent = valor;
            return;
        }
        el.textContent = valor;
    });

    document.querySelectorAll("[data-whatsapp]").forEach((el) => {
        if (!dados.whatsapp) {
            el.style.display = "none";
            return;
        }
        const texto = encodeURIComponent("Olá! Vim pelo site e quero atendimento.");
        el.href = `https://wa.me/${dados.whatsapp}?text=${texto}`;
    });

    document.querySelectorAll("[data-mapa]").forEach((el) => {
        el.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dados.nome + " " + dados.endereco)}`;
    });

    document.querySelectorAll("[data-tel]").forEach((el) => {
        if (!dados.telefone) {
            el.style.display = "none";
            return;
        }
        el.href = `tel:${dados.telefone}`;
        if (!el.textContent.trim()) {
            el.textContent = dados.telefone;
        }
    });
})();
