param([ValidateSet('start','update')][string]$Action='start')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$state=Join-Path $projectRoot '.local-data/clamav'
$runtime=Join-Path $state 'runtime/clamav-1.4.6.win.x64'
if($Action -eq 'update') {& (Join-Path $runtime 'freshclam.exe') "--config-file=$state/freshclam.conf"}
else {& (Join-Path $runtime 'clamd.exe') "--config-file=$state/clamd.conf"}
exit $LASTEXITCODE
