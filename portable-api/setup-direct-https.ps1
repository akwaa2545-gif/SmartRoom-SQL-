[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $PfxPath,
  [Parameter(Mandatory = $true)] [string] $AllowedRemoteAddress,
  [Parameter(Mandatory = $true)] [string] $ApiIp,
  [Parameter(Mandatory = $true)] [string] $ApiHostname
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$firewallRuleName = 'SmartRoom Portable API HTTPS (Corporate Only)'

function Assert-Administrator {
  $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run from an elevated Command Prompt or PowerShell window.' }
}

function Set-EnvValue([string] $path, [string] $key, [string] $value) {
  $content = Get-Content -Raw $path
  $escapedKey = [regex]::Escape($key)
  if ($content -match "(?m)^$escapedKey=") {
    $content = [regex]::Replace($content, "(?m)^$escapedKey=.*$", "$key=$value")
  } else {
    $content = "$content`r`n$key=$value`r`n"
  }
  Set-Content -Path $path -Value $content -Encoding UTF8
}

Assert-Administrator
if (-not (Test-Path $PfxPath)) { throw "PFX file was not found: $PfxPath" }
if ($AllowedRemoteAddress -eq 'Any' -or [string]::IsNullOrWhiteSpace($AllowedRemoteAddress)) { throw 'AllowedRemoteAddress must be a corporate subnet or VPN range, never Any.' }
if ($ApiHostname -notmatch '^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$') { throw 'API hostname must be a fully qualified DNS name.' }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js 20 through 24 is required.' }
$nodeMajor = [int]((& node.exe --version).Trim().TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20 -or $nodeMajor -ge 25) { throw 'Node.js 20 through 24 is required.' }

$envPath = Join-Path $apiRoot '.env'
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $apiRoot '.env.example') $envPath
  throw "Created $envPath. Fill in SQL, Power Automate, and Firebase settings, then run this command again."
}
if (-not (Test-Path (Join-Path $apiRoot 'secrets\firebase-service-account.json'))) { throw 'Missing secrets\firebase-service-account.json.' }

$securePassword = Read-Host 'Enter the PFX password' -AsSecureString
$pfxPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
if ([string]::IsNullOrWhiteSpace($pfxPassword)) { throw 'A PFX password is required.' }
try { [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($PfxPath, $pfxPassword) | Out-Null } catch { throw 'The PFX password is invalid or the PFX cannot be read.' }

$secretsPath = Join-Path $apiRoot 'secrets'
New-Item -ItemType Directory -Path $secretsPath -Force | Out-Null
Copy-Item $PfxPath (Join-Path $secretsPath 'server-cert.pfx') -Force
Set-EnvValue $envPath 'PORT' '443'
Set-EnvValue $envPath 'API_LISTEN_HOST' $ApiIp
Set-EnvValue $envPath 'TLS_PFX_PATH' './secrets/server-cert.pfx'
Set-EnvValue $envPath 'TLS_PFX_PASSWORD' $pfxPassword

Push-Location $apiRoot
try { & npm.cmd ci } finally { Pop-Location }

& icacls.exe $apiRoot /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $ApiIp -LocalPort 443 -RemoteAddress $AllowedRemoteAddress -Profile Domain | Out-Null

$serviceScript = Join-Path $apiRoot 'run-api-service.ps1'
$taskAction = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$serviceScript`""
schtasks.exe /Create /TN 'SmartRoom Portable API' /SC ONSTART /RU SYSTEM /RL HIGHEST /TR $taskAction /F | Out-Null
schtasks.exe /Run /TN 'SmartRoom Portable API' | Out-Null

Write-Host ''
Write-Host 'Direct HTTPS setup completed.' -ForegroundColor Green
Write-Host "Test from a domain PC: https://$ApiHostname/health"
