$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $projectPath 'ESPNFantasyImporter.cs'
$outputPath = Join-Path $projectPath 'ESPN Fantasy Importer.exe'

Add-Type -TypeDefinition (Get-Content -Raw $sourcePath) -OutputAssembly $outputPath -OutputType ConsoleApplication
Write-Host "Created: $outputPath"