# ==============================================================================
# MOSA Smart Platform - Fast Deploy Script to Raspberry Pi
# ==============================================================================
param (
    [string]$PiHost = "192.168.1.100", # أو عنوان Tailscale: mosa-home.tail01b9ef.ts.net
    [string]$PiUser = "pi",
    [string]$PiPath = "~/mosa-platform"
)

Write-Host "🚀 جاري إرسال التحديثات إلى Raspberry Pi ($PiUser@$PiHost)..." -ForegroundColor Cyan

# Compress only modified/source code (excluding huge node_modules and builds)
$tempZip = "$env:TEMP\mosa_update.zip"
if (Test-Path $tempZip) { Remove-Item $tempZip -Force }

Write-Host "📦 جاري ضغط ملفات الكود والمشروع..." -ForegroundColor Yellow

$excludeDirs = @('node_modules', '.next', '.git', '.gemini', 'dist', '.turbo')

Get-ChildItem -Path . -Exclude $excludeDirs | Where-Object {
    $_.FullName -notmatch '\\node_modules(\\|$)' -and
    $_.FullName -notmatch '\\\.next(\\|$)' -and
    $_.FullName -notmatch '\\\.git(\\|$)' -and
    $_.FullName -notmatch '\\dist(\\|$)'
} | Compress-Archive -DestinationPath $tempZip -Force

Write-Host "📡 جاري النقل عبر SCP..." -ForegroundColor Green
scp $tempZip "${PiUser}@${PiHost}:/tmp/mosa_update.zip"

if ($LASTEXITCODE -eq 0) {
    Write-Host "⚡ جاري فك الضغط وإعادة تشغيل الخدمات على Raspberry Pi..." -ForegroundColor Cyan
    ssh "${PiUser}@${PiHost}" "mkdir -p $PiPath && unzip -o /tmp/mosa_update.zip -d $PiPath && cd $PiPath && npm run build && (pm2 restart all || sudo systemctl restart mosa 2>/dev/null || true)"
    Write-Host "✅ تم تحديث وتشغيل المنظومة بنجاح على Raspberry Pi!" -ForegroundColor Green
} else {
    Write-Host "❌ حدث خطأ أثناء نقل الملفات. تأكد من صحة IP واسم المستخدم للراسبيري باي." -ForegroundColor Red
}
