# Movie Nights - publish to GitHub.
# Saves every change in this folder as a commit and uploads it to GitHub.
# GitHub Pages then updates the live site within a minute or two.
#
#   Publish to GitHub.bat                 -> commit message "Update <date>"
#   tools\publish.ps1 -Message "text"     -> your own commit message
#   tools\publish.ps1 -Quiet              -> no "press Enter" at the end

param([string]$Message = "", [switch]$Quiet)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Done($code) {
  if (-not $Quiet) { Write-Host ""; Read-Host "Press Enter to close" | Out-Null }
  exit $code
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is not installed. Get it from https://git-scm.com/download/win" -ForegroundColor Red
  Done 1
}

git add -A
$changes = git status --porcelain
if (-not $changes) {
  Write-Host "Nothing new to publish - GitHub is already up to date." -ForegroundColor Green
  Done 0
}

Write-Host "Changes to publish:" -ForegroundColor Cyan
git status --short

if (-not $Message) { $Message = "Update " + (Get-Date -Format "yyyy-MM-dd HH:mm") }
git commit -q -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host "Could not save the changes (git commit failed)." -ForegroundColor Red; Done 1 }

Write-Host "Uploading to GitHub..." -ForegroundColor Cyan
git push -q
if ($LASTEXITCODE -ne 0) {
  Write-Host "Upload failed. Check your internet connection or GitHub sign-in, then run this again." -ForegroundColor Red
  Write-Host "(Your changes are saved locally and will be uploaded next time.)"
  Done 1
}

$remote = git remote get-url origin
if ($remote -match 'github\.com[:/]([^/]+)/([^/.]+)') {
  $site = "https://$($Matches[1].ToLower()).github.io/$($Matches[2])/"
  Write-Host ""
  Write-Host "Published! The live site updates in a minute or two:" -ForegroundColor Green
  Write-Host "  $site"
} else {
  Write-Host "Published!" -ForegroundColor Green
}
Done 0
