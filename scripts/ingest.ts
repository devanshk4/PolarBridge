import { processNext } from '../src/server/ingestion';
import { getPool } from '../src/server/db';
if(process.env.VERCEL)throw new Error('Run ingestion on a separate worker, not inside Vercel functions.');
const watch=process.argv.includes('--watch');let stopped=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;});
try {
 do {
  try{let n=0;while(!stopped && n<20 && await processNext())n++;if(n || !watch)console.log(`Processed ${n} queued files.`);}
  catch(error){if(!watch)throw error;console.error('Worker temporarily unavailable; retrying in 5 seconds.');}
  if(watch && !stopped)await new Promise(resolve=>setTimeout(resolve,5000));
 }while(watch && !stopped);
} finally { await getPool().end(); }
