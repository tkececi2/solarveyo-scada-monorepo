$ErrorActionPreference = "Stop"
param(
  [Parameter(Mandatory=$true)][string]$PlistPath,
  [string]$OutPath = "GOOGLE_PLIST.txt"
)

if (!(Test-Path $PlistPath)) {
  Write-Error "Plist not found: $PlistPath"
}

$bytes = [IO.File]::ReadAllBytes($PlistPath)
$base64 = [Convert]::ToBase64String($bytes)
Set-Content -Path $OutPath -Value $base64 -Encoding Ascii
Write-Host "Base64 written to: $OutPath"
