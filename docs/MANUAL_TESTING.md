# Verificação manual da extensão

Execute em uma instalação limpa do Chrome 127 ou superior usando o conteúdo de `dist/extension`.

## Instalação e permissões

- [ ] `npm run verify` termina sem erros.
- [ ] A extensão carrega em `chrome://extensions` sem erros de manifesto/service worker.
- [ ] A instalação não pede acesso a todos os sites.
- [ ] O popup abre pelo ícone e permite enviar um número internacional.
- [ ] O menu de contexto aparece ao selecionar texto, mesmo sem acesso opcional a sites.

## Acesso opcional a páginas

- [ ] A opção de helpers começa desativada em instalação nova.
- [ ] A divulgação de acesso a conteúdo de página aparece ao lado da opção.
- [ ] Ativar a opção mostra o prompt nativo de acesso HTTP/HTTPS.
- [ ] Negar mantém o toggle desativado e exibe mensagem compreensível.
- [ ] Aceitar habilita botão em links `tel:` e atalho sobre seleção semelhante a telefone.
- [ ] Desativar revoga o acesso opcional; após recarregar a página, os helpers não aparecem.

## Fluxos funcionais

- [ ] Números com `+DDI` abrem somente uma URL `https://wa.me/`.
- [ ] Números locais exigem país e respeitam a máscara selecionada.
- [ ] Entradas com menos de 8 ou mais de 15 dígitos são rejeitadas.
- [ ] Texto com HTML, `javascript:` ou caracteres não telefônicos não abre uma aba.
- [ ] Mensagens com `&`, `#`, acentos e quebras de linha chegam corretamente codificadas.
- [ ] Tema, idioma e país padrão persistem após reiniciar o Chrome.

## Ciclo de vida MV3

- [ ] Em `chrome://extensions`, interromper o service worker e repetir menu de contexto/popup.
- [ ] Reiniciar o Chrome e confirmar que o menu e o registro opcional são restaurados.
- [ ] Remover a permissão de sites na tela do Chrome e confirmar que os helpers deixam de ser registrados.

## Qualidade da listagem

- [ ] Ícones 16, 48 e 128 px aparecem corretamente e sem transparência problemática.
- [ ] Screenshots correspondem exatamente à versão enviada.
- [ ] Descrição e declarações de privacidade correspondem ao comportamento observado.
