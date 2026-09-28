@echo off
rem Uploads every change in this folder to GitHub (the live site updates a minute or two later).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish.ps1"
