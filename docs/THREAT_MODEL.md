# Threat Model — Quick WhatsApp Contact

Auditoria de segurança da extensão (Manifest V3, sem backend, sem dependências de runtime).
Cobre os vetores de ataque mais comuns em extensões de navegador: message passing,
DOM-based XSS em content scripts, armazenamento/privacidade, privilégios do manifesto e
vazamento de dados em rede. Este documento registra o que foi mapeado, o que foi encontrado
e corrigido, e como a proteção é mantida como regressão automatizada.

## 1. Superfície de ataque — pontos de entrada de dados não confiáveis

| # | Entrada | Onde | Confiança | Sanitização aplicada |
|---|---|---|---|---|
| 1 | DOM da página (`href` de `a[href^="tel:"]`) | `src/content/autoHighlight.js`, rodando em qualquer origem `http(s)://*/*` (permissão opcional) | Não confiável — a página pode ser hostil | Nenhuma classe de sink perigoso é usada (`createElement`, nunca `innerHTML`); o valor só é usado como texto de mensagem enviado ao background |
| 2 | Seleção de texto do usuário na página | `src/content/selectionButton.js`, mesma superfície acima | Não confiável | Regex de forma (`isLikelyPhoneSelection`) antes de qualquer envio; revalidado de novo no background |
| 3 | `chrome.runtime.onMessage` (`PROCESS_SELECTION_MESSAGE`) | `src/background.js` | Rede interna da extensão apenas (ver §3.1) | `isLikelyPhoneText` + `normalizeSelectedNumber` antes de qualquer navegação |
| 4 | `chrome.contextMenus.onClicked` (`info.selectionText`, `info.pageUrl`) | `src/background.js` | Selecionado pelo usuário na página, tratado como não confiável | Mesmo pipeline do item 3; `pageUrl` só é usado para inferir país via `detectCountryCodeFromUrl`, que valida o esquema (`http`/`https`) antes de tocar no hostname |
| 5 | `chrome.storage.session`/`sync` (handoff entre popup/options/ddi) | `src/utils/storage.js` | Semiconfiável — escrito só pela própria extensão, mas pode ser corrompido (edição manual via DevTools, sync entre dispositivos, bug futuro) | Revalidado no ponto de renderização (ver §4 — achado corrigido nesta auditoria) |
| 6 | Query string `?number=` de `ddi.html` | `src/popup/ddi.js` | Não confiável em princípio (não é `web_accessible_resources`, então não é navegável a partir de páginas web arbitrárias, mas tratado como hostil mesmo assim) | `normalizeSelectedNumber` no momento da leitura (`getNumberFromQuery`) |
| 7 | Formulários do popup/options (telefone, mensagem, configurações) | `src/popup/popup.js`, `src/options/options.js` | Usuário legítimo, mas o valor ainda passa para HTML | Mesma allow-list de dígitos/`+`; textos livres (mensagem) só compõem a query string HTTPS via `encodeURIComponent`, nunca HTML |
| 8 | `DONATION_METHODS` (`src/utils/donation.js`) | `src/options/donationModal.js` | Controlado pelo desenvolvedor, não pelo usuário final | Ainda assim passado por `escapeHtml()` e por uma allow-list de esquema `https://` — tratado como não confiável por princípio, não por necessidade |

## 2. Vetores auditados e veredito

### 2.1 Message passing inseguro
- O manifesto **não declara `externally_connectable`** — nenhuma página web ou outra
  extensão consegue invocar `chrome.runtime.sendMessage` contra este service worker
  (guardado por `tests/manifest.test.js`).
- **Achado corrigido nesta auditoria:** o listener em `background.js` não verificava
  `sender.id`/`sender.tab` antes de processar a mensagem — a proteção dependia inteiramente
  da ausência de `externally_connectable` no manifesto, sem nenhuma checagem redundante no
  próprio handler. Corrigido: o listener agora rejeita qualquer mensagem cujo `sender.id`
  não seja o da própria extensão ou que não tenha `sender.tab` (mensagens legítimas só vêm
  de content scripts, que sempre rodam numa aba). Ver `src/background.js` e os testes
  "ignores a message whose sender.id does not match..." / "...did not come from a content
  script tab" em `tests/background.integration.test.js`.

