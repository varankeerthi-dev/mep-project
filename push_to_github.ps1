param(
    [string]$RemoteUrl,
    [string]$Branch = "main"
)

Write-Output "--- push_to_github.ps1 ---"
Write-Output "This script initializes a git repo (if needed), creates a .gitignore, commits changes, and optionally adds a remote and pushes."
Write-Output "Usage: .\push_to_github.ps1 -RemoteUrl 'git@github.com:user/repo.git' -Branch main"
Write-Output "If -RemoteUrl is omitted, the script will only prepare the repo and create a commit; add remote and push manually."

# Create .gitignore (safe default for Node/Vite projects)
$gitignore = @"
node_modules/
dist/
build/
.env
.env.local
.env.*.local
.vscode/
.DS_Store
npm-debug.log*
.yarncache/
coverage/
logs/
*.log
"@

if (Test-Path .gitignore) {
    Write-Output ".gitignore already exists; leaving intact."
} else {
    Write-Output "Creating .gitignore"
    Set-Content -LiteralPath .gitignore -Value $gitignore -Encoding UTF8
}

# Initialize git if needed
if (!(Test-Path .git)) {
    Write-Output "Initializing new git repository"
    git init
    # create main branch explicitly if possible
    git checkout -b $Branch 2>$null || Write-Output "Default branch created"
} else {
    Write-Output "Git repository already initialized"
}

# Stage changes
Write-Output "Staging changes..."
git add -A

# Check if there are staged changes
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Output "No staged changes to commit."
} else {
    Write-Output "Committing changes..."
    git commit -m "perf(audit): static performance fixes" -m "Replaced hard-coded Supabase anon key with env var; dynamic import of pdf/xlsx export libs; simple windowing in MaterialsList to limit initial render." -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
}

# Add remote and push if provided
if ($RemoteUrl) {
    Write-Output "Configuring remote: origin -> $RemoteUrl"
    # remove existing origin if present
    if (git remote | Select-String '^origin$') { git remote remove origin }
    git remote add origin $RemoteUrl
    Write-Output "Pushing to remote origin/$Branch (may require authentication from your machine)"
    git push -u origin $Branch
} else {
    Write-Output "No remote URL provided. To push to GitHub, run:"
    Write-Output "  git remote add origin <git-remote-url>"
    Write-Output "  git push -u origin $Branch"
}

Write-Output "Done. If push failed due to authentication, run the script locally with a configured GitHub credential (SSH key or credential manager)."
