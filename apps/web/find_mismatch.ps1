$lines = Get-Content 'C:\Users\admin\mep-project\src\pages\manufacturing\BOMEditor.tsx'
$depth = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $opens = ([regex]::Matches($line, '<div[\s>]')).Count
    $closes = ([regex]::Matches($line, '</div')).Count
    $oldDepth = $depth
    if ($opens -gt 0) { $depth += $opens }
    if ($closes -gt 0) { $depth -= $closes }
    if ($opens -gt 0 -or $closes -gt 0) {
        Write-Host "L$($i+1) opens=$opens closes=$closes depth=$oldDepth -> $depth"
    }
    if ($depth -lt 0) {
        Write-Host "  ^^^ PROBLEM HERE"
    }
}
