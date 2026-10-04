import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
if(process.env.VERCEL) throw new Error('Local development database cannot run on Vercel.');
const db=await PGlite.create('./.local-data/postgres');
const server=new PGLiteSocketServer({db,port:54329,host:'127.0.0.1',maxConnections:10});
await server.start();
console.log('Local development database listening on 127.0.0.1:54329. Not for production.');
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await server.stop();await db.close();process.exit(0);});

