import { Pool } from 'pg';

const raw=process.env.DATABASE_URL;
let pool:Pool|undefined;
try{
 if(!raw)throw new Error('MISSING_DATABASE_URL');
 const url=new URL(raw);
 if(!['postgres:','postgresql:'].includes(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('HOSTED_DATABASE_REQUIRED');
 if(process.env.POLARBRIDGE_LOCAL_DB==='1')throw new Error('LOCAL_MODE_ENABLED');
 if(!['require','verify-ca','verify-full'].includes(url.searchParams.get('sslmode')??''))throw new Error('PROVIDER_TLS_SETTINGS_REQUIRED');
 pool=new Pool({connectionString:raw,max:1,connectionTimeoutMillis:15000,statement_timeout:10000});
 const tls=await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
 if(tls.rows[0]?.ssl!==true)throw new Error('ENCRYPTED_CONNECTION_NOT_CONFIRMED');
 console.log('PASS: hosted database connection and encrypted transport.');
 const table=await pool.query("SELECT to_regclass('public.app_migrations') AS name");
 if(!table.rows[0].name)console.log('Schema has not been initialized yet.');
 else{
 const applied=await pool.query('SELECT name FROM app_migrations');
 const pending=['001_catalogue','002_files','003_outreach','004_ai_providers'].filter(name=>!applied.rows.some(r=>r.name===name));
 console.log(pending.length?`Pending application migrations: ${pending.join(', ')}`:'PASS: all four application migrations are recorded.');
 }
}catch(error){
 // Never print driver errors, URLs, usernames or passwords.
 const code=error instanceof Error?error.message:'';
 const known=['MISSING_DATABASE_URL','HOSTED_DATABASE_REQUIRED','LOCAL_MODE_ENABLED','PROVIDER_TLS_SETTINGS_REQUIRED','ENCRYPTED_CONNECTION_NOT_CONFIRMED'];
 console.error(known.includes(code)?code:'Hosted database check failed. Check provider status, TLS settings, credentials and network access.');process.exitCode=1;
}finally{await pool?.end();}
