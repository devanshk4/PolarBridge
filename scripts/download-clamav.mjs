import { createReadStream,createWriteStream } from 'node:fs';
import { mkdir,stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
const destination='.local-data/clamav/clamav.zip';
const expected='57b6fd1d60cd87bafe800f97407ecdef0576d36b3900b8b7abcfbbabe88295fd';
async function digest(){const hash=createHash('sha256');for await(const chunk of createReadStream(destination))hash.update(chunk);return hash.digest('hex');}
await mkdir('.local-data/clamav',{recursive:true});
if(await stat(destination).then(()=>true,()=>false) && await digest()===expected){console.log('Verified cached ClamAV 1.4.6 LTS archive.');process.exit(0);}
const url='https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.4.6/clamav-1.4.6.win.x64.zip';
const response=await fetch(url,{signal:AbortSignal.timeout(1200000)});
if(!response.ok)throw new Error(`Scanner download failed: HTTP ${response.status}`);
await pipeline(Readable.fromWeb(response.body),createWriteStream(destination));
if(await digest()!==expected)throw new Error('Scanner archive checksum mismatch; do not extract it.');
console.log('Verified ClamAV 1.4.6 LTS archive against the official release SHA-256.');