### 2.2 DOM-based XSS & vazamento de contexto em content scripts
- `autoHighlight.js` e `selectionButton.js` nunca usam `innerHTML`/`insertAdjacentHTML`/
  `document.write`/`eval` — todo elemento é criado via `document.createElement` e
  propriedades DOM diretas (`.src`, `.textContent`, `.style.*`), que nunca são
  reinterpretadas como HTML.
- Nenhum dos dois expõe API da extensão no contexto da página via `window.postMessage` —
  a única comunicação é `chrome.runtime.sendMessage`, que não é acessível ao script da
  página (mundo isolado).
- Os componentes de UI (`popup.js`, `ddi.js`, `options.js`, `onboarding.js`,
  `donationModal.js`) usam `this.innerHTML = \`...\`` para renderizar — cada um foi
  revisado manualmente e tem uma configuração de SAST (§5) que falha caso um novo sink não
  revisado apareça. Ver a tabela do §1 para a sanitização de cada campo interpolado.
- **Achado corrigido nesta auditoria:** `options.js` interpolava o valor bruto de
  `defaultCountry` (lido de `chrome.storage.sync`) num atributo `value="..."` sem escapar,
  diferente de `popup.js`/`ddi.js`, que sempre derivam esse atributo do objeto de país já
  resolvido (`selectedCountry.code`, sempre um valor estático e seguro por causa do
  fallback em `getCountryByCode`). Um valor hostil sincronizado
  (`'"><img src=x onerror=...>'`) quebraria o atributo e injetaria HTML na página de
  configurações — a CSP (`script-src 'self'`, sem `unsafe-inline`) bloqueia a execução de
  `<script>`/atributos `on*`, mas não impede a desfiguração do DOM. Corrigido para usar o
  mesmo padrão seguro de `popup.js`/`ddi.js`. Ver `src/options/options.js` e o teste
  "neutralizes hostile markup in the synced default country instead of injecting it" em
  `tests/options.integration.test.js`.

### 2.3 Armazenamento e privacidade
- Nenhum token, chave de API ou segredo é armazenado — `chrome.storage.sync` guarda apenas
  preferências do usuário (idioma, tema, país) e `chrome.storage.session` guarda um
  handoff de curta duração (número/país pendente, flag de abrir o modal de doação),
  sempre consumido uma única vez (`consumePendingContextNumber` etc.).
- `chrome.storage.session` nunca chama `setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS)` —
  os dados de handoff não ficam acessíveis a content scripts, só às páginas da própria
  extensão (guardado por `tests/security.test.js`).
- Nenhum recurso executável (`.js`/`.html`) é `web_accessible_resources` — só um ícone
  estático, servido com `use_dynamic_url: true` para não ser uma URL fixa e "probeable"
  por sites externos (fingerprinting de extensões instaladas).
- Os dados de doação (`donation.js`) contêm um payload PIX estático e um e-mail PayPal —
  isso é informação de recebimento intencionalmente pública (o próprio propósito do botão
  "Buy me a coffee"), não um segredo armazenado pela extensão; ver §6 para o porquê de não
  ser tratado como achado.

### 2.4 Privilégios e escopo no manifest.json
- `permissions`: só `contextMenus`, `scripting`, `storage` — nenhuma permissão ampla
  (`tabs`, `<all_urls>` obrigatório).
- Acesso a páginas web é **opcional** (`optional_host_permissions`), pedido em tempo de
  execução via `chrome.permissions.request` só quando o usuário liga o realce automático —
  nunca concedido na instalação.
- CSP restringe `extension_pages` a `script-src 'self'; object-src 'self'; base-uri 'self';
  frame-ancestors 'none'` — sem `unsafe-inline`/`unsafe-eval`.
- Tudo isso é regressão automatizada em `tests/manifest.test.js` e `scripts/validate-extension.mjs`.

### 2.5 Vazamento de dados em rede
- Nenhum `fetch`/`XMLHttpRequest` existe em `src/` — a única saída de rede é
  `chrome.tabs.create({ url: "https://wa.me/..." })`, sempre HTTPS, só quando o usuário
  pede para abrir a conversa.
- Nenhuma URL `http://` (não-TLS) é usada como destino real de rede — a única ocorrência de
  `http://` no código é o match pattern `http://*/*` (permissão opcional, nunca uma
  requisição) e o namespace XML `http://www.w3.org/2000/svg` (nunca dereferenciado).
- Guardado por `tests/networkSecurity.test.js` (novo nesta auditoria).

## 3. Correções aplicadas nesta auditoria

