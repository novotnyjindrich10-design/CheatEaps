# Ceka na platny Resend klic ve schrance, zapise .env a spusti Preview e-mail stack.
# Hodnotu klice NIKDY nevypisuje. Produkci nemeni.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\wait-clipboard-resend-and-apply.ps1
#
param(
  [int]$TimeoutSec = 600,
  [switch]$SkipRedeploy
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Normalize-ResendKey([string]$raw) {
  if ($null -eq $raw) { return '' }
  $value = [string]$raw
  $value = $value -replace "[\u200B-\u200D\uFEFF\u00A0]", ''
  $value = $value.Trim().Trim([char[]]@([char]13, [char]10, [char]9))
  $value = $value.Trim([char[]]@([char]34, [char]39))
  if ($value -match '^(?i)bearer\s+(.+)$') {
    $value = $Matches[1].Trim().Trim([char[]]@([char]34, [char]39))
  }
  if ($value -match '^(?i)RESEND_API_KEY\s*=\s*(.+)$') {
    $value = $Matches[1].Trim().Trim([char[]]@([char]34, [char]39))
  }
  return ($value -replace '\s+', '')
}

function Test-Accepted([string]$value) {
  if ($value -match '^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$') { return $true }
  if ($value -match '^re_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,64}$') { return $true }
  return $false
}

Write-Host 'Cekam na Resend API klic ve schrance Windows...'
Write-Host '1) Prihlas se do Resend (prohlizec uz ma GitHub login).'
Write-Host '2) Zrus stary klic, vytvor novy Sending key, zkopiruj ho (Ctrl+C).'
Write-Host '3) Nic dalsiho nespoustej — tenhle skript dokoncí .env, Vercel Preview, SMTP (pokud je SUPABASE_ACCESS_TOKEN) a redeploy.'
Write-Host ("Timeout {0}s." -f $TimeoutSec)

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$found = $false
while ((Get-Date) -lt $deadline) {
  try { $clip = Get-Clipboard -Raw -ErrorAction Stop } catch { $clip = '' }
  $key = Normalize-ResendKey ([string]$clip)
  if (Test-Accepted $key) {
    $found = $true
    Write-Host ("Nalezen platny klic ve schrance (delka={0}). Zapisuji .env..." -f $key.Length)
    # Zapis jen pres existujici skript — znovu ze schranky, bez argv.
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'write-resend-env.ps1') -Clipboard
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Zapis .env selhal.'
      exit $LASTEXITCODE
    }
    $args = @('scripts/apply-preview-email-stack.mjs')
    if (-not $SkipRedeploy) { $args += '--redeploy' }
    Write-Host 'Spoustim Preview e-mail stack...'
    & node @args
    exit $LASTEXITCODE
  }
  Start-Sleep -Seconds 2
}

if (-not $found) {
  Write-Host 'Timeout: ve schrance nebyl platny Resend klic. Nic nezapsano.'
  exit 3
}
