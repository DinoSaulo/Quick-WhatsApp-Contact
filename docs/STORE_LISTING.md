# Materiais para a ficha da Chrome Web Store

Textos prontos para colar no Developer Dashboard (`chrome.google.com/webstore/devconsole`). Não afeta o pacote da extensão — é conteúdo só da ficha da loja.

## Nome do item

`Quick WhatsApp Contact`

## Descrição curta (summary, até 132 caracteres)

- **PT-BR**: `Abra o WhatsApp com um clique a partir de qualquer número de telefone digitado, selecionado ou em um link.` (109 caracteres)
- **EN-US**: `Open WhatsApp in one click from any phone number you type, select, or find in a tel: link.` (93 characters)

## Descrição detalhada

### PT-BR

```
Quick WhatsApp Contact ajuda você a iniciar conversas no WhatsApp sem copiar e colar números.

COMO USAR
• Selecione um texto que pareça um telefone em qualquer página e clique no botão que aparece.
• Clique no ícone da extensão para digitar um número e uma mensagem manualmente.
• Ative o realce automático (opcional) para ver um botão do WhatsApp ao lado de todo link "tel:" da página.
• Use o menu de contexto: selecione um número e escolha "Chamar no WhatsApp".

RECURSOS
• Seletor de país com bandeira, DDI e máscara de telefone que se adapta ao país escolhido.
• Detecção automática de país pelo idioma do navegador ou pelo domínio da página.
• Tema claro/escuro e interface em Inglês, Português ou Espanhol.
• Tutorial ilustrado na primeira instalação, reaberto a qualquer momento pelas configurações.

PRIVACIDADE
O acesso a páginas web é opcional, desativado por padrão e só é solicitado quando você ativa o realce automático nas configurações. A extensão não tem servidor próprio, não coleta dados de navegação e não envia dados ao desenvolvedor. Quando o Chrome Sync está ativado, o próprio Chrome pode sincronizar preferências como idioma, tema e país pela infraestrutura do Google, fora do controle direto da extensão. Somente o número e a mensagem são enviados ao WhatsApp — e apenas quando você pede para abrir a conversa. Você pode usar o botão "Apagar todos os dados armazenados" nas configurações para limpar preferências e dados temporários e revogar o acesso opcional a sites, sem precisar desinstalar a extensão. Política de privacidade completa: https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html

APOIO AO PROJETO
O botão "Buy me a coffee" exibe opções voluntárias de doação. A extensão não vende recursos, não processa pagamentos e não armazena dados financeiros do usuário.

Quick WhatsApp Contact é um projeto independente e não é afiliado, endossado ou patrocinado pelo WhatsApp Inc. ou pela Meta.
```

### EN-US

```
Quick WhatsApp Contact helps you start WhatsApp chats without copying and pasting phone numbers.

HOW TO USE IT
• Select any phone-looking text on a page and click the button that appears next to it.
• Click the toolbar icon to type a number and an optional message manually.
• Turn on auto-highlight (optional) to see a WhatsApp button next to every "tel:" link on a page.
• Use the right-click menu: select a number and choose "Call on WhatsApp".

FEATURES
• Country picker with flag, dial code, and a phone mask that adapts to the selected country.
• Automatic country detection from your browser language or the page's domain.
• Light/dark theme and an English, Portuguese, or Spanish interface.
• An illustrated first-run tutorial you can reopen anytime from Settings.

PRIVACY
Access to web pages is optional, off by default, and only requested when you turn on auto-highlight in Settings. The extension has no backend server, collects no browsing data, and sends no data to the developer. When Chrome Sync is enabled, Chrome itself may sync preferences such as language, theme, and country through Google's infrastructure, outside the extension's direct control. Only the phone number and message are sent to WhatsApp — and only when you ask it to open a chat. You can use the "Delete all stored data" button in Settings to clear preferences and temporary data and revoke optional site access without uninstalling the extension. Full privacy policy: https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html

SUPPORT THE PROJECT
The "Buy me a coffee" button shows optional donation methods. The extension does not sell features, process payments, or store the user's financial data.

Quick WhatsApp Contact is an independent project and is not affiliated with, endorsed by, or sponsored by WhatsApp Inc. or Meta.
```

