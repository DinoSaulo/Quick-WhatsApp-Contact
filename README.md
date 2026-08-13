# Quick WhatsApp Contact

<p align="center">
  <img src="./icons/logo-generated-512.png" alt="Quick WhatsApp Contact" width="280" />
</p>

> Extensão do Chrome para iniciar conversas no WhatsApp a partir de números encontrados em qualquer página web.

`Chrome Extension` · `Manifest V3` · `Vanilla JS` · `Vitest`

[![Pipeline](https://github.com/DinoSaulo/Quick-WhatsApp-Contact/actions/workflows/ci.yml/badge.svg)](https://github.com/DinoSaulo/Quick-WhatsApp-Contact/actions/workflows/ci.yml)

---

## 💬 Sobre

**Quick WhatsApp Contact** detecta números de telefone em páginas web e abre o WhatsApp com um clique. A extensão trata automaticamente DDI, aplica a máscara do país selecionado e permite enviar uma mensagem personalizada — tudo sem sair da aba atual.

A interface está disponível em **Inglês (EN-US)** e **Português (PT-BR)**.

---

## ✨ Funcionalidades

- 🖱️ **Menu de contexto** — selecione qualquer texto que pareça um número e clique em "Chamar no WhatsApp".
- 💡 **Botão flutuante** — ao selecionar texto semelhante a um número, um botão de atalho aparece na página.
- 🔗 **Realce automático** — injeta um botão do WhatsApp ao lado de todos os links `<a href="tel:">` da página.
- ⌨️ **Popup manual** — clique no ícone da extensão para digitar um número e uma mensagem personalizada.
- 🌍 **Seletor de país** — escolha o país pelo nome, bandeira e DDI; a máscara do campo de número muda automaticamente.
- 🎭 **Máscara de telefone dinâmica** — o formato do campo (ex: `11 99999-9999` para o Brasil) se atualiza conforme o país selecionado.
- 📡 **Detecção automática de país** — o país é inferido pelo locale do navegador ou pelo TLD da URL atual.
- 🚀 **Abertura inteligente** — número com `+` abre o WhatsApp diretamente; número sem DDI abre uma tela para completar o país e o número.
- 💾 **Persistência** — o último país usado e todas as preferências são salvos via `chrome.storage.sync`.
- 👋 **Tutorial de boas-vindas** — na primeira instalação, abre um guia ilustrado de seis etapas que apresenta o realce automático, o ícone da extensão, o preenchimento do popup e o envio pelo WhatsApp.
- 🌐 **Idioma ajustável no tutorial** — alterne entre Inglês e Português na primeira etapa; a escolha é aplicada imediatamente e salva para as demais telas.
- 🔁 **Tutorial reutilizável** — reabra o guia a qualquer momento pela página de configurações.
- ☕ **Apoio ao projeto** — o botão "Buy me a coffee" abre opções de contribuição por PIX, MB WAY/Revolut e PayPal, com QR codes locais e ações para copiar ou abrir quando disponíveis.
- 🛡️ **Renderização protegida** — números vindos de seleções ou parâmetros de URL são normalizados antes de chegar à interface; dados do modal são escapados e links externos de doação aceitam somente HTTPS.

---

## ⚙️ Configurações

Acesse a página de configurações pelo ícone de engrenagem no popup.

| Opção | Descrição |
|---|---|
| 🔗 Realce automático | Liga/desliga os botões injetados ao lado de links `tel:` nas páginas |
| 🌙 Dark mode | Alterna entre tema claro e escuro |
| 🌐 Idioma | Inglês (EN-US) ou Português (PT-BR) |
| 🏳️ País padrão | País pré-selecionado ao abrir o popup (substitui a detecção automática) |
| 👋 Tutorial | Reabre o guia ilustrado de uso da extensão |

O botão flutuante **Buy me a coffee** também fica disponível nas configurações e no tutorial. Ao acioná-lo pelo popup, a página de configurações abre diretamente com o modal de contribuição.

---

## 📦 Como instalar

1. Clone ou baixe este repositório e execute `npm ci` e `npm run build`.
2. Abra o Chrome e acesse `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `dist/extension`.

---

## 🚀 Como usar

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

### Fluxo 4 — Tutorial de boas-vindas

1. Após uma instalação nova, o tutorial abre automaticamente em uma nova aba.
2. Na primeira etapa, escolha **English** ou **Português** se quiser alterar o idioma da extensão.
3. Navegue pelas seis etapas ilustradas usando **Próximo**, **Voltar** ou os indicadores de etapa.
4. Use **Pular** para sair antes do fim ou **Entendi** para concluir. O tutorial pode ser aberto novamente em **Configurações → Tutorial**.

### Fluxo 5 — Apoiar o projeto

1. Clique em **Buy me a coffee** no popup, na página de configurações ou no tutorial.
2. Escolha **PIX**, **MB WAY** ou **PayPal** no modal.
3. Escaneie o QR code ou use **Copiar**; quando o método oferecer um link, use **Abrir**.

Ao iniciar esse fluxo pelo popup, a extensão abre a página de configurações e exibe o modal de contribuição automaticamente.

---

## 🛠️ Desenvolvimento

Instale as dependências:

```bash
npm install
```

Execute todos os testes:

```bash
npm test
```

Execute a verificação completa de sintaxe, manifesto, testes e build:

```bash
npm run verify
```

Execute o smoke test do ciclo de instalação e desinstalação em um Chrome ou Chromium real:

```bash
npm run test:install
```

O teste constrói e instala a extensão, confirma o service worker Manifest V3, abre o popup e verifica os assets locais. Em seguida, desinstala a extensão e confirma que seus processos desaparecem e que o popup deixa de ser acessível. Se o navegador não estiver em um caminho padrão, informe `CHROME_PATH` ou `CHROMIUM_PATH` com o caminho do executável.

O build publicável é gerado em `dist/extension` e contém somente o manifesto, o código da extensão, os ícones e os assets locais de Twemoji, onboarding e doações. Para criar o ZIP no Windows:

```powershell
Compress-Archive -Path dist/extension/* -DestinationPath dist/quick-whatsapp-contact.zip -Force
```

No Linux ou macOS:

```bash
(cd dist/extension && zip -qr ../quick-whatsapp-contact.zip .)
```

Execute um arquivo de teste específico:

```bash
npx vitest run tests/phone.test.js
```

### 🔄 Pipeline de CI/CD

O repositório usa GitHub Actions com 5 níveis sequenciais. Cada nível precisa passar em todas as plataformas antes do próximo começar.

| Nível | Job | Plataformas |
|:---:|---|---|
| 1️⃣ | Testes unitários + lint | Ubuntu · Fedora · macOS · Windows |
| 2️⃣ | Testes de integração | Ubuntu · Fedora · macOS · Windows |
| 3️⃣ | Instalação no Chrome | Ubuntu · Fedora · macOS · Windows |
| 4️⃣ | Validação do pacote Manifest V3 | Ubuntu |
| 5️⃣ | Publicação da release | Ubuntu *(somente branch `main`)* |

---

## 🧰 Tecnologias

- **Chrome Extension Manifest V3** com service worker
- **Vanilla JS** — ES Modules, sem bundler, sem frameworks
- **Web Components** nativos (`HTMLElement` + `customElements.define`)
- **Vitest** + **jsdom** para testes unitários e de integração

### Assets de terceiros

As bandeiras e o ícone de seleção automática usam gráficos [Twemoji](https://github.com/jdecked/twemoji) empacotados localmente. Os gráficos Twemoji são licenciados sob [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/); nenhum emoji é carregado de CDN durante a execução.

---

## 🔒 Privacidade e publicação

Os recursos que leem seleção e links `tel:` em páginas são opcionais, ficam desativados por padrão e solicitam permissão no momento da ativação. A extensão não possui backend ou telemetria. Consulte [PRIVACY.md](./PRIVACY.md), [diagnóstico da Chrome Web Store](./docs/STORE_READINESS.md) e [checklist de lançamento](./docs/RELEASE_CHECKLIST.md).

### Segurança

- A Content Security Policy das páginas da extensão bloqueia scripts inseguros e código remoto.
- Números recebidos por seleção, armazenamento temporário ou parâmetros de URL são reduzidos a dígitos e, quando aplicável, ao prefixo `+` antes da renderização.
- Conteúdo interpolado no modal de contribuição é escapado para impedir a criação de HTML ou atributos executáveis.
- Links externos são limitados a HTTPS e abertos com `rel="noopener noreferrer"` para isolar a aba de origem.
- O manifesto não declara `externally_connectable`; mensagens para o service worker permanecem restritas aos contextos da própria extensão.
- A validação do pacote e os testes automatizados mantêm essas proteções como verificações de regressão.
