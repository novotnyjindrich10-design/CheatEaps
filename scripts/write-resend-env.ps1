# Bezpecne doplneni Resend promennych do .env (mimo Git).
# Vychozi: nacte klic ze schranky Windows (Get-Clipboard). Hodnotu nikdy nevypisuje.
#
#   1) V Resendu zkopiruj API klic (Ctrl+C)
#   2) npm run resend:key
#
# Zalohy: -Console (maskovany Read-Host), -Gui (Windows dialog).
#
[CmdletBinding()]
param(
  [string]$ToEmail = 'foodgocz@gmail.com',

  [string]$FromEmail = 'FoodGo <onboarding@resend.dev>',

  [switch]$Clipboard,
  [switch]$Console,
  [switch]$Gui,

  # Zachyti npm extra args / omylem vlozeny klic na CLI — NIKDY jako ToEmail ani do logu.
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$IgnoredArgs
)

if ($IgnoredArgs -and $IgnoredArgs.Count -gt 0) {
  Write-Host 'Ignoruji dodatecne argumenty. Klic nacte jen ze schranky (-Clipboard), ne z prikazove radky.'
  $IgnoredArgs = $null
}

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

function Normalize-ResendKey([string]$raw) {
  if ($null -eq $raw) { return '' }
  $value = [string]$raw
  # Odstran zero-width / BOM / neoddelitelne mezery z clipboardu.
  $value = $value -replace "[\u200B-\u200D\uFEFF\u00A0]", ''
  $value = $value.Trim().Trim([char[]]@([char]13, [char]10, [char]9))
  $value = $value.Trim([char[]]@([char]34, [char]39))
  if ($value -match '^(?i)bearer\s+(.+)$') {
    $value = $Matches[1].Trim().Trim([char[]]@([char]34, [char]39))
  }
  if ($value -match '^(?i)RESEND_API_KEY\s*=\s*(.+)$') {
    $value = $Matches[1].Trim().Trim([char[]]@([char]34, [char]39))
  }
  # Bez mezer uvnitr klice.
  $value = $value -replace '\s+', ''
  return $value
}

function Test-ResendKeyShape([string]$value) {
  # Ofcialni tvar (Resend / TruffleHog 2026): re_ + 8 + _ + 24 base58, celkem 36.
  $official = $value -match '^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$'
  # Povolene i bezne alfanumericke varianty se stejnou strukturou (0/O/I/l, delsi suffix).
  $accepted = $value -match '^re_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,64}$'
  return @{
    Official = [bool]$official
    Accepted = [bool]($official -or $accepted)
  }
}

function Get-ResendKeyDiagnostics([string]$value) {
  $prefixOk = $value.StartsWith('re_')
  $underscores = ([regex]::Matches($value, '_')).Count
  $invalidChars = @()
  if ($value.Length -gt 0) {
    $invalidChars = [regex]::Matches($value, '[^A-Za-z0-9_]') | ForEach-Object { $_.Value } | Select-Object -Unique
  }
  return @{
    Length = $value.Length
    PrefixOk = $prefixOk
    UnderscoreCount = $underscores
    InvalidCharCount = @($invalidChars).Count
  }
}

function Get-ResendKeyFromClipboard {
  Write-Host 'Nacitam Resend API klic ze schranky Windows (hodnota se nevypise)...'
  try {
    $clip = Get-Clipboard -Raw -ErrorAction Stop
  } catch {
    try {
      $clip = Get-Clipboard -ErrorAction Stop
      if ($clip -is [System.Array]) {
        $clip = ($clip | ForEach-Object { [string]$_ }) -join "`n"
      }
    } catch {
      Write-Host 'Schranka je nedostupna. Zkopiruj klic z Resendu a spust znovu.'
      return ''
    }
  }
  if ($null -eq $clip) { return '' }
  return [string]$clip
}

function Clear-ResendClipboard {
  try {
    Set-Clipboard -Value '' -ErrorAction SilentlyContinue
  } catch {
    try {
      Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
      [System.Windows.Forms.Clipboard]::Clear()
    } catch {
      # Schranku po uspechu radsi vycistime; selhani neni chyba zapisu.
    }
  }
}

