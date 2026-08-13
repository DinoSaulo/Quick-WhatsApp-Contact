# Checklist de envio à Chrome Web Store

## Código e pacote

- [ ] Atualizar `version` em `manifest.json` usando `major.minor.patch` com componentes entre 0 e 65535.
- [ ] Executar `npm ci` e `npm run verify` em checkout limpo.
- [ ] Inspecionar apenas `manifest.json`, `src/` e `icons/` dentro de `dist/extension`.
- [ ] Compactar o conteúdo de `dist/extension` com `manifest.json` na raiz do ZIP.
- [ ] Carregar o ZIP em `chrome://extensions` e executar `docs/MANUAL_TESTING.md`.

## Developer Dashboard

- [ ] Conta de desenvolvedor registrada, contrato aceito e taxa única paga.
- [ ] Verificação em duas etapas habilitada na Conta Google publicadora.
- [ ] Nome do publicador preenchido e e-mail de contato verificado.
- [ ] Finalidade única: “Iniciar conversas no WhatsApp a partir de números escolhidos pelo usuário”.
- [ ] Justificativas de `contextMenus`, `storage`, `scripting` e hosts opcionais preenchidas (texto pronto em `docs/STORE_LISTING.md`).
- [ ] Declarações de uso de dados consistentes com `PRIVACY.md`.
- [ ] GitHub Pages habilitado (Settings → Pages → `main` → `/docs`) e `docs/privacy.html` acessível publicamente.
- [ ] E-mail de suporte preenchido em `PRIVACY.md`, `docs/privacy.html` e no Dashboard.
- [ ] Categoria e territórios de distribuição definidos.
- [ ] Abas **Store listing** e **Privacy** totalmente preenchidas antes do primeiro envio.

## Materiais

- [ ] Nome e descrição curta sem alegações enganosas ou afiliação oficial ao WhatsApp.
- [ ] Descrição detalhada explica claramente popup, menu e acesso opcional.
- [x] Ícone de loja 128 × 128 px em `icons/icon128.png`.
- [ ] Pelo menos uma captura de tela real 1280 × 800 ou 640 × 400 px.
- [x] Small promo tile obrigatório 440 × 280 em `store-assets/small-promo-440x280.png`.
- [ ] Marquee 1400 × 560 apenas se desejar elegibilidade para destaque.
- [ ] Marca “WhatsApp” usada apenas para descrever interoperabilidade, sem sugerir endosso.

## Revisão final

- [ ] Executar `npm run validate:store` e resolver todos os erros.
- [ ] Nenhum segredo, token, arquivo `.env`, teste, relatório ou `node_modules` no ZIP.
- [ ] Nenhum código remoto, `eval`, `new Function` ou lógica baixada externamente.
- [ ] Release notes descrevem mudanças de permissão e privacidade.
- [ ] Publicação diferida considerada para validar a aprovação antes de liberar.
