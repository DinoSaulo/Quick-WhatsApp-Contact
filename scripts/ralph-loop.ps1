<#
.SYNOPSIS
  Ralph loop local e seguro para o Quick WhatsApp Contact: roda um agente de CLI
  (Claude Code por padrão, mas configurável) em iterações curtas contra
  tasks/ralph/prd.json, validando cada ciclo com `npm run verify` antes de
  aceitar qualquer mudança.

.EXAMPLE
  npm run ralph -- --max-iterations 5

.EXAMPLE
  powershell -File scripts/ralph-loop.ps1 -MaxIterations 3 -Branch ralph/country-picker

.NOTES
  Regras de segurança (não contornar sem atualizar este cabeçalho e avisar o time):
    - Exige árvore Git limpa no início.
    - Nunca roda na branch main/master.
    - Nunca executa `git push`.
    - manifest.json, .github/workflows/** e .claude/settings*.json são
      intocáveis a menos que a história do PRD marque requiresManifestChange
      ou requiresWorkflowChange = true.
    - `npm run verify` roda depois de toda iteração, mesmo que o agente
      afirme ter terminado — a afirmação do agente nunca é a fonte da verdade.
    - `npm run test:install` só roda na validação final (loop concluído).
#>

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RawArgs
)

$ErrorActionPreference = "Stop"

function Get-ArgValue {
    param([string[]]$Names, [string]$Default)
    if (-not $RawArgs) { return $Default }
    for ($i = 0; $i -lt $RawArgs.Count; $i++) {
        $token = $RawArgs[$i].TrimStart('-').ToLowerInvariant()
        foreach ($name in $Names) {
            if ($token -eq $name.ToLowerInvariant()) {
                if (($i + 1) -lt $RawArgs.Count) { return $RawArgs[$i + 1] }
                return $Default
            }
        }
    }
    return $Default
}

# --- Aceita tanto -MaxIterations 5 (estilo PowerShell) quanto --max-iterations 5
# (estilo GNU, como no `npm run ralph -- --max-iterations 5` sugerido no PRD). ---
$MaxIterations   = [int](Get-ArgValue -Names @('MaxIterations', 'max-iterations') -Default '5')
$Branch          = Get-ArgValue -Names @('Branch', 'branch') -Default $null
$AgentCommand    = Get-ArgValue -Names @('AgentCommand', 'agent-command') -Default 'claude'
$TimeoutMinutes  = [int](Get-ArgValue -Names @('TimeoutMinutes', 'timeout-minutes') -Default '20')
$StagnationLimit = [int](Get-ArgValue -Names @('StagnationLimit', 'stagnation-limit') -Default '2')

# Teto de segurança que nenhum parâmetro de linha de comando pode ultrapassar.
$HardIterationCap = 10
if ($MaxIterations -lt 1 -or $MaxIterations -gt $HardIterationCap) {
    throw "MaxIterations deve estar entre 1 e $HardIterationCap (recebido: $MaxIterations)."
}

$RepoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $RepoRoot) {
    throw "Este diretório não é um repositório Git."
}
Set-Location $RepoRoot

$PrdPath = "tasks/ralph/prd.json"
$ProgressPath = "tasks/ralph/progress.md"
$PromptPath = "tasks/ralph/prompt.md"
$LogsDir = "tasks/ralph/logs"
$ForbiddenPaths = @('manifest.json', '.github/workflows/', '.claude/settings')

# ---------------------------------------------------------------------------
# Pré-checagens obrigatórias
# ---------------------------------------------------------------------------

$gitStatus = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "Falha ao ler `git status`." }
if ($gitStatus) {
    Write-Error "Árvore Git não está limpa. Faça commit ou stash antes de rodar o Ralph."
    exit 1
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $Branch) {
    if ($currentBranch -in @('main', 'master')) {
        $Branch = "ralph/prd-loop-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Host "Branch atual é '$currentBranch'. Criando feature branch '$Branch'."
        git checkout -b $Branch | Out-Null
    } else {
        $Branch = $currentBranch
        Write-Host "Usando branch atual '$Branch'."
    }
} elseif ($currentBranch -ne $Branch) {
    $branchExists = git branch --list $Branch
    if ($branchExists) {
        git checkout $Branch | Out-Null
    } else {
        git checkout -b $Branch | Out-Null
    }
}
if ($Branch -in @('main', 'master')) {
    throw "Recusando rodar o Ralph diretamente na branch '$Branch'. Use uma feature branch."
}

if (-not (Get-Command $AgentCommand -ErrorAction SilentlyContinue)) {
    throw "Comando de agente '$AgentCommand' não encontrado no PATH. Ajuste -AgentCommand/--agent-command."
}
if (-not (Test-Path $PrdPath)) { throw "$PrdPath não encontrado." }
if (-not (Test-Path $PromptPath)) { throw "$PromptPath não encontrado." }
if (-not (Test-Path $ProgressPath)) { throw "$ProgressPath não encontrado." }

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

# ---------------------------------------------------------------------------
# TODO(human): política de aceitação/reversão de cada iteração
# ---------------------------------------------------------------------------
#
# Esta é a peça central de segurança do loop: depois que o agente roda, alguém
# precisa decidir, sem confiar no que o agente disse, se a iteração vale ser
# mantida.
#
# Contrato da função (não mude a assinatura nem o shape do retorno — o loop
# principal, mais abaixo, já depende deles):
#
#   Parâmetros:
#     -Iteration       int    número da iteração atual (para logs/commits)
#     -BeforeCommit    string hash do HEAD antes de chamar o agente
#     -ForbiddenPaths  string[] prefixos de caminho intocáveis (ver topo do arquivo)
#     -AgentOutput     string  stdout+stderr brutos do agente nesta iteração
#
#   Retorno: hashtable com pelo menos estas chaves
#     Progressed       bool   $true só quando a iteração deve contar como
#                              progresso real (zera o contador de estagnação)
#     PromiseComplete  bool   $true quando o agente sinalizou
#                              <promise>COMPLETE</promise> E tasks/ralph/prd.json
#                              (já commitado ou não) confirma todas as
#                              histórias com passes=true — nunca confie só na
#                              string do agente
#     Summary          string uma linha para o log de auditoria do loop
#
# O que a função precisa fazer, na ordem:
#   1. Calcular `git diff --name-only $BeforeCommit` para ver o que mudou.
#   2. Se algum caminho alterado começar com um prefixo de $ForbiddenPaths,
#      reverter tudo (git reset --hard + git clean -fd) e retornar sem commit.
#   3. Se não houve nenhuma mudança, retornar sem commit (não há o que rodar).
#   4. Se houve mudança em caminhos permitidos, rodar `npm run verify`
#      (Invoke-Expression/`&`, checando $LASTEXITCODE — não o texto do agente).
#   5. Decidir o que fazer quando o verify falha: reverter tudo (mantém a
#      árvore sempre em estado verde para a próxima iteração) ou manter as
#      mudanças quebradas para depuração manual? Documente a escolha num
#      comentário — ambas são defensáveis, mas o resto do loop assume que
#      você decidiu algo.
#   6. Quando o verify passa, `git add -A` + `git commit` com uma mensagem tipo
#      "ralph: iteration N - <resumo>".
#   7. Sempre acrescentar (Add-Content, nunca sobrescrever) uma linha em
#      tasks/ralph/progress.md registrando o resultado desta iteração.
#
# Guidance: pense em quantas iterações "sem progresso real" (estagnação)
# deveriam derrubar o loop antes do limite máximo — isso já está parametrizado
# em $StagnationLimit, mas é esta função que decide o que conta como
# "progresso". Um verify que falha é estagnação, ou é uma tentativa válida que
# só não deu certo ainda? Não existe resposta única certa; escolha uma e deixe
# o comentário explicando o porquê, para quem ler o histórico depois entender.

function Resolve-IterationOutcome {
    param(
        [int]$Iteration,
        [string]$BeforeCommit,
        [string[]]$ForbiddenPaths,
        [string]$AgentOutput
    )

    # TODO(human): implemente a política descrita acima.
    throw "Resolve-IterationOutcome ainda não foi implementada — veja o TODO(human) em scripts/ralph-loop.ps1."
}

# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

$promptText = Get-Content $PromptPath -Raw
$stagnationCount = 0
$completed = $false
$stopReason = "max-iterations-reached"

for ($iteration = 1; $iteration -le $MaxIterations; $iteration++) {
    Write-Host ""
    Write-Host "=== Ralph iteração $iteration/$MaxIterations (branch: $Branch) ==="

    $prd = Get-Content $PrdPath -Raw | ConvertFrom-Json
    $storiesLeft = @($prd.stories | Where-Object { -not $_.passes })
    if ($storiesLeft.Count -eq 0) {
        Write-Host "Todas as histórias já estão com passes=true. Nada a fazer."
        $completed = $true
        $stopReason = "already-complete"
        break
    }

    $beforeCommit = (git rev-parse HEAD).Trim()
    $logFile = Join-Path $LogsDir "iteration-$iteration.log"

    $agentArgs = @(
        '-p', $promptText,
        '--permission-mode', 'acceptEdits',
        '--allowedTools', 'Read Edit Write Grep Glob Bash(npm run *) Bash(npx vitest *) Bash(git status) Bash(git diff *)'
    )

    $proc = Start-Process -FilePath $AgentCommand -ArgumentList $agentArgs -NoNewWindow -PassThru `
        -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"
    $exited = $proc.WaitForExit($TimeoutMinutes * 60 * 1000)

    if (-not $exited) {
        Write-Warning "Iteração $iteration excedeu $TimeoutMinutes minutos. Encerrando o agente."
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        git reset --hard $beforeCommit | Out-Null
        git clean -fd | Out-Null
        Add-Content $ProgressPath "`n### [ralph-loop] iteração $iteration — TIMEOUT após $TimeoutMinutes min. Revertido.`n"
        $stagnationCount++
    } else {
        $agentOutput = ""
        if (Test-Path $logFile) { $agentOutput += (Get-Content $logFile -Raw -ErrorAction SilentlyContinue) }
        if (Test-Path "$logFile.err") { $agentOutput += (Get-Content "$logFile.err" -Raw -ErrorAction SilentlyContinue) }

        $verdict = Resolve-IterationOutcome -Iteration $iteration -BeforeCommit $beforeCommit `
            -ForbiddenPaths $ForbiddenPaths -AgentOutput $agentOutput

        Write-Host "  -> $($verdict.Summary)"

        if (-not $verdict.Progressed) {
            $stagnationCount++
        } else {
            $stagnationCount = 0
        }

        if ($verdict.PromiseComplete) {
            $completed = $true
            $stopReason = "promise-complete"
            break
        }
    }

    if ($stagnationCount -ge $StagnationLimit) {
        Write-Warning "Sem progresso por $stagnationCount iterações seguidas. Parando imediatamente."
        $stopReason = "stagnation"
        break
    }
}

# ---------------------------------------------------------------------------
# Validação final — só roda test:install quando o loop realmente concluiu
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "=== Fim do loop Ralph (motivo: $stopReason) ==="

npm run verify
$verifyExit = $LASTEXITCODE

if ($completed -and $verifyExit -eq 0) {
    Write-Host "Rodando validação final (npm run test:install)..."
    npm run test:install
    $installExit = $LASTEXITCODE
    Add-Content $ProgressPath "`n### [ralph-loop] validação final — verify=OK test:install exit=$installExit`n"
    if ($installExit -ne 0) {
        Write-Error "npm run test:install falhou na validação final. Revise antes de prosseguir."
        exit 1
    }
    Write-Host ""
    Write-Host "Loop concluído. Revise a branch '$Branch' manualmente antes de qualquer commit/push."
    exit 0
} else {
    Add-Content $ProgressPath "`n### [ralph-loop] loop encerrado sem conclusão — motivo=$stopReason verify=$verifyExit`n"
    Write-Warning "Loop encerrado sem concluir todas as histórias (motivo: $stopReason). Revise tasks/ralph/progress.md."
    exit 1
}
