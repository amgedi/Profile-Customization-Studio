param([switch]$SkipBuild, [switch]$NoRootBackups)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo
if (-not $SkipBuild) {
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Studio build failed' }
  & cargo build --release --workspace
  if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
}
$version = (Get-Content -LiteralPath (Join-Path $repo 'apps/studio/package.json') -Raw | ConvertFrom-Json).version
$install = Join-Path $repo 'artifacts/development'
$versionDir = Join-Path $install "studio/versions/$version"
$studioTarget = Join-Path $versionDir 'Profile Customization Studio.exe'
$studioSource = Join-Path $repo 'target/release/pcs-studio.exe'
$builtAsset = [regex]::Match((Get-Content -LiteralPath (Join-Path $repo 'apps/studio/dist/index.html') -Raw), 'assets/(index-[A-Za-z0-9_-]+\.js)').Groups[1].Value
$binaryText = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($studioSource))
if (-not $builtAsset -or -not $binaryText.Contains($builtAsset)) { throw 'The native binary does not embed the current renderer. Rebuild the native Studio before packaging.' }
$binaryText = $null
$hash = (Get-FileHash -LiteralPath $studioSource -Algorithm SHA256).Hash
if ((Test-Path -LiteralPath $studioTarget) -and (Get-FileHash -LiteralPath $studioTarget).Hash -ne $hash) {
  throw "The immutable local install $version already exists with different bytes. Preserve it and choose a new development version before packaging."
}
New-Item -ItemType Directory -Path $versionDir -Force | Out-Null
Copy-Item -LiteralPath $studioSource -Destination $studioTarget -Force
# Preserve the genuine pre-reconstruction build as a rollback option.
$legacyDir = Join-Path $install 'studio/versions/0.2.5-dev'
if (-not (Test-Path -LiteralPath $legacyDir)) {
  $legacySource = Join-Path $env:APPDATA 'ProfileCustomizationStudio/studio/versions/0.2.5-dev'
  if (Test-Path -LiteralPath $legacySource) { Copy-Item -LiteralPath $legacySource -Destination $legacyDir -Recurse }
}
$timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
@{version=$version;exe_sha256=$hash;installed_at=$timestamp} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $versionDir 'install-manifest.json') -Encoding utf8
$pointerPath = Join-Path $install 'studio/current.json'
$oldPointer = if (Test-Path -LiteralPath $pointerPath) { Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json } else { $null }
$previous = if ($oldPointer -and $oldPointer.version -ne $version -and (Test-Path -LiteralPath (Join-Path $install "studio/versions/$($oldPointer.version)/Profile Customization Studio.exe"))) { $oldPointer.version } elseif ($oldPointer -and $oldPointer.previousVersion) { $oldPointer.previousVersion } elseif (Test-Path -LiteralPath $legacyDir) { '0.2.5-dev' } else { $null }
@{version=$version;path="studio/versions/$version/Profile Customization Studio.exe";healthVerified=$false;activatedAt=$timestamp;previousVersion=$previous} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $install 'studio/current.json') -Encoding utf8
$copies = @{
  'Profile Customization Studio.exe' = 'pcs-studio.exe'
  'Profile Customization Studio Launcher.exe' = 'pcs-launcher.exe'
  'pcs-update-helper.exe' = 'pcs-update-helper.exe'
}
foreach ($name in $copies.Keys) {
  $target = Join-Path $repo $name
  $source = Join-Path $repo ('target/release/' + $copies[$name])
  if ((Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $target).Hash -eq (Get-FileHash -LiteralPath $source).Hash) { continue }
  if (-not $NoRootBackups -and (Test-Path -LiteralPath $target)) {
    $backupDir = Join-Path $repo ('artifacts/root-backups/' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item -LiteralPath $target -Destination (Join-Path $backupDir $name)
  }
  Copy-Item -LiteralPath $source -Destination $target -Force
}
Get-FileHash -LiteralPath (Join-Path $repo 'Profile Customization Studio.exe'), (Join-Path $repo 'Profile Customization Studio Launcher.exe'), (Join-Path $repo 'pcs-update-helper.exe') | Select-Object Path,Hash | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $install 'binary-hashes.json') -Encoding utf8
Write-Output "Local development build $version is ready. Open Profile Customization Studio Launcher.exe in the project root."
