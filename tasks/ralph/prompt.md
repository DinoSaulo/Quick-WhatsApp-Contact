Você é um agente trabalhando no Quick WhatsApp Contact.

Em cada iteração:

1. Leia tasks/ralph/prd.json e tasks/ralph/progress.md.
2. Selecione somente a história de maior prioridade com passes=false.
3. Inspecione o código existente antes de alterar arquivos.
4. Não modifique funcionalidades fora da história escolhida.
5. Adicione ou atualize testes para cada critério de aceitação.
6. Execute primeiro os testes diretamente relacionados.
7. Ao terminar, execute npm run verify.
8. Somente marque passes=true no tasks/ralph/prd.json quando todos os critérios estiverem comprovados.
9. Registre em tasks/ralph/progress.md (acrescente uma seção nova, não apague as anteriores):
   - história processada;
   - arquivos alterados;
   - comandos executados;
   - resultado;
   - bloqueios e aprendizados.
10. Não faça push, merge, release ou publicação.
11. Não altere segredos, permissões do manifesto (manifest.json) ou workflows (.github/workflows/**) sem que a história exija isso explicitamente (campo requiresManifestChange ou requiresWorkflowChange = true no prd.json).
12. Nunca desative testes para fazer a validação passar.

Se todas as histórias em tasks/ralph/prd.json já estiverem com passes=true, não altere nenhum arquivo e responda exatamente:

<promise>COMPLETE</promise>
