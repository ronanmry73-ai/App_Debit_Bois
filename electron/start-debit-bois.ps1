$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Test-PortOpen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(300)
    if ($ok -and $client.Connected) { $client.Close(); return $true }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    "Node.js / npm est introuvable.`nInstalle Node.js LTS depuis https://nodejs.org puis relance.",
    "Debit Bois"
  ) | Out-Null
  exit 1
}

$devJob = $null
if (-not (Test-PortOpen 8080)) {
  $devJob = Start-Process -FilePath $npm.Source -ArgumentList "run","dev" `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep -Milliseconds 400
    if (Test-PortOpen 8080) { break }
    if ($devJob.HasExited) {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show(
        "Le serveur n'a pas demarre. Ouvre VS Code, lance npm install puis reessaie.",
        "Debit Bois"
      ) | Out-Null
      exit 1
    }
  } while ((Get-Date) -lt $deadline)

  if (-not (Test-PortOpen 8080)) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "Timeout : http://localhost:8080 ne repond pas.",
      "Debit Bois"
    ) | Out-Null
    exit 1
  }
}

$env:DEBIT_BOIS_URL = "http://127.0.0.1:8080"
$electronExe = Join-Path $Root "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    "Electron n'est pas installe.`nDans VS Code : npm install",
    "Debit Bois"
  ) | Out-Null
  exit 1
}

$elec = Start-Process -FilePath $electronExe -ArgumentList "." `
  -WorkingDirectory $Root `
  -PassThru

Wait-Process -Id $elec.Id -ErrorAction SilentlyContinue

if ($devJob -and -not $devJob.HasExited) {
  Stop-Process -Id $devJob.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process |
    Where-Object { $_.ParentProcessId -eq $devJob.Id } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
