# Diagnóstico para Chrome Web Store

## Finalidade única identificada

Permitir que o usuário inicie uma conversa no WhatsApp a partir de um número de telefone informado ou escolhido por ele. Popup, menu de contexto, seleção de texto, links `tel:`, máscaras e país padrão são variações diretamente relacionadas a essa finalidade.

## Matriz de requisitos

| Requisito | Estado verificado | Risco | Arquivo/área | Ação aplicada ou recomendada |
|---|---|---:|---|---|
| Manifest V3 | Atendido | Baixo | `manifest.json` | Mantido `manifest_version: 3`. |
| Service worker não persistente | Atendido | Baixo | `src/background.js` | Registro dos content scripts passou a ser reconstruível e persistido pela API `scripting`. |
| Código executável local | Atendido | Baixo | `src/`, manifesto | Sem CDN de scripts, `eval`, `new Function` ou imports remotos; validação automatizada adicionada. |
| Imagens remotas desnecessárias | Corrigido | Médio | `src/utils/countries.js` | Removido `flagcdn.com`; bandeiras usam emoji local. |
| Dependências de runtime | Corrigido | Baixo | `package.json` | Removido `twemoji`; pacote final não contém `node_modules`. |
| Permissões mínimas | Corrigido | Alto | `manifest.json` | Removida `tabs`; mantidas apenas `contextMenus`, `scripting` e `storage`. |
| Acesso a todos os sites | Corrigido | Alto | manifesto, options, background | Removida injeção obrigatória; acesso HTTP/HTTPS agora é opcional e solicitado ao ativar os helpers. |
| Recursos web acessíveis | Corrigido | Médio | `manifest.json` | Exposição reduzida para somente `icons/icon16.png`; nenhum JS/HTML exposto. |
| CSP de páginas da extensão | Corrigido | Médio | `manifest.json` | Adicionada CSP explícita sem `unsafe-eval`. |
| Compatibilidade de API | Corrigido | Médio | `manifest.json`, background | `minimum_chrome_version: 127` devido a `chrome.action.openPopup()`. |
| Validação de telefone | Corrigido | Médio | `src/utils/phone.js` | Entrada deve parecer telefone e conter de 8 a 15 dígitos. |
| Consentimento para conteúdo de página | Corrigido | Alto | options | Toggle desativado por padrão, divulgação visível e prompt nativo de permissão. |
| Armazenamento durável | Atendido | Baixo | `src/utils/storage.js` | Preferências em `storage.sync`; contexto descartável em `storage.session`. |
| Transmissão de dados | Atendido com divulgação | Médio | popup/background | Somente número/mensagem para `https://wa.me/` após ação do usuário. |
| Telemetria e backend | Não existentes | Baixo | projeto completo | Não adicionar sem nova revisão, divulgação e base legal/consentimento aplicável. |
| Política de privacidade | Hospedagem preparada, e-mail pendente | Alto até publicar | `PRIVACY.md`, `docs/privacy.html` | GitHub Pages configurado (`/docs`, `.nojekyll`); falta habilitar em Settings → Pages e preencher o e-mail de contato nos dois arquivos. |
| Identidade e suporte | Pendente | Alto | Developer Dashboard | Informar e-mail de suporte verificado e identidade do publicador. |
| Materiais da loja | Parcial | Médio | `docs/STORE_LISTING.md`, `store-assets/` | Textos, ícone e small promo obrigatórios prontos; ainda falta ao menos um screenshot real 1280×800 ou 640×400. |
| Risco de marca | Revisão recomendada | Médio | ícone, nome e materiais | O ícone atual é visualmente próximo ao logotipo do WhatsApp; obter autorização ou substituir por marca própria reduz o risco de rejeição por confusão ou impersonação. |
| Doações | Divulgado | Médio | extensão, listing, política | O apoio é voluntário; não vende recursos, não processa pagamentos e não armazena dados financeiros do usuário. |
| Build reproduzível | Atendido | Baixo | `scripts/`, `package.json` | `npm run verify` e `npm run build` geram pacote limpo em `dist/extension`. |

## Mapa de dados

| Dado | Origem | Processamento | Armazenamento | Transmissão/compartilhamento |
|---|---|---|---|---|
| Número de telefone | Campo, seleção ou link `tel:` | Normalização e máscara local | Temporário em `storage.session` quando vem de seleção | WhatsApp, somente após ação do usuário |
| Mensagem | Campo do popup | Codificação de URL local | Não armazenada | WhatsApp, somente após ação do usuário |
| URL/domínio da página | Evento de contexto | Apenas TLD para inferir país | Somente código de país temporário | Não transmitido pelo projeto |
| Conteúdo de página | Links `tel:` e seleção explícita | Inspeção local opcional | Não armazenado, salvo o número pendente temporário | Não enviado ao desenvolvedor |
| Preferências | Options/popup | Uso local | `chrome.storage.sync` | Pode ser sincronizado pelo Chrome; não enviado ao desenvolvedor |

## Justificativas de permissões para o Dashboard

- `contextMenus`: oferece a ação “Chamar no WhatsApp” sobre texto selecionado pelo usuário.
- `storage`: guarda preferências, último país e contexto temporário necessário entre service worker e popup.
- `scripting`: registra os helpers de página somente depois que o usuário ativa o recurso e concede acesso opcional.
- Acesso opcional `http://*/*` e `https://*/*`: necessário apenas para detectar seleção explícita e links `tel:` em qualquer site escolhido pelo usuário. Não é concedido na instalação.

## Decisões pendentes do proprietário

1. Definir identidade legal/nome do responsável e e-mail público de suporte — preencher em `PRIVACY.md`, `docs/privacy.html` e no Developer Dashboard.
2. Habilitar GitHub Pages (Settings → Pages → Deploy from a branch → `main` → `/docs`) para publicar `docs/privacy.html` em `https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html`.
3. Confirmar se os helpers devem continuar disponíveis em todos os sites mediante opt-in ou se o produto deve permitir seleção por domínio.
4. Preencher no Dashboard as declarações de tratamento de telefone, conteúdo de página e preferências locais de forma coerente com esta documentação (ver `docs/STORE_LISTING.md`).
5. Confirmar territórios de distribuição, categoria, preço e público-alvo.
6. Capturar ao menos um screenshot real (1280×800 ou 640×400) conforme `store-assets/README.md`.
7. Decidir se o ícone atual será substituído por identidade visual própria antes da submissão.
