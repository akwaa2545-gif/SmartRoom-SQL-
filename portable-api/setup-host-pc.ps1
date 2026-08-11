[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $CertificateThumbprint,
  [Parameter(Mandatory = $true)] [string] $AllowedRemoteAddress,
  [Parameter(Mandatory = $true)] [string] $ApiIp,
  [Parameter(Mandatory = $true)] [string] $ApiHostname
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteName = 'SmartRoom Portable API'
$appPoolName = 'SmartRoomPortableApiPool'
$firewallRuleName = 'SmartRoom Portable API HTTPS (Corporate Only)'
$appCmd = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run setup-host-pc.cmd from an elevated Command Prompt (Run as administrator).'
  }
}

function Assert-PrivateAddress {
  $parsed = [System.Net.IPAddress]::Parse($ApiIp)
  $bytes = $parsed.GetAddressBytes()
  $private = ($bytes[0] -eq 10) -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
  if (-not $private) { throw 'API IP must be an RFC1918 private address.' }
  if ($AllowedRemoteAddress -eq 'Any' -or [string]::IsNullOrWhiteSpace($AllowedRemoteAddress)) {
    throw 'AllowedRemoteAddress must be a specific corporate subnet or VPN range, never Any.'
  }
}

function Assert-Hostname {
  if ($ApiHostname -notmatch '^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$') {
    throw 'API hostname must be a fully qualified DNS name, for example THBTCADT-L04713.KEMET.COM.'
  }
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

function Install-OptionalMsi([string] $fileName, [string] $description) {
  $path = Join-Path $apiRoot "installers\$fileName"
  if (-not (Test-Path $path)) {
    throw "Missing $description installer: $path. Download the company-approved MSI, save it with this exact name, then re-run this command."
  }
  if ((Get-AuthenticodeSignature -FilePath $path).Status -ne 'Valid') {
    throw "$description installer is not signed by a trusted publisher: $path"
  }
  Write-Host "Installing $description..."
  $process = Start-Process msiexec.exe -ArgumentList @('/i', "`"$path`"", '/qn', '/norestart') -Wait -PassThru
  if ($process.ExitCode -notin 0, 3010) { throw "$description installer failed with exit code $($process.ExitCode)." }
}

function Install-OptionalExe([string] $fileName, [string] $description) {
  $path = Join-Path $apiRoot "installers\$fileName"
  if (-not (Test-Path $path)) {
    throw "Missing $description installer: $path. Download the company-approved installer, save it with this exact name, then re-run this command."
  }
  if ((Get-AuthenticodeSignature -FilePath $path).Status -ne 'Valid') {
    throw "$description installer is not signed by a trusted publisher: $path"
  }
  Write-Host "Installing $description..."
  $process = Start-Process $path -ArgumentList @('/quiet', '/norestart') -Wait -PassThru
  if ($process.ExitCode -notin 0, 3010) { throw "$description installer failed with exit code $($process.ExitCode)." }
}

Assert-Administrator
Assert-PrivateAddress
Assert-Hostname

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw 'Node.js 20 LTS is required. Install it first, then re-run this command.'
}
$nodeMajor = [int]((& node.exe --version).Trim().TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20 -or $nodeMajor -ge 25) { throw 'Node.js 20 through 24 is required on the host PC.' }

Write-Host 'Enabling IIS...'
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole,IIS-WebServer,IIS-ManagementConsole -All -NoRestart | Out-Null

Import-Module WebAdministration
if (-not (Get-WebGlobalModule -Name RewriteModule -ErrorAction SilentlyContinue)) {
  Install-OptionalMsi 'url-rewrite.msi' 'IIS URL Rewrite'
}
if (-not (Get-WebGlobalModule -Name ApplicationRequestRouting -ErrorAction SilentlyContinue)) {
  Install-OptionalExe 'arr-setup-x64.exe' 'IIS Application Request Routing'
}

Import-Module WebAdministration
if (-not (Get-WebGlobalModule -Name RewriteModule -ErrorAction SilentlyContinue) -or
    -not (Get-WebGlobalModule -Name ApplicationRequestRouting -ErrorAction SilentlyContinue)) {
  throw 'IIS URL Rewrite or ARR is unavailable after installation. Restart the PC if prompted, then run setup again.'
}

$certificate = Get-ChildItem "Cert:\LocalMachine\My\$CertificateThumbprint" -ErrorAction SilentlyContinue
if (-not $certificate) { throw 'The requested certificate was not found in Local Computer\Personal.' }
if ($certificate.NotAfter -lt (Get-Date)) { throw 'The requested certificate is expired.' }
if (-not $certificate.HasPrivateKey) { throw 'The requested certificate does not include its private key.' }
$certificateDnsNames = @($certificate.DnsNameList | ForEach-Object { $_.Unicode })
if ($certificateDnsNames -notcontains $ApiHostname) { throw "The certificate does not contain the DNS name $ApiHostname." }

if (-not (Test-Path (Join-Path $apiRoot '.env'))) {
  Copy-Item (Join-Path $apiRoot '.env.example') (Join-Path $apiRoot '.env')
  throw "Created $apiRoot\.env. Fill in the required secrets and service-account path, then re-run setup-host-pc.cmd."
}
if (-not (Test-Path (Join-Path $apiRoot 'secrets\firebase-service-account.json'))) {
  throw 'Missing secrets\firebase-service-account.json. Add the restricted Firebase service-account key, then re-run setup-host-pc.cmd.'
}
& icacls.exe (Join-Path $apiRoot 'secrets') /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null

# IIS owns the public TLS endpoint. Node stays private on localhost so it
# cannot bypass IIS authentication and authorization rules.
schtasks.exe /End /TN 'SmartRoom Portable API' 2>$null | Out-Null
Set-EnvValue (Join-Path $apiRoot '.env') 'PORT' '8787'
Set-EnvValue (Join-Path $apiRoot '.env') 'API_LISTEN_HOST' '127.0.0.1'
Set-EnvValue (Join-Path $apiRoot '.env') 'TLS_PFX_PATH' ''
Set-EnvValue (Join-Path $apiRoot '.env') 'TLS_PFX_PASSWORD' ''

Write-Host 'Installing portable API dependencies...'
Push-Location $apiRoot
try { & npm.cmd ci } finally { Pop-Location }

# The startup task runs this code as SYSTEM. Prevent non-administrators from
# replacing JavaScript or PowerShell files and turning that task into escalation.
& icacls.exe $apiRoot /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' /T /C | Out-Null

if (-not (Test-Path $appCmd)) { throw 'IIS appcmd.exe was not found after enabling IIS.' }

& $appCmd set config -section:system.webServer/proxy /enabled:"True" /commit:apphost | Out-Null
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
  New-WebAppPool -Name $appPoolName | Out-Null
}
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ''

$sitePath = Join-Path $env:SystemDrive 'inetpub\smartroom-portable-api'
New-Item -ItemType Directory -Path $sitePath -Force | Out-Null
$webConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Reverse proxy to Smart Room API" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:8787/{R:1}" appendQueryString="true" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
"@
$webConfigPath = Join-Path $sitePath 'web.config'
if (Test-Path $webConfigPath) {
  $existingConfig = Get-Content -Raw $webConfigPath
  if ($existingConfig -notmatch 'Reverse proxy to Smart Room API') {
    throw "Refusing to overwrite existing IIS configuration: $webConfigPath"
  }
} else {
  Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
}

$bindingPath = "IIS:\SslBindings\$ApiIp!443!$ApiHostname"
if (Test-Path $bindingPath) {
  $existingSslBinding = Get-Item $bindingPath
  if ($existingSslBinding.Thumbprint -ne $certificate.Thumbprint) {
    throw "HTTPS binding $ApiIp`:443 already uses another certificate. Refusing to replace it automatically."
  }
}

if (Test-Path "IIS:\Sites\$siteName") {
  Remove-WebBinding -Name $siteName -Protocol https -Port 443 -IPAddress $ApiIp -HostHeader $ApiHostname -ErrorAction SilentlyContinue
} else {
  New-Website -Name $siteName -PhysicalPath $sitePath -ApplicationPool $appPoolName -Port 8088 -IPAddress '127.0.0.1' | Out-Null
}
New-WebBinding -Name $siteName -Protocol https -Port 443 -IPAddress $ApiIp -HostHeader $ApiHostname -SslFlags 1 | Out-Null
if (-not (Test-Path $bindingPath)) {
  New-Item $bindingPath -Thumbprint $certificate.Thumbprint -SSLFlags 1 | Out-Null
}

Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $ApiIp -LocalPort 443 -RemoteAddress $AllowedRemoteAddress -Profile Domain | Out-Null

$serviceScript = Join-Path $apiRoot 'run-api-service.ps1'
$taskAction = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$serviceScript`""
schtasks.exe /Create /TN 'SmartRoom Portable API' /SC ONSTART /RU SYSTEM /RL HIGHEST /TR $taskAction /F | Out-Null
schtasks.exe /Run /TN 'SmartRoom Portable API' | Out-Null

Write-Host ''
Write-Host 'Host setup completed.' -ForegroundColor Green
Write-Host 'The API has been installed as the SmartRoom Portable API startup task.'
Write-Host "Then test from a domain PC: https://$ApiHostname/health"
