@echo off
REM Convert SVG to PNG icons using ImageMagick
REM Install ImageMagick from: https://imagemagick.org/script/download.php

echo Converting SVG to PNG icons...

magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png

echo Done! Icons created:
echo - icon16.png
echo - icon48.png
echo - icon128.png
