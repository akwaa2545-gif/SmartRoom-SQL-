[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $Username,
  [Parameter(Mandatory = $true)] [ValidateSet('SUPER_ADMIN', 'APPROVER')] [string] $Role
)

$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $apiRoot '.env'

function Assert-Administrator {
  $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run from an elevated PowerShell or Command Prompt.' }
}

function Set-EnvValue([string] $path, [string] $key, [string] $value) {
  $content = Get-Content -Raw $path
  $escapedKey = [regex]::Escape($key)
  $next = if ($content -match "(?m)^$escapedKey=") { [regex]::Replace($content, "(?m)^$escapedKey=.*$", "$key=$value") } else { "$content`r`n$key=$value`r`n" }
  Set-Content -Path $path -Value $next -Encoding UTF8
}

Assert-Administrator
if (-not (Test-Path $envPath)) { throw "Missing $envPath. Run the API setup first." }
$password = Read-Host "New password for $Username (12 or more characters)" -AsSecureString
$confirm = Read-Host 'Confirm password' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $password).Password
$confirmation = [System.Net.NetworkCredential]::new('', $confirm).Password
if ($plain.Length -lt 12) { throw 'Password must contain at least 12 characters.' }
if ($plain -cne $confirmation) { throw 'Passwords do not match.' }

$existingSecret = Get-Content $envPath | Where-Object { $_ -match '^ADMIN_SESSION_SIGNING_SECRET=' } | Select-Object -First 1
if (-not $existingSecret -or $existingSecret -eq 'ADMIN_SESSION_SIGNING_SECRET=') {
  $random = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
  Set-EnvValue $envPath 'ADMIN_SESSION_SIGNING_SECRET' ([Convert]::ToBase64String($random))
}

try {
  $env:SMARTROOM_ADMIN_SETUP_PASSWORD = $plain
  & node.exe (Join-Path $apiRoot 'src\initialize-admin-user.js') $Username $Role
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the Admin credential record.' }
} finally {
  Remove-Item Env:SMARTROOM_ADMIN_SETUP_PASSWORD -ErrorAction SilentlyContinue
  $plain = ''
  $confirmation = ''
}

Write-Host "Admin '$Username' is ready in SQL Server for the SmartRoom PC API." -ForegroundColor Green
