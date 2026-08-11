# Checklist de envio à Chrome Web Store

## Código e pacote

- [ ] Atualizar `version` em `manifest.json` usando `major.minor.patch` com componentes entre 0 e 65535.
- [ ] Executar `npm ci` e `npm run verify` em checkout limpo.
- [ ] Inspecionar apenas `manifest.json`, `src/` e `icons/` dentro de `dist/extension`.
- [ ] Compactar o conteúdo de `dist/extension` com `manifest.json` na raiz do ZIP.
- [ ] Carregar o ZIP em `chrome://extensions` e executar `docs/MANUAL_TESTING.md`.

## Developer Dashboard

- [ ] Conta de desenvolvedor registrada e verificação em duas etapas habilitada.
- [ ] Finalidade única: “Iniciar conversas no WhatsApp a partir de números escolhidos pelo usuário”.
- [ ] Justificativas de `contextMenus`, `storage`, `scripting` e hosts opcionais preenchidas.
- [ ] Declarações de uso de dados consistentes com `PRIVACY.md`.
- [ ] Política de privacidade publicada em URL HTTPS estável.
- [ ] E-mail de suporte verificado.
- [ ] Categoria e territórios de distribuição definidos.

## Materiais

- [ ] Nome e descrição curta sem alegações enganosas ou afiliação oficial ao WhatsApp.
- [ ] Descrição detalhada explica claramente popup, menu e acesso opcional.
- [ ] Ícone de loja 128 × 128 px.
- [ ] Pelo menos uma captura de tela real 1280 × 800 ou 640 × 400 px.
- [ ] Imagens promocionais preparadas se forem usadas na listagem.
- [ ] Marca “WhatsApp” usada apenas para descrever interoperabilidade, sem sugerir endosso.

## Revisão final

- [ ] Nenhum segredo, token, arquivo `.env`, teste, relatório ou `node_modules` no ZIP.
- [ ] Nenhum código remoto, `eval`, `new Function` ou lógica baixada externamente.
- [ ] Release notes descrevem mudanças de permissão e privacidade.
- [ ] Publicação diferida considerada para validar a aprovação antes de liberar.
