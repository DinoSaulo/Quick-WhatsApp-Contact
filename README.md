# Quick WhatsApp Contact

> Extensão do Chrome para iniciar conversas no WhatsApp a partir de números encontrados em qualquer página web.

`Chrome Extension` · `Manifest V3` · `Vanilla JS` · `Vitest`

---

## Sobre

**Quick WhatsApp Contact** detecta números de telefone em páginas web e abre o WhatsApp com um clique. A extensão trata automaticamente DDI, aplica a máscara do país selecionado e permite enviar uma mensagem personalizada — tudo sem sair da aba atual.

A interface está disponível em **Inglês (EN-US)** e **Português (PT-BR)**.

---

## Funcionalidades

- **Menu de contexto** — selecione qualquer texto que pareça um número e clique em "Chamar no WhatsApp".
- **Botão flutuante** — ao selecionar texto semelhante a um número, um botão de atalho aparece na página.
- **Realce automático** — injeta um botão do WhatsApp ao lado de todos os links `<a href="tel:">` da página.
- **Popup manual** — clique no ícone da extensão para digitar um número e uma mensagem personalizada.
- **Seletor de país** — escolha o país pelo nome, bandeira e DDI; a máscara do campo de número muda automaticamente.
- **Máscara de telefone dinâmica** — o formato do campo (ex: `11 99999-9999` para o Brasil) se atualiza conforme o país selecionado.
- **Detecção automática de país** — o país é inferido pelo locale do navegador ou pelo TLD da URL atual.
- **Abertura inteligente** — número com `+` abre o WhatsApp diretamente; número sem DDI abre uma tela para completar o país e o número.
- **Persistência** — o último país usado e todas as preferências são salvos via `chrome.storage.sync`.

---

## Configurações

Acesse a página de configurações pelo ícone de engrenagem no popup.

| Opção | Descrição |
|---|---|
| Realce automático | Liga/desliga os botões injetados ao lado de links `tel:` nas páginas |
| Dark mode | Alterna entre tema claro e escuro |
| Idioma | Inglês (EN-US) ou Português (PT-BR) |
| País padrão | País pré-selecionado ao abrir o popup (substitui a detecção automática) |

---

## Como instalar

1. Clone ou baixe este repositório.
2. Abra o Chrome e acesse `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta raiz do projeto.

---

## Como usar

### Fluxo 1 — Menu de contexto

1. Selecione um número em qualquer página web.
2. Clique com o botão direito e escolha **Chamar no WhatsApp**.
3. Se o número já tiver DDI (`+55...`), o WhatsApp abre diretamente em nova aba.
4. Se não tiver DDI, o popup abre para você escolher o país e confirmar o envio.

### Fluxo 2 — Popup manual

1. Clique no ícone da extensão na barra do navegador.
2. Selecione o país, informe o número e, opcionalmente, escreva uma mensagem.
3. Clique em **Enviar** — o WhatsApp abre em nova aba com o número e a mensagem preenchidos.

### Fluxo 3 — Realce automático

1. Com o realce ativado nas configurações, acesse qualquer página que contenha links `tel:`.
2. Um botão do WhatsApp aparece ao lado de cada link.
3. Clique no botão para abrir o WhatsApp com aquele número diretamente.

---

## Desenvolvimento

Instale as dependências:

```bash
npm install
```

Execute todos os testes:

```bash
npm test
```

Execute um arquivo de teste específico:

```bash
npx vitest run tests/phone.test.js
```

---

## Tecnologias

- **Chrome Extension Manifest V3** com service worker
- **Vanilla JS** — ES Modules, sem bundler, sem frameworks
- **Web Components** nativos (`HTMLElement` + `customElements.define`)
- **Vitest** + **jsdom** para testes unitários e de integração
