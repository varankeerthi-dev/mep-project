# Detached Vite dev server launcher for apps/web
$root = 'C:\Users\admin\mep-project\apps\web'
$out = Join-Path $root '.vite-dev.out.log'
$err = Join-Path $root '.vite-dev.err.log'
$vite = Join-Path $root 'node_modules\.bin\vite.cmd'

Remove-Item $out, $err -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $vite -ArgumentList '--host' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
Start-Sleep -Seconds 8

Write-Output ("PID: " + $proc.Id)
Write-Output "--- STDOUT ---"
Get-Content $out -ErrorAction SilentlyContinue
Write-Output "--- STDERR ---"
Get-Content $err -ErrorAction SilentlyContinue