| Arquivo | Mudança | Motivo |
|---|---|---|
| `src/background.js` | `onMessage` agora valida `sender.id === chrome.runtime.id` e `sender.tab` antes de processar | Defesa em profundidade — não depender só da ausência de `externally_connectable` no manifesto |
| `src/options/options.js` | Atributo `value` do país padrão agora usa `selectedCountry.code` (resolvido, seguro) em vez do valor bruto de `chrome.storage.sync` | Fechar uma injeção de atributo HTML alcançável por um valor sincronizado corrompido/adulterado |

Nenhuma outra alteração de comportamento foi feita — os demais sinks revisados (`popup.js`,
`ddi.js`, `onboarding.js`, `donationModal.js`) já estavam seguros por construção; ganharam
apenas o comentário de justificativa exigido pelo `eslint-disable-next-line` do novo SAST (§5).

## 4. Suíte de testes de regressão

| Arquivo | Cobre |
|---|---|
| `tests/background.integration.test.js` | Validação de `sender.id`/`sender.tab`; payloads hostis de seleção; URLs de página não confiáveis |
| `tests/options.integration.test.js` | Injeção via `defaultCountry` sincronizado (novo) |
| `tests/popup.integration.test.js` | Injeção via número de contexto pendente; configurações sincronizadas hostis |
| `tests/ddi.integration.test.js` | Injeção via query string `?number=` |
| `tests/donationModalEscaping.test.js` | Escaping de `DONATION_METHODS`; links não-HTTPS não renderizam `<a>`; segurança de seletor CSS |
| `tests/security.test.js` | Tabnabbing (`rel="noopener"`); isolamento de `chrome.storage.session`; segredos hardcoded (novo) |
| `tests/networkSecurity.test.js` (novo) | Ausência de `fetch`/`XMLHttpRequest`; nenhuma URL de rede em `http://` não-TLS |
| `tests/manifest.test.js` | Permissões mínimas, CSP, `web_accessible_resources`, ausência de `externally_connectable` |
| `scripts/validate-extension.mjs` | `eval`/`new Function`/script remoto/import remoto; dependências de runtime |

Todos rodam via `npm test` / `npm run verify`.

## 5. Análise estática (SAST)

`eslint.config.js` (novo) roda `eslint-plugin-no-unsanitized` (sinks de DOM XSS —
`innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`) sobre `src/**/*.js` e
`eslint-plugin-security` (regex não-literal, `eval` dinâmico, etc.) sobre todo o projeto.

```bash
npm run lint:sast   # roda isoladamente
npm run verify       # já inclui lint:sast como gate obrigatório
```

Cada sink existente em `src/` tem um `eslint-disable-next-line` com um comentário
explicando por que aquele ponto específico é seguro (allow-list upstream, `escapeHtml()`,
ou dado estático do desenvolvedor) — a regra continua **error**, então qualquer sink novo,
não revisado, quebra o build até ser deliberadamente justificado ou corrigido.

## 6. Riscos residuais aceitos (fora de escopo de correção)

- **`chrome.storage.sync` não é criptografado em repouso.** Isso é uma característica da
  plataforma, não um bug desta extensão — e os únicos dados guardados são preferências e
  números/mensagens que o próprio usuário decidiu enviar ao WhatsApp de qualquer forma.
- **Payload PIX e e-mail PayPal em `src/utils/donation.js` são texto plano no repositório
  público.** Intencional — são informações de recebimento de doação que o desenvolvedor já
  publica ao pedir apoio; não são segredos, não são dados de terceiros, e não passam por
  `chrome.storage`.
- **`npm audit` reporta uma advisory de alta severidade em `extract-zip` (via
  `puppeteer-core`, usado só por `tests/installation/extension-install.mjs`).**
  `npm audit --omit=dev` confirma 0 vulnerabilidades em produção (a extensão não tem
  dependências de runtime). Corrigir exigiria atualizar `puppeteer-core` para uma versão
  com breaking changes — não foi feito sem confirmação explícita do proprietário.

## 7. Como manter esta proteção

Ao adicionar qualquer novo sink de renderização (`innerHTML`, nova rota de mensagem, novo
campo de storage exposto a uma página), rode `npm run verify` antes de commitar — o SAST
(`lint:sast`) falha imediatamente se o novo código não estiver revisado, e a suíte de
testes acima cobre os pontos de entrada já mapeados neste documento.
