import { createConnection } from 'node:net';
import { scanWithDefender } from './defender-scanner';
// Run on the private worker network only: clamd TCP is not authenticated or encrypted.
export async function scanBytes(bytes:Buffer):Promise<'clean'|'rejected'>{
 if(process.env.POLARBRIDGE_SCANNER==='defender-local')return scanWithDefender(bytes);
 const host=process.env.CLAMD_HOST;if(!host)throw new Error('SCANNER_NOT_CONFIGURED');
 return new Promise((resolve,reject)=>{
 const socket=createConnection({host,port:Number(process.env.CLAMD_PORT || 3310)});let result='';
 const timer=setTimeout(()=>{socket.destroy();reject(new Error('SCAN_TIMEOUT'));},60000);
 const finish=(error?:Error,value?:'clean'|'rejected')=>{clearTimeout(timer);socket.destroy();error?reject(error):resolve(value!);};
 socket.on('error',()=>finish(new Error('SCANNER_UNAVAILABLE')));
 socket.on('data',chunk=>{result+=chunk.toString();if(result.length>4096)finish(new Error('INVALID_SCAN_REPLY'));});
 socket.on('end',()=>{const reply=result.replace(/\0/g,'').trim();if(reply==='stream: OK')finish(undefined,'clean');else if(/^stream: .+ FOUND$/.test(reply))finish(undefined,'rejected');else finish(new Error('SCAN_INCOMPLETE'));});
 socket.on('connect',()=>{socket.write('zINSTREAM\0');let offset=0;
 const send=()=>{while(offset<bytes.length){const part=bytes.subarray(offset,offset+65536);const length=Buffer.alloc(4);length.writeUInt32BE(part.length);offset+=part.length;socket.write(length);if(!socket.write(part)){socket.once('drain',send);return;}}socket.write(Buffer.alloc(4));};send();});
 });
}
