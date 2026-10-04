param([switch]$SkipDownload)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if(-not $SkipDownload){node scripts/download-clamav.mjs; if($LASTEXITCODE -ne 0){throw 'Scanner download failed.'}}
$archive=Join-Path $projectRoot '.local-data/clamav/clamav.zip'
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '57b6fd1d60cd87bafe800f97407ecdef0576d36b3900b8b7abcfbbabe88295fd'){throw 'Scanner archive checksum mismatch.'}
$runtime=Join-Path $projectRoot '.local-data/clamav/runtime'
if(-not (Test-Path -LiteralPath (Join-Path $runtime 'clamav-1.4.6.win.x64/clamd.exe'))){Expand-Archive -LiteralPath $archive -DestinationPath $runtime}
$state=Join-Path $projectRoot '.local-data/clamav'
$database=Join-Path $state 'database'
$temp=Join-Path $state 'temp'
New-Item -ItemType Directory -Force -Path $database,$temp | Out-Null
@"
DatabaseDirectory "$database"
TemporaryDirectory "$temp"
LogFile "$state/clamd.log"
LogTime yes
LogFileMaxSize 5M
LogRotate yes
TCPAddr 127.0.0.1
TCPSocket 3310
Foreground yes
OfficialDatabaseOnly yes
FailIfCvdOlderThan 7
ConcurrentDatabaseReload no
MaxThreads 2
MaxQueue 4
StreamMaxLength 60M
MaxFileSize 60M
MaxScanSize 120M
MaxScanTime 50000
ReadTimeout 65
AlertExceedsMax yes
AlertEncrypted yes
AlertBrokenMedia yes
"@ | Set-Content -LiteralPath (Join-Path $state 'clamd.conf') -Encoding ascii
@"
DatabaseDirectory "$database"
UpdateLogFile "$state/freshclam.log"
LogTime yes
DatabaseMirror database.clamav.net
DNSDatabaseInfo current.cvd.clamav.net
ConnectTimeout 20
ReceiveTimeout 120
"@ | Set-Content -LiteralPath (Join-Path $state 'freshclam.conf') -Encoding ascii
Write-Output 'Scanner configuration ready. Run scanner:update, then scanner:start in its own terminal.'