function Get-ResendKeyFromConsole {
  Write-Host ''
  Write-Host 'Vloz Resend API klic (zacina re_). Vstup se NEZOBRAZI:'
  Write-Host '(Preferuj: zkopiruj klic a spust npm run resend:key bez -Console.)'
  $secure = Read-Host -AsSecureString
  if ($null -eq $secure -or $secure.Length -eq 0) {
    return ''
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ($secure -is [IDisposable]) { $secure.Dispose() }
    $secure = $null
  }
}

function Get-ResendKeyFromDialog {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'FoodGo – Resend API klic'
  $form.Size = New-Object System.Drawing.Size(460, 280)
  $form.StartPosition = 'CenterScreen'
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.TopMost = $true
  $form.ShowInTaskbar = $true

  $info = New-Object System.Windows.Forms.Label
  $info.Location = New-Object System.Drawing.Point(16, 14)
  $info.Size = New-Object System.Drawing.Size(410, 90)
  $info.Text = "Klic se ulozi jen do lokalniho .env (mimo Git).`r`nNeodesila se do AI chatu ani do terminaloveho logu.`r`nVloz CELY klic z Resend (zacina re_).`r`nINQUIRY_TO_EMAIL = $to`r`nEMAIL_FROM = $from"

  $label = New-Object System.Windows.Forms.Label
  $label.Location = New-Object System.Drawing.Point(16, 110)
  $label.Size = New-Object System.Drawing.Size(410, 20)
  $label.Text = 'Resend API klic (re_...)'

  $box = New-Object System.Windows.Forms.TextBox
  $box.Location = New-Object System.Drawing.Point(16, 134)
  $box.Size = New-Object System.Drawing.Size(410, 24)
  $box.UseSystemPasswordChar = $true
  $box.MaxLength = 512

  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = 'Ulozit do .env'
  $ok.Location = New-Object System.Drawing.Point(230, 180)
  $ok.Size = New-Object System.Drawing.Size(120, 30)
  $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK

  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = 'Zrusit'
  $cancel.Location = New-Object System.Drawing.Point(356, 180)
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

# Vychozi = schranka. -Console / -Gui jen na vyzadani.
$mode = 'Clipboard'
if ($Gui) { $mode = 'Gui' }
elseif ($Console) { $mode = 'Console' }
elseif ($Clipboard) { $mode = 'Clipboard' }

$plain = $null
$fromClipboard = $false
switch ($mode) {
  'Gui' {
    try {
      $plain = Get-ResendKeyFromDialog
    } catch {
      Write-Host 'Graficky dialog selhal. Zkopiruj klic a spust: npm run resend:key'
      Write-Host $_.Exception.Message
      exit 2
    }
  }
  'Console' {
    $plain = Get-ResendKeyFromConsole
  }
  default {
    $plain = Get-ResendKeyFromClipboard
    $fromClipboard = $true
  }
}

if ($null -eq $plain -or [string]::IsNullOrWhiteSpace([string]$plain)) {
  Write-Host 'Schranka / vstup je prazdny. Nic nezapsano.'
  Write-Host 'Nejdriv v Resendu zkopiruj API klic (Ctrl+C), pak spust npm run resend:key.'
  exit 3
}

$plain = Normalize-ResendKey ([string]$plain)
$shape = Test-ResendKeyShape $plain
if (-not $shape.Accepted) {
  $diag = Get-ResendKeyDiagnostics $plain
  $plain = $null
  Write-Host 'API klic neprosel kontrolou. Nic nezapsano.'
  Write-Host ("Diagnostika (bez hodnoty): delka={0}; prefix_re_={1}; podtrzitka={2}; neplatne_znaky={3}" -f $diag.Length, $diag.PrefixOk, $diag.UnderscoreCount, $diag.InvalidCharCount)
  Write-Host 'Ocekavano: re_ + 8 znaku + _ + 16-64 znaku (oficialne 36 znaku base58).'
  Write-Host 'Vloz klic bez uvozovek, bez Bearer a bez RESEND_API_KEY=.'
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
$wasOfficial = $shape.Official
$plain = $null
$shape = $null
if ($fromClipboard) {
  Clear-ResendClipboard
}

Write-Host ''
Write-Host 'Hotovo. .env doplneno (.env je v .gitignore).'
if ($fromClipboard) {
  Write-Host 'Schranka byla vycistena.'
}
if (-not $wasOfficial) {
  Write-Host 'Poznamka: tvar neni presne oficialni base58/36, ale struktura re_…_… sedi. Over: npm run check:resend-api'
} else {
  Write-Host 'Kontrola: npm run check:resend && npm run check:resend-api'
}
exit 0
