param(
  [Parameter(Mandatory = $true)]
  [string]$TaskUser
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Split-Path -Parent $apiRoot
$markerPath = Join-Path $apiRoot '.deploy-agent'
$entryPoint = Join-Path $apiRoot 'run-deployment-supervisor.cmd'

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required.' }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not (Test-Path (Join-Path $apiRoot '.env'))) { throw 'Configure portable-api\.env before installing the deployment agent.' }
& git.exe -C $repositoryRoot rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The deployment agent must be installed from a Git deployment clone.' }
$trackedChanges = & git.exe -C $repositoryRoot status --porcelain --untracked-files=no
if ($trackedChanges) { throw 'Deployment clone has tracked local changes. Resolve them before installing the agent.' }
$originUrl = & git.exe -C $repositoryRoot remote get-url origin
if (-not $originUrl) { throw 'Deployment clone must define an origin remote.' }

Set-Content -LiteralPath $markerPath -Value 'SMARTROOM_PORTABLE_API_DEPLOYMENT_CLONE' -NoNewline
& schtasks.exe /End /TN 'SmartRoom Portable API' 2>$null
& schtasks.exe /Delete /TN 'SmartRoom Portable API' /F 2>$null
$taskAction = "cmd.exe /c `"$entryPoint`""
& schtasks.exe /Create /TN 'SmartRoom Portable API Deployment Agent' /SC ONSTART /RU $TaskUser /RP '*' /RL LIMITED /TR $taskAction /F
if ($LASTEXITCODE -ne 0) { throw 'Could not create the deployment task.' }
& schtasks.exe /Run /TN 'SmartRoom Portable API Deployment Agent'
if ($LASTEXITCODE -ne 0) { throw 'Deployment task was created but could not be started.' }

Write-Host 'Deployment agent task installed and the legacy API task was removed. The Task Scheduler password prompt applies only to the deployment account.' -ForegroundColor Green
