# Generates the PCS launcher logo PNGs (16/24/32/48/64/128/256) and a
# multi-size Windows .ico by drawing the mark with System.Drawing —
# no network, no external renderers.
#
# The mark mirrors the Studio in-app home-mark: dark rounded-square
# frame, italic PCS lettering; P glows cyan and CS is lavender.
#
# Usage: powershell -ExecutionPolicy Bypass -File make-pngs-and-ico.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$OutDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sizes  = @(16, 24, 32, 48, 64, 128, 256)

$Graphite = [System.Drawing.Color]::FromArgb(255, 0x15, 0x18, 0x21)
$Accent   = [System.Drawing.Color]::FromArgb(255, 0x7a, 0xa2, 0xff)
$Plate    = [System.Drawing.Color]::FromArgb(255, 0xdf, 0xe6, 0xf3)

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function Draw-Logo([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = $size / 256.0

    # Outer rounded square (graphite fill, accent border).
    $frame = New-RoundedRectPath (8*$s) (8*$s) (240*$s) (240*$s) (56*$s)
    $fill = New-Object System.Drawing.SolidBrush($Graphite)
    $g.FillPath($fill, $frame)
    $stroke = New-Object System.Drawing.Pen($Accent, (10*$s))
    $g.DrawPath($stroke, $frame)

    # Center actual italic glyph outlines, not DrawString's invisible font padding.
    $family = New-Object System.Drawing.FontFamily('Segoe UI')
    $style = [int]([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)
    $format = [System.Drawing.StringFormat]::GenericTypographic
    $pPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $csPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pPath.AddString('P',$family,$style,[float](87*$s),[System.Drawing.PointF]::new(0,0),$format)
    $csPath.AddString('CS',$family,$style,[float](87*$s),[System.Drawing.PointF]::new(0,0),$format)
    $pb=$pPath.GetBounds(); $cb=$csPath.GetBounds()
    $join=New-Object System.Drawing.Drawing2D.Matrix
    $join.Translate([float]($pb.Right+3*$s-$cb.Left),0)
    $csPath.Transform($join); $join.Dispose()
    $all=New-Object System.Drawing.Drawing2D.GraphicsPath
    $all.AddPath($pPath,$false); $all.AddPath($csPath,$false)
    $bounds=$all.GetBounds(); $scale=[float](192*$s/$bounds.Width)
    $center=New-Object System.Drawing.Drawing2D.Matrix
    $center.Translate([float](128*$s),[float](128*$s))
    $center.Scale($scale,$scale)
    $center.Translate([float](-$bounds.Left-$bounds.Width/2),[float](-$bounds.Top-$bounds.Height/2))
    $pPath.Transform($center);$csPath.Transform($center)
    for($radius=12;$radius -ge 2;$radius-=2){
        $glow=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(14,82,198,255),[float]($radius*$s))
        $glow.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($glow,$pPath);$glow.Dispose()
    }
    $cyan=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,158,231,255))
    $lavender=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,211,202,255))
    $g.FillPath($cyan,$pPath);$g.FillPath($lavender,$csPath)
    $center.Dispose();$all.Dispose();$pPath.Dispose();$csPath.Dispose();$family.Dispose()
    $cyan.Dispose();$lavender.Dispose();$fill.Dispose();$stroke.Dispose();$frame.Dispose()

    $g.Dispose()
    return $bmp
}

$pngBytes = @{}
foreach ($n in $Sizes) {
    $bmp = Draw-Logo $n
    $path = Join-Path $OutDir ("logo-{0}.png" -f $n)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes[$n] = [System.IO.File]::ReadAllBytes($path)
    $bmp.Dispose()
    Write-Host "wrote $path"
}

# ---- Multi-size ICO (PNG-compressed entries, ICONDIR + entries + blobs) ----
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)                 # reserved
$bw.Write([uint16]1)                 # type: icon
$bw.Write([uint16]$Sizes.Count)      # count
$offset = 6 + 16 * $Sizes.Count
foreach ($n in $Sizes) {
    $dim = if ($n -ge 256) { 0 } else { $n }
    $bw.Write([byte]$dim)            # width
    $bw.Write([byte]$dim)            # height
    $bw.Write([byte]0)               # palette
    $bw.Write([byte]0)               # reserved
    $bw.Write([uint16]1)             # planes
    $bw.Write([uint16]32)            # bpp
    $bw.Write([uint32]$pngBytes[$n].Length)
    $bw.Write([uint32]$offset)
    $offset += $pngBytes[$n].Length
}
foreach ($n in $Sizes) { $bw.Write($pngBytes[$n]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $OutDir "pcs-logo.ico"), $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
Write-Host "wrote $(Join-Path $OutDir 'pcs-logo.ico')"

# Keep the in-app and Windows identity on the same original mark.
$Repo = Resolve-Path (Join-Path $OutDir '../../..')
foreach ($n in @(32,64,128,256)) { Copy-Item -LiteralPath (Join-Path $OutDir "logo-$n.png") -Destination (Join-Path $Repo "apps/launcher/ui/icons/logo-$n.png") -Force }
Copy-Item -LiteralPath (Join-Path $OutDir 'logo-256.png') -Destination (Join-Path $Repo 'apps/studio/public/brand/studio.png') -Force
Copy-Item -LiteralPath (Join-Path $OutDir 'logo-256.png') -Destination (Join-Path $Repo 'apps/studio/public/brand/launcher.png') -Force
Copy-Item -LiteralPath (Join-Path $OutDir 'pcs-logo.ico') -Destination (Join-Path $Repo 'apps/studio/src-tauri/icons/icon.ico') -Force
