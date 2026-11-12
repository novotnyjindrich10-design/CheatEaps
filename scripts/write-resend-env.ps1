# Bezpecne doplneni Resend promennych do .env (mimo Git).
# Vychozi: lokalni Windows dialog s maskovanym polem (ne Chat, ne CLI arg, ne temp soubor).
# Zaloha: -Console pouzije Read-Host -AsSecureString (v Agent terminalu obvykle nefunguje).
#
#   powershell -STA -ExecutionPolicy Bypass -File scripts\write-resend-env.ps1
#   powershell -STA -ExecutionPolicy Bypass -File scripts\write-resend-env.ps1 -Console
#
param(
  [string]$ToEmail = 'foodgocz@gmail.com',

  [string]$FromEmail = 'FoodGo <onboarding@resend.dev>',

  [switch]$Console
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $root '.env.example') $envPath
  Write-Host 'Vytvoren .env ze .env.example'
}

$to = $ToEmail.Trim()
$from = $FromEmail.Trim()
if (-not $to -or ($to -notmatch '^[^@\s]+@[^@\s]+\.[^\s@]+$')) {
  Write-Host 'INQUIRY_TO_EMAIL neni platny e-mail. Nic nezapsano.'
  exit 1
}
if (-not $from -or ($from -notmatch '@')) {
  Write-Host 'EMAIL_FROM neni platny. Nic nezapsano.'
  exit 1
}

function Set-EnvLine([string]$content, [string]$key, [string]$value) {
  $pattern = "(?m)^$([regex]::Escape($key))=.*$"
  $line = "$key=$value"
  if ($content -match $pattern) {
    return [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line })
  }
  if ($content.Length -gt 0 -and -not $content.EndsWith("`n") -and -not $content.EndsWith("`r`n")) {
    $content += "`r`n"
  }
  return $content + $line + "`r`n"
}

function Get-ResendKeyFromConsole {
  Write-Host ''
  Write-Host "EMAIL_FROM = $from"
  Write-Host "INQUIRY_TO_EMAIL = $to"
  Write-Host ''
  Write-Host 'Zadej Resend API klic (re_...). Vstup nebude videt:'
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secure = $null
  }
}

function Get-ResendKeyFromDialog {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'FoodGo – Resend API klic'
  $form.Size = New-Object System.Drawing.Size(460, 260)
  $form.StartPosition = 'CenterScreen'
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.TopMost = $true
  $form.ShowInTaskbar = $true

  $info = New-Object System.Windows.Forms.Label
  $info.Location = New-Object System.Drawing.Point(16, 14)
  $info.Size = New-Object System.Drawing.Size(410, 70)
  $info.Text = "Klic se ulozi jen do lokalniho .env (mimo Git).`r`nNeodesila se do AI chatu ani do terminaloveho logu.`r`nVloz CELY klic z Resend (tvar re_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxx, 36 znaku).`r`nINQUIRY_TO_EMAIL = $to`r`nEMAIL_FROM = $from"

  $label = New-Object System.Windows.Forms.Label
  $label.Location = New-Object System.Drawing.Point(16, 96)
  $label.Size = New-Object System.Drawing.Size(410, 20)
  $label.Text = 'Resend API klic (re_...)'

  $box = New-Object System.Windows.Forms.TextBox
  $box.Location = New-Object System.Drawing.Point(16, 120)
  $box.Size = New-Object System.Drawing.Size(410, 24)
  $box.UseSystemPasswordChar = $true
  $box.MaxLength = 200

  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = 'Ulozit do .env'
  $ok.Location = New-Object System.Drawing.Point(230, 168)
  $ok.Size = New-Object System.Drawing.Size(120, 30)
  $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK

  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = 'Zrusit'
  $cancel.Location = New-Object System.Drawing.Point(356, 168)
  $cancel.Size = New-Object System.Drawing.Size(70, 30)
  $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

  $form.Controls.AddRange(@($info, $label, $box, $ok, $cancel))
  $form.AcceptButton = $ok
  $form.CancelButton = $cancel

  $result = $form.ShowDialog()
  $value = $null
  if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $value = $box.Text
  }
  $box.Text = ''
  $form.Dispose()
  return $value
}

Write-Host "EMAIL_FROM = $from"
Write-Host "INQUIRY_TO_EMAIL = $to"

$plain = $null
if ($Console) {
  $plain = Get-ResendKeyFromConsole
} else {
  try {
    $plain = Get-ResendKeyFromDialog
  } catch {
    Write-Host 'Graficky dialog selhal. Spust znovu s -Console v lokalnim terminalu mimo Agent.'
    Write-Host $_.Exception.Message
    exit 2
  }
}

if ($null -eq $plain) {
  Write-Host 'Zruseno. Nic nezapsano.'
  exit 3
}

$plain = [string]$plain
$plain = $plain.Trim()
# Oficiální tvar Resend: re_ + 8 + _ + 24 (base58), celkem 36 znaků.
if ($plain -notmatch '^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$') {
  $plain = $null
  Write-Host 'API klic nema oficiani tvar Resend (re_ + 8 + _ + 24 znaku, celkem 36). Nic nezapsano.'
  exit 1
}

$raw = Get-Content -Path $envPath -Raw
if ($null -eq $raw) { $raw = '' }
if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
  $raw = $raw.Substring(1)
}
$raw = Set-EnvLine $raw 'RESEND_API_KEY' $plain
$raw = Set-EnvLine $raw 'INQUIRY_TO_EMAIL' $to
$raw = Set-EnvLine $raw 'EMAIL_FROM' $from
if ($raw -notmatch '(?m)^PUBLIC_SITE_URL=') {
  $raw = Set-EnvLine $raw 'PUBLIC_SITE_URL' 'http://127.0.0.1:5173'
} elseif ($raw -match '(?m)^PUBLIC_SITE_URL=\s*$') {
  $raw = Set-EnvLine $raw 'PUBLIC_SITE_URL' 'http://127.0.0.1:5173'
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($envPath, $raw, $utf8NoBom)
$plain = $null

Write-Host ''
Write-Host 'Hotovo. .env doplneno (soubor je v .gitignore).'
Write-Host 'Kontrola: npm run check:resend && npm run check:resend-api'
exit 0
