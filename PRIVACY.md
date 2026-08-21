# Política de Privacidade — Quick WhatsApp Contact

Última atualização: 21 de agosto de 2026.

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

## Base legal

Quando o Regulamento Geral sobre a Proteção de Dados (RGPD/GDPR) ou o UK GDPR for aplicável, o tratamento descrito nesta política se apoia nas seguintes bases legais:

- **Execução de contrato ou de medidas pré-contratuais solicitadas pelo usuário (art. 6(1)(b))**: quando a relação de uso constituir um contrato aplicável, esta base cobre o tratamento estritamente necessário para fornecer as funcionalidades que o usuário escolhe utilizar, como formatar o número, preparar a conversa, encaminhar o número e a mensagem ao WhatsApp e aplicar as configurações selecionadas.
- **Legítimo interesse (art. 6(1)(f))**: aplica-se ao tratamento mínimo necessário para manter a extensão funcional e segura, preservar as preferências escolhidas e oferecer os recursos opcionais ativados pelo usuário. Esse interesse é ponderado contra os direitos e as liberdades do usuário e não prevalece quando estes exigirem maior proteção.

Esses tratamentos são limitados ao dispositivo sempre que possível, não envolvem publicidade ou criação de perfis e podem ser controlados pelo usuário. O usuário pode se opor ao tratamento baseado em legítimo interesse desativando os recursos opcionais, revogando o acesso a sites, apagando os dados armazenados ou entrando em contato pelo e-mail indicado abaixo. A desativação de um tratamento indispensável pode impedir o funcionamento do recurso correspondente.

## Acesso opcional a sites

Os recursos de página ficam desativados por padrão. Se o usuário os ativar nas configurações, o Chrome solicitará acesso opcional a páginas HTTP e HTTPS. Com esse acesso, a extensão:

- procura localmente links `tel:` para exibir um botão de ação; e
- identifica texto semelhante a telefone selecionado pelo usuário para exibir um atalho.

A extensão não coleta histórico de navegação, não envia URLs ou conteúdo das páginas ao desenvolvedor e não executa esses recursos sem a permissão opcional.

## Armazenamento e retenção

As preferências de idioma, tema, país padrão, último país utilizado e ativação dos recursos opcionais são armazenadas em `chrome.storage.sync`. Quando o usuário mantém o Chrome Sync ativado, o Chrome pode transmitir e armazenar essas preferências pela infraestrutura de sincronização do Google e replicá-las entre navegadores Chrome nos quais o usuário esteja conectado. Com a sincronização desativada, essa área se comporta como armazenamento local. Esse transporte é administrado pelo Chrome/Google conforme as configurações de sincronização da conta e fica fora do controle direto da extensão: ela não escolhe os servidores, não opera a infraestrutura de sync e não recebe acesso à conta Google ou às cópias sincronizadas.

Números pendentes vindos de uma seleção são guardados temporariamente em `chrome.storage.session` e removidos quando consumidos pelo popup. Esses valores de sessão não são gravados em `chrome.storage.sync`. A extensão não mantém banco de dados externo e não envia os dados armazenados ao desenvolvedor.

O usuário pode apagar todos os dados armazenados a qualquer momento, sem precisar desinstalar a extensão, usando o botão "Apagar todos os dados armazenados" na página de configurações. Esse botão limpa `chrome.storage.sync` e `chrome.storage.session` por completo e revoga o acesso opcional a sites. Os dados também são removidos ao desinstalar a extensão ou ao limpar os dados pelo Chrome. O acesso opcional a sites pode, isoladamente, ser revogado nas configurações da extensão ou na página de gerenciamento do Chrome.

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

E-mail de suporte: **saulbpt@gmail.com**

## Publicação

Esta política é publicada em [`docs/privacy.html`](./docs/privacy.html) via GitHub Pages, em:
`https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html`. Ative o GitHub Pages em
Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, pasta **/docs**. Ao editar
este arquivo, atualize `docs/privacy.html` junto — são mantidos manualmente em sincronia.