## Categoria sugerida

`Productivity` (alternativa: `Communication`/`Tools`, conforme as opções disponíveis no Dashboard no momento do envio — a lista de categorias do Chrome Web Store muda com o tempo).

## Justificativas de permissão (campo obrigatório no Dashboard desde 2023)

Reaproveitado de [`STORE_READINESS.md`](./STORE_READINESS.md); versão em inglês para o formulário:

- **contextMenus**: "Adds a right-click action, 'Call on WhatsApp', over text the user has selected — used only to open WhatsApp with that selection."
- **storage**: "Stores the user's preferences (language, theme, default country, last used country, and optional feature state) in chrome.storage.sync. When Chrome Sync is enabled, Chrome may carry these preferences through Google's sync infrastructure to the user's other signed-in Chrome browsers; that transport is controlled by Chrome/Google and the user's sync settings, not by the extension. Short-lived phone handoff values use non-synced chrome.storage.session. No stored data is sent to the developer, and the user can delete all extension data at any time from Settings."
- **scripting**: "Registers the optional page-content helpers (tel: link button, selection button) only after the user turns the feature on in Settings and grants the optional host permission below. Never runs before that."
- **Acesso de host opcional `http://*/*`, `https://*/*`**: "Needed only so the optional page helpers can detect `tel:` links and phone-like text selections on whatever site the user is visiting. Not granted at install time; requested only when the user opts in."

## Declarações sugeridas para a aba Privacy practices

Use estas respostas como rascunho e confira os rótulos exibidos pelo Dashboard no momento do envio. Mesmo quando o processamento acontece somente no dispositivo, o Chrome Web Store considera que a extensão **trata** esses dados e exige a declaração correspondente.

- **Single purpose**: "Help the user start a WhatsApp conversation from a phone number they type, select, or find in a `tel:` link."
- **Personally identifiable information**: declarar **Telephone numbers**. São digitados ou selecionados pelo usuário, processados localmente e enviados ao WhatsApp somente quando ele solicita abrir a conversa.
- **Website content**: declarar. O recurso opcional lê apenas textos selecionados e links `tel:` para localizar números de telefone.
- **Web history / browsing activity**: declarar se o formulário usar essa categoria para domínio ou URL da página atual. A extensão consulta o domínio atual para inferir o país e executa os auxiliares somente na página aberta; não mantém histórico nem envia essa informação.
- **Personal communications / form data**: declarar a mensagem opcional digitada, caso o Dashboard a enquadre nessas categorias. Ela só compõe a URL HTTPS aberta no WhatsApp por ação explícita do usuário.
- **Financial, health, authentication and precise location data**: não tratados pela extensão. As opções de doação abrem serviços externos e nenhum pagamento é processado pela extensão.
- **Data sale, advertising, creditworthiness and unrelated uses**: não ocorre.
- **Limited Use certification**: confirmar. O uso é limitado ao recurso voltado ao usuário e a declaração afirmativa está na política de privacidade.
- **User data deletion/control**: informar, quando o formulário oferecer um campo relacionado, que o botão "Delete all stored data" limpa as preferências e os dados temporários da extensão e revoga o acesso opcional a sites sem exigir a desinstalação.
- **Privacy policy URL**: `https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html` — publique e teste essa URL antes do envio.

As respostas finais precisam permanecer consistentes com `PRIVACY.md`, `docs/privacy.html`, a descrição da loja e o comportamento do pacote enviado.

## Materiais visuais — pendente

- [x] Ícone da loja 128×128 — `icons/icon128.png`.
- [x] Pelo menos 1 screenshot real 1280×800 ou 640×400 (proporção 8:5). As imagens em `assets/onboarding/` são do tutorial interno e estão em tamanhos diferentes — não servem diretamente, precisam ser recapturadas nessas dimensões (popup aberto, options.html, ou um site com o botão de realce automático visível).
- [x] Small tile promocional obrigatório 440×280 — `store-assets/small-promo-440x280.png`.
- [x] Marquee 1400×560 (opcional, só se for usar destaque na loja).

As regras de captura estão em [`store-assets/README.md`](../store-assets/README.md).

## Antes de enviar

Ver [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) para o checklist completo (versão, build, Dashboard, revisão final).
