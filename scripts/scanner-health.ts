import { createConnection } from 'node:net';
import { scanBytes } from '../src/server/scanner';
if(process.env.POLARBRIDGE_SCANNER==='defender-local'){
 if(await scanBytes(Buffer.from('PolarBridge scanner readiness check'))!=='clean')throw new Error('Local scanner health check failed.');
 console.log('Windows Defender worker ready: a real clean-content scan succeeded.');process.exit(0);
}
const host=process.env.CLAMD_HOST || '127.0.0.1';
const port=Number(process.env.CLAMD_PORT || 3310);
function command(value:string):Promise<string>{return new Promise((resolve,reject)=>{let data='';const socket=createConnection({host,port});const timer=setTimeout(()=>{socket.destroy();reject(new Error('Scanner health check timed out.'));},5000);socket.on('error',error=>{clearTimeout(timer);reject(error);});socket.on('connect',()=>socket.write(`z${value}\0`));socket.on('data',chunk=>{data+=chunk.toString();if(data.includes('\0')){clearTimeout(timer);socket.destroy();resolve(data.replace(/\0/g,'').trim());}});socket.on('end',()=>{clearTimeout(timer);if(!data.includes('\0'))reject(new Error('Incomplete scanner health reply.'));});});}
if(await command('PING')!=='PONG')throw new Error('Scanner did not respond correctly.');
console.log(`Scanner ready at ${host}:${port}: ${await command('VERSION')}`);
