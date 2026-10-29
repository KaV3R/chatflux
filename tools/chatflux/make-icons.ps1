# ChatFlux: generates the Windows/Linux desktop icons from one source PNG.
# Usage: powershell -File tools/chatflux/make-icons.ps1 -Source path\to\logo.png
param(
	[Parameter(Mandatory = $true)][string]$Source,
	[string]$OutDir = '',
	[double]$Margin = 0.06
)
$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '..\..\fluxer_desktop\build_resources\icons-stable' }
$OutDir = (Resolve-Path $OutDir).Path
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

function New-SquareIcon([int]$size) {
	$bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear([System.Drawing.Color]::Transparent)
	$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
	$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
	# Small sizes get less margin so the tray icon stays readable.
	$m = if ($size -le 32) { 0 } else { $Margin }
	$box = $size * (1 - 2 * $m)
	$scale = [Math]::Min($box / $src.Width, $box / $src.Height)
	$w = $src.Width * $scale; $h = $src.Height * $scale
	$g.DrawImage($src, [single](($size - $w) / 2), [single](($size - $h) / 2), [single]$w, [single]$h)
	$g.Dispose()
	return $bmp
}

function Get-PngBytes($bmp) {
	$ms = New-Object System.IO.MemoryStream
	$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
	return , $ms.ToArray()
}

foreach ($s in 16, 24, 32, 48, 64, 128, 256, 512, 1024) {
	$b = New-SquareIcon $s
	$b.Save((Join-Path $OutDir "${s}x${s}.png"), [System.Drawing.Imaging.ImageFormat]::Png)
	if ($s -eq 512) { $b.Save((Join-Path $OutDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
	$b.Dispose()
}

# Multi-size .ico with PNG-compressed entries (supported since Windows Vista).
$icoSizes = 16, 24, 32, 48, 64, 128, 256
$images = New-Object System.Collections.Generic.List[byte[]]
foreach ($s in $icoSizes) { $b = New-SquareIcon $s; $images.Add((Get-PngBytes $b)); $b.Dispose() }
$fs = [System.IO.File]::Create((Join-Path $OutDir 'icon.ico'))
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$icoSizes.Count)
$offset = 6 + 16 * $icoSizes.Count
for ($k = 0; $k -lt $icoSizes.Count; $k++) {
	$s = $icoSizes[$k]; $len = $images[$k].Length
	$dim = if ($s -ge 256) { 0 } else { $s }
	$bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
	$bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$len); $bw.Write([UInt32]$offset)
	$offset += $len
}
foreach ($img in $images) { $bw.Write($img) }
$bw.Close()
# Splash screen mark (shown at 88px, rendered at 2x for HiDPI).
$splash = New-SquareIcon 176
$splash.Save((Join-Path $PSScriptRoot '..\..\fluxer_desktop\src\splash\chatflux-mark.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$splash.Dispose()

$src.Dispose()
Write-Host "Icons written to $OutDir"
