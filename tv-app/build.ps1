# Builds the Samsung TV app (.wgt) from the same files as the website.
#   .\tv-app\build.ps1                  -> assembles tv-app\build\
#   .\tv-app\build.ps1 -Sign MyProfile  -> also packages and signs GrAnHome01.wgt
#   .\tv-app\build.ps1 -Sign MyProfile -Install 192.168.1.50  -> and installs it on the TV
param(
  [string]$Sign,
  [string]$Install,
  [string]$Tizen = "C:\tizen-studio\tools\ide\bin\tizen.bat",
  [string]$Sdb = "C:\tizen-studio\tools\sdb.exe",
  [string]$DataBase = "https://greber20.github.io/samsung-tv/"
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $PSScriptRoot "build"

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory $out | Out-Null

foreach ($f in "app.js", "style.css", "songs.js", "photos.js") { Copy-Item (Join-Path $root $f) $out }
Copy-Item -Recurse (Join-Path $root "photos") $out
Copy-Item (Join-Path $PSScriptRoot "config.xml") $out
Copy-Item (Join-Path $root "photos\05-meadow-walk.jpg") (Join-Path $out "icon.jpg")

# Tell app.js to pull fresh songs.js / photos.js from GitHub Pages.
$html = Get-Content -Raw -Encoding UTF8 (Join-Path $root "index.html")
$html = $html.Replace('<script src="songs.js"></script>',
  "<script>window.DATA_BASE = `"$DataBase`";</script>`n  <script src=`"songs.js`"></script>")
[IO.File]::WriteAllText((Join-Path $out "index.html"), $html, (New-Object Text.UTF8Encoding $false))
Write-Host "Assembled $out"

if ($Sign) {
  & $Tizen package -t wgt -s $Sign -- $out
  if ($LASTEXITCODE) { throw "tizen package failed" }
  $wgt = Get-ChildItem $out -Filter *.wgt | Select-Object -First 1
  Write-Host "Packaged $($wgt.FullName)"

  if ($Install) {
    & $Sdb connect $Install
    $serial = "${Install}:26101"
    & $Tizen install -s $serial -n $wgt.Name -- $out
    if ($LASTEXITCODE) { throw "tizen install failed" }
    & $Tizen run -s $serial -p GrAnHome01.SamsungTV
  }
}
