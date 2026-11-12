[CmdletBinding()]
param(
    [string]$Chromium = $env:GP_TEST_CHROMIUM,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$guard = Join-Path $PSScriptRoot 'frontend_release.py'
$server = 'ubuntu@94.101.176.78'
$socket = '/tmp/goldenpath-door-prod.sock'
$ssh = @('ssh', '-S', $socket, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', $server)

function Invoke-Native {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
}

$commit = (Invoke-Native git @('-C', $repository, 'rev-parse', 'HEAD')).Trim()
Invoke-Native python @($guard, 'check-main', $commit)
if ($CheckOnly) { return }

if (-not $Chromium) {
    $Chrome = Get-Item 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    $Chromium = $Chrome.FullName
}

$work = [IO.Directory]::CreateTempSubdirectory('goldenpath-frontend-').FullName
$source = Join-Path $work 'source'
$oldBrowser = $env:GP_TEST_CHROMIUM
$oldPort = $env:GP_TEST_PORT
try {
    New-Item -ItemType Directory -Path $source | Out-Null
    $archive = Join-Path $work 'source.tar'
    Invoke-Native git @('-C', $repository, 'archive', '--format=tar', '--output', $archive, $commit)
    Invoke-Native tar.exe @('-xf', $archive, '-C', $source)
    Push-Location $source
    try {
        $env:GP_TEST_CHROMIUM = $Chromium
        $env:GP_TEST_PORT = '5199'
        Invoke-Native npm.cmd @('ci')
        if (-not $Chromium) { Invoke-Native npx.cmd @('playwright', 'install', 'chromium') }
        Invoke-Native npm.cmd @('test')
        Invoke-Native npm.cmd @('run', 'build')
        Invoke-Native npm.cmd @('run', 'test:pwa-cache')
        Invoke-Native npm.cmd @(
            'run', 'test:browser', '--', '--timeout', '120000',
            'admin-permissions.spec.js', 'cultural-media.spec.js', 'rng-qr-correction.spec.js',
            'engineering-basemap.spec.js', 'multifloor-navigation.spec.js',
            'enduser-reliability.spec.js', 'poi-endpoint-search.spec.js',
            '--grep', 'guidance table keeps|a new guidance point switches|editing guidance opens|reports actual upload|reuses its server ID|cultural table keeps|QR correction|RNG scans|invalid QR|cancelling a route|changes the basemap after the transfer step|RNG previews transfers|language service outage|language dropdown and place return|thumbnail'
        )
        Invoke-Native python @($guard, 'manifest', 'dist', $commit, (Join-Path $work 'release.json'))
    } finally {
        Pop-Location
    }

    $stage = (Invoke-Native wsl.exe (@('-d', 'Ubuntu', '--') + $ssh +
        @('mktemp', '-d', '/home/ubuntu/deploy_app/frontend-release-XXXXXXXX'))).Trim()
    if ($stage -notmatch '^/home/ubuntu/deploy_app/frontend-release-[A-Za-z0-9]{8}$') {
        throw 'Unexpected production staging directory.'
    }
    $unixWork = (Invoke-Native wsl.exe @('-d', 'Ubuntu', '--', 'wslpath', '-a', $work)).Trim()
    $transport = "ssh -S $socket -o BatchMode=yes -o ConnectTimeout=8"
    Invoke-Native wsl.exe @('-d', 'Ubuntu', '--', 'rsync', '-z', '-e', $transport,
        '--', "$unixWork/release.json", "${server}:$stage/")
    Invoke-Native wsl.exe @('-d', 'Ubuntu', '--', 'rsync', '-rcz', '-e', $transport,
        '--compare-dest=/opt/golden_path_stack/frontend/dist', '--',
        "$unixWork/source/dist/", "${server}:$stage/frontend/")
    Invoke-Native wsl.exe (@('-d', 'Ubuntu', '--') + $ssh +
        @('sudo', '-n', 'python3', '/opt/golden_path_stack/scripts/frontend_release.py', 'publish', $stage))
} finally {
    $env:GP_TEST_CHROMIUM = $oldBrowser
    $env:GP_TEST_PORT = $oldPort
    $resolved = (Resolve-Path -LiteralPath $work).Path
    $parent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
    if ([IO.Path]::GetDirectoryName($resolved) -eq $parent -and (Split-Path -Leaf $resolved) -like 'goldenpath-frontend-*') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
