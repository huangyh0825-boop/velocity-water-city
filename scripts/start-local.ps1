$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:5174/'
function Test-GameResponse([string]$content) {
    $indexPath = Join-Path $projectRoot 'dist\index.html'
    if (-not (Test-Path -LiteralPath $indexPath)) { return $false }
    $index = [System.IO.File]::ReadAllText($indexPath)
    $asset = [regex]::Match($index, 'src="\./assets/([^\"]+)"')
    return $asset.Success -and $content.Contains($asset.Groups[1].Value)
}

try {
    # An already running preview is reused. Never stop an unrelated process on this port.
    $listener = Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue
    if ($listener) {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
        if (-not (Test-GameResponse $response.Content)) { throw 'Port 5174 is occupied by another application.' }
    } else {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
            Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
        }
        if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install Node.js or run this from Codex.' }
        $vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Project dependencies are missing. Run npm install first.' }
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html'))) {
            Push-Location -LiteralPath $projectRoot
            try {
                & $nodePath 'node_modules/typescript/bin/tsc' '--noEmit'
                if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
                & $nodePath 'node_modules/vite/bin/vite.js' 'build'
                if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
            } finally { Pop-Location }
        }
        $logRoot = Join-Path $projectRoot '.qa'
        New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
        $server = Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5174','--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'local-preview.log') -RedirectStandardError (Join-Path $logRoot 'local-preview-error.log')
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if ($server.HasExited) { throw 'Preview exited. See .qa/local-preview-error.log.' }
            try {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
                if ($response.StatusCode -eq 200 -and (Test-GameResponse $response.Content)) { $ready = $true; break }
            } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $ready) { throw 'Preview did not become ready. See .qa/local-preview-error.log.' }
    }
    Write-Host "Local preview is ready: $url"
    Start-Process $url
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
