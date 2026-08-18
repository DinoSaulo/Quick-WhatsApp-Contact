# Progresso do Ralph — Quick WhatsApp Contact

Este arquivo é o registro cumulativo do loop. Cada iteração do agente deve **acrescentar** uma nova seção abaixo (nunca apagar as anteriores) com:

- história processada;
- arquivos alterados;
- comandos executados;
- resultado (`npm run verify` passou ou falhou);
- bloqueios e aprendizados para a próxima iteração.

O `ralph-loop.ps1` também acrescenta uma linha de auditoria própria (commit, resultado do `verify`, se houve reset) após cada ciclo — não apague essas linhas.

---

## Iteração — 2026-08-18

**História processada:** `country-picker-search-coverage` (priority 1) — Cobrir casos de busca não testados no seletor de países.

**Investigação:** `popup.js` e `ddi.js` implementam `filterCountries()` de forma quase idêntica: comparam a query (minúscula, sem acentos via NFD) contra `data-search` pré-computado. A única divergência real é que `popup.js` também seta `button.style.display` e `aria-hidden`, enquanto `ddi.js` só alterna `button.hidden`. Verifiquei `src/popup/styles.css` e confirmei a regra `.country-picker__option[hidden] { display: none !important; }`, compartilhada pelos dois HTMLs (`popup.html` e `ddi.html` carregam o mesmo `styles.css`). Ou seja, o `hidden` sozinho já basta — a divergência não causa falha visível nem de acessibilidade (o atributo `hidden` já remove o elemento da árvore de acessibilidade). Por isso, conforme o critério de aceitação, **não alterei o código de produção**, só documentei a equivalência com um teste novo.

**Arquivos alterados:**
- `tests/popup.integration.test.js` — 3 testes novos: busca por DDI com/sem `+` (`+55`/`55` encontram BR), busca por código ISO2 minúsculo (`br`), busca com input acentuado pelo usuário (`México` encontra MX).
- `tests/ddi.integration.test.js` — os mesmos 3 testes espelhados para o ddi.js, mais 1 teste que prova (via regex no CSS compartilhado) que a divergência de implementação entre os dois arquivos não produz resultado visual diferente.

**Comandos executados:**
- `npx vitest run tests/popup.integration.test.js tests/ddi.integration.test.js` → 50 testes passaram.
- `npm run verify` → passou por completo (lint, lint:comments, lint:sast, validate:extension, build, 428 testes em 37 arquivos).

**Resultado:** `npm run verify` PASSOU. `tasks/ralph/prd.json` → `country-picker-search-coverage.passes = true`.

**Bloqueios e aprendizados:**
- Descobri que o dial code "55" é substring de outros (Albânia "355", Camboja "855", Tanzânia "255"), então o teste de busca por DDI sem `+` verifica só que BR *está incluído* nos resultados visíveis, não que é o único — já o teste com `+55` é exclusivo (nenhum outro dial code tem "+55" como substring).
- Regra de comentário (máx. 2 linhas) do `lint:comments` pegou meu primeiro comentário de 4 linhas explicando a equivalência CSS — tive que condensar. Lição para próximas iterações: escrever comentários de rationale já enxutos de cara.
