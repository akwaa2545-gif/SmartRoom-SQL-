$ErrorActionPreference = 'Continue'
$apiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $apiRoot

while ($true) {
  & node.exe src\server.js
  Start-Sleep -Seconds 5
}
