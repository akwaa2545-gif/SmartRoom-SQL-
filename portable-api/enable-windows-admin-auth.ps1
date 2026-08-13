[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $AdminGroup
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteName = 'SmartRoom Portable API'
$sitePath = Join-Path $env:SystemDrive 'inetpub\smartroom-portable-api'
$webConfigPath = Join-Path $sitePath 'web.config'
$appCmd = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'

function Assert-Administrator {
  $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this command from an elevated Command Prompt or PowerShell window.'
  }
}

Assert-Administrator
if ($AdminGroup -notmatch '^[^\\/]+\\[^\\/]+$') {
  throw 'AdminGroup must be a Windows domain group in DOMAIN\GroupName format.'
}
if (-not (Test-Path $webConfigPath)) {
  throw "IIS site configuration was not found: $webConfigPath. Run setup-host-pc.cmd first."
}
if (-not (Test-Path $appCmd)) { throw 'IIS appcmd.exe was not found. Run setup-host-pc.cmd first.' }

Write-Host 'Enabling IIS Windows Authentication...'
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WindowsAuthentication -All -NoRestart | Out-Null
Import-Module WebAdministration
if (-not (Test-Path "IIS:\Sites\$siteName")) {
  throw "IIS site '$siteName' was not found. Run setup-host-pc.cmd first."
}

$backupPath = "$webConfigPath.smartroom-admin-auth.$(Get-Date -Format 'yyyyMMddHHmmss').bak"
Copy-Item -LiteralPath $webConfigPath -Destination $backupPath -Force

try {
  [xml]$config = Get-Content -LiteralPath $webConfigPath -Raw
  $existingLocation = @($config.configuration.location | Where-Object { $_.path -eq 'api/admin' })
  foreach ($location in $existingLocation) {
    $config.configuration.RemoveChild($location) | Out-Null
  }

  $location = $config.CreateElement('location')
  $location.SetAttribute('path', 'api/admin')
  $systemWebServer = $config.CreateElement('system.webServer')
  $security = $config.CreateElement('security')
  $authentication = $config.CreateElement('authentication')
  $anonymousAuthentication = $config.CreateElement('anonymousAuthentication')
  $anonymousAuthentication.SetAttribute('enabled', 'false')
  $windowsAuthentication = $config.CreateElement('windowsAuthentication')
  $windowsAuthentication.SetAttribute('enabled', 'true')
  $authentication.AppendChild($anonymousAuthentication) | Out-Null
  $authentication.AppendChild($windowsAuthentication) | Out-Null
  $authorization = $config.CreateElement('authorization')
  $authorization.AppendChild($config.CreateElement('clear')) | Out-Null
  $allow = $config.CreateElement('add')
  $allow.SetAttribute('accessType', 'Allow')
  $allow.SetAttribute('roles', $AdminGroup)
  $deny = $config.CreateElement('add')
  $deny.SetAttribute('accessType', 'Deny')
  $deny.SetAttribute('users', '*')
  $authorization.AppendChild($allow) | Out-Null
  $authorization.AppendChild($deny) | Out-Null
  $security.AppendChild($authentication) | Out-Null
  $security.AppendChild($authorization) | Out-Null
  $systemWebServer.AppendChild($security) | Out-Null
  $location.AppendChild($systemWebServer) | Out-Null
  $config.configuration.InsertBefore($location, $config.configuration.system.webServer) | Out-Null
  $config.Save($webConfigPath)

  & $appCmd list config $siteName /config /xml | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'IIS rejected the generated configuration.' }
  schtasks.exe /End /TN 'SmartRoom Portable API' 2>$null | Out-Null
  Restart-WebItem "IIS:\Sites\$siteName"
  schtasks.exe /Run /TN 'SmartRoom Portable API' | Out-Null
} catch {
  Copy-Item -LiteralPath $backupPath -Destination $webConfigPath -Force
  Restart-WebItem "IIS:\Sites\$siteName" -ErrorAction SilentlyContinue
  throw
}

Write-Host ''
Write-Host 'Windows authentication is enabled for /api/admin only.' -ForegroundColor Green
Write-Host "Allowed group: $AdminGroup"
Write-Host "Backup created: $backupPath"
Write-Host 'Normal mail lookup and booking routes stay anonymous for the SmartRoom website.'
