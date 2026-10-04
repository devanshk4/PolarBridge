param([switch]$Once)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$queue=Join-Path $projectRoot '.local-data/defender-queue'
New-Item -ItemType Directory -Force -Path $queue | Out-Null
$scanner=Join-Path $env:ProgramFiles 'Windows Defender/MpCmdRun.exe'
if(-not (Test-Path -LiteralPath $scanner)){throw 'Windows Defender command-line scanner is unavailable.'}
$lockPath=Join-Path $queue 'worker.lock'
$workerLock=[System.IO.File]::Open($lockPath,[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
Write-Output 'Local Windows Defender scan worker is ready. Only queued upload bytes are scanned.'
try {
 do {
 foreach($job in Get-ChildItem -LiteralPath $queue -Filter '*.request.json') {
  $id=$job.Name.Replace('.request.json','')
  if($id -notmatch '^[0-9a-f-]{36}$'){continue}
  $inputFile=Join-Path $queue "$id.bin"
  $outputFile=Join-Path $queue "$id.result.json"
  if(Test-Path -LiteralPath $outputFile){continue}
  $stdout=Join-Path $queue "$id.stdout.log"
  $stderr=Join-Path $queue "$id.stderr.log"
  $verdict='failed';$sha='';$process=$null
  try {
   $manifest=Get-Content -LiteralPath $job.FullName -Raw | ConvertFrom-Json
   $sha=$manifest.sha256
   if($manifest.id -ne $id -or $sha -notmatch '^[0-9a-f]{64}$'){throw 'Invalid request.'}
   if(([DateTimeOffset]::UtcNow-([DateTimeOffset]$manifest.createdAt)).TotalSeconds -gt 70){throw 'Expired request.'}
   if((Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha){throw 'Input checksum mismatch.'}
   # DisableRemediation applies only to this requested custom scan; it does not disable Defender protection.
   $scanArgs=@('-Scan','-ScanType','3','-File',('"'+$inputFile+'"'),'-DisableRemediation','-ReturnHR')
   $process=Start-Process -FilePath $scanner -ArgumentList $scanArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
   if(-not $process.WaitForExit(60000)){$process.Kill();throw 'Scanner timeout.'}
   $process.Refresh()
   $text=Get-Content -LiteralPath $stdout -Raw
   if($process.ExitCode -eq 0 -and $text -match 'found no threats\.' -and (Test-Path -LiteralPath $inputFile) -and (Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash.ToLowerInvariant() -eq $sha){$verdict='clean'}
   elseif($text -match '(?im)^Threat\s*:|found\s+[1-9][0-9]*\s+threat|Threats?\s+detected'){$verdict='rejected'}
  } catch { $verdict='failed'; $scanError=$_.Exception; while($scanError){if(($scanError.HResult -band 65535) -in @(225,226)){$verdict='rejected';break};$scanError=$scanError.InnerException} }
  $result=@{id=$id;sha256=$sha;verdict=$verdict;engine='Windows Defender'} | ConvertTo-Json -Compress
  $temp=Join-Path $queue "$id.result.tmp"
  [System.IO.File]::WriteAllText($temp,$result,[System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination $outputFile -Force
  Write-Output "Scan $id : $verdict"
  foreach($log in @($stdout,$stderr)){if(Test-Path -LiteralPath $log){Remove-Item -LiteralPath $log}}
 }
 if(-not $Once){Start-Sleep -Milliseconds 500}
 }while(-not $Once)
} finally {$workerLock.Dispose()}



