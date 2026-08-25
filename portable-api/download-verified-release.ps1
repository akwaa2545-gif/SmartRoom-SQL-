param(
  [Parameter(Mandatory = $true)]
  [string]$Tag,
  [string]$Repository = 'akwaa2545-gif/SmartRoom-SQL-',
  [string]$Destination = "$env:ProgramData\SmartRoom\verified-releases"
)

$ErrorActionPreference = 'Stop'
$archiveName = 'portable-api-release.zip'

if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI is required. Install it with: winget install GitHub.cli'
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("smartroom-release-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
  & gh.exe release download $Tag --repo $Repository --pattern $archiveName --dir $temporaryDirectory
  if ($LASTEXITCODE -ne 0) { throw "Could not download release $Tag from $Repository." }

  $archivePath = Join-Path $temporaryDirectory $archiveName
  if (-not (Test-Path -LiteralPath $archivePath)) { throw "Release $Tag did not contain $archiveName." }

  & gh.exe attestation verify $archivePath --repo $Repository
  if ($LASTEXITCODE -ne 0) { throw "Release $Tag failed GitHub attestation verification." }

  $verifiedArchivePath = Join-Path $Destination "$Tag-$archiveName"
  Move-Item -LiteralPath $archivePath -Destination $verifiedArchivePath -Force
  $hash = (Get-FileHash -LiteralPath $verifiedArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host "Verified release saved to $verifiedArchivePath" -ForegroundColor Green
  Write-Host "SHA256: $hash"
} finally {
  Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
