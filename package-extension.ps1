$projectPath = Get-Location
$projectName = Split-Path $projectPath -Leaf

$stagingRoot = Join-Path $env:TEMP "extension_build"
$extensionFolder = Join-Path $stagingRoot $projectName
$zipPath = Join-Path $projectPath "$projectName.zip"

$filesToCopy = @(
    "inject.js",
    "content.js",
    "manifest.json",
    "icon128.png",
    "LICENSE"
)

Write-Host "Building package for: $projectName"

# cleanup
if (Test-Path $stagingRoot) {
    Remove-Item $stagingRoot -Recurse -Force
}

# create structure
New-Item -ItemType Directory -Path $extensionFolder | Out-Null

# copy extension files
foreach ($file in $filesToCopy) {
    $source = Join-Path $projectPath $file
    if (Test-Path $source) {
        Copy-Item $source -Destination $extensionFolder
        Write-Host "Copied: $file"
    } else {
        Write-Warning "Missing file: $file"
    }
}

# create README.txt (not md!)
$readmePath = Join-Path $stagingRoot "README.txt"

$readmeContent = @"
INSTALLATION:

1. Download and unzip this package
2. Open Chrome or Brave
3. Go to:
   chrome://extensions/
   or
   brave://extensions/

4. Enable Developer Mode
5. Click 'Load unpacked'
6. Select the folder: $projectName

Done.
"@

$readmeContent | Out-File -Encoding UTF8 $readmePath

# remove old zip
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# zip EVERYTHING inside stagingRoot (important!)
Compress-Archive -Path "$stagingRoot\*" -DestinationPath $zipPath

Write-Host ""
Write-Host "ZIP created: $zipPath"

# cleanup
Remove-Item $stagingRoot -Recurse -Force
Write-Host "Temporary files cleaned."