# Política de Privacidade — Quick WhatsApp Contact

Última atualização: 11 de agosto de 2026.

## Finalidade

O Quick WhatsApp Contact tem uma única finalidade: ajudar o usuário a iniciar, por ação própria, uma conversa no WhatsApp a partir de um número de telefone digitado, selecionado ou presente em um link `tel:`.

## Dados tratados

- Números de telefone digitados ou selecionados pelo usuário.
- Mensagem opcional escrita pelo usuário no popup.
- Código de país inferido localmente a partir do idioma do navegador ou do domínio da página.
- Preferências da extensão: idioma, tema, país padrão, último país usado e ativação dos recursos opcionais de página.

## Como os dados são usados

Números, mensagens e conteúdo de página são processados localmente no navegador para formatar o telefone e montar a URL do WhatsApp. A extensão não possui backend, conta de usuário, publicidade ou telemetria e não envia dados ao desenvolvedor.

Quando o usuário confirma a abertura de uma conversa, o número e a mensagem opcional são enviados ao WhatsApp por uma URL HTTPS (`https://wa.me/`). Esse envio é necessário para executar a ação solicitada e está sujeito à política de privacidade do WhatsApp.

## Acesso opcional a sites

Os recursos de página ficam desativados por padrão. Se o usuário os ativar nas configurações, o Chrome solicitará acesso opcional a páginas HTTP e HTTPS. Com esse acesso, a extensão:

- procura localmente links `tel:` para exibir um botão de ação; e
- identifica texto semelhante a telefone selecionado pelo usuário para exibir um atalho.

A extensão não coleta histórico de navegação, não envia URLs ou conteúdo das páginas ao desenvolvedor e não executa esses recursos sem a permissão opcional.

## Armazenamento e retenção

Preferências e o último país utilizado são armazenados em `chrome.storage.sync`, podendo ser sincronizados pelo próprio Chrome entre dispositivos vinculados à conta do usuário. Números pendentes vindos de uma seleção são guardados temporariamente em `chrome.storage.session` e removidos quando consumidos pelo popup. A extensão não mantém banco de dados externo.

O usuário pode remover os dados locais desinstalando a extensão ou limpando seus dados pelo Chrome. O acesso opcional a sites pode ser revogado nas configurações da extensão ou na página de gerenciamento do Chrome.

## Compartilhamento, venda e publicidade

A extensão não vende dados, não compartilha dados com anunciantes, não usa dados para publicidade e não permite acesso humano ao conteúdo processado. A única transmissão iniciada pela extensão é para o WhatsApp quando o usuário solicita uma conversa.

O uso de informações recebidas das APIs do Chrome observa a Política de Dados do Usuário da Chrome Web Store, incluindo os requisitos de Uso Limitado.

## Apoio voluntário ao projeto

O botão “Buy me a coffee” mostra métodos opcionais para apoiar o desenvolvedor. A extensão apenas exibe dados ou links do destinatário da doação. Ela não vende recursos, não intermedeia pagamentos, não recebe dados de cartão ou conta do usuário e não armazena informações financeiras do doador. Qualquer pagamento é iniciado conscientemente pelo usuário e processado pelo provedor escolhido, sujeito à política desse provedor.

## Declaração de Uso Limitado

O uso das informações recebidas das APIs do Chrome observa a Política de Dados do Usuário da Chrome Web Store, incluindo os requisitos de Uso Limitado. Essas informações são usadas somente para fornecer ou melhorar a finalidade única e visível da extensão; não são vendidas, usadas para publicidade personalizada nem disponibilizadas para leitura humana, salvo quando exigido por lei ou necessário para segurança nos limites permitidos pela política.

## Segurança

Todo código executável é distribuído dentro do pacote da extensão. A comunicação com o WhatsApp usa HTTPS. Não há carregamento de código remoto.

## Contato

<!-- TODO(owner): substituir pelo e-mail de suporte antes de enviar à Chrome Web Store. -->
E-mail de suporte: **[e-mail a definir]**

## Publicação

Esta política é publicada em [`docs/privacy.html`](./docs/privacy.html) via GitHub Pages, em:
`https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html`. Ative o GitHub Pages em
Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, pasta **/docs**. Ao editar
este arquivo, atualize `docs/privacy.html` junto — são mantidos manualmente em sincronia.
