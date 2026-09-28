@echo off
rem Opens Movie Nights as a local website so YouTube trailers play inside the page.
rem Keep the black window open while you use the site; close it to stop.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1"
