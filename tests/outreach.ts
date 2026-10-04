import assert from 'node:assert/strict';
import { type Staff } from '../src/server/http';
import { getPool } from '../src/server/db';
import { createRecord,reviseRecord,transitionRecord } from '../src/server/catalogue';
import { sourceList,saveOutreach,getOutreach,listOutreach,actOutreach,publicOutreach,exportOutreach,clearSource,generateOutreach } from '../src/server/outreach';
import { generateDraft } from '../src/server/outreach-ai';
import type { RecordInput } from '../src/lib/record-schema';
export async function testOutreach(author:Staff,other:Staff,reviewer:Staff,publisher:Staff,input:RecordInput){
 const source=await createRecord(author,input);
 const release=async(revisionId:string)=>{for(const [actor,action] of [[author,'submit'],[reviewer,'approve'],[publisher,'publish']] as const)await transitionRecord(actor,source.id,{action,revisionId,comment:''});};
 assert(!(await sourceList()).some(s=>s.id===source.id));await release(source.revision_id);
 const s=(await sourceList()).find(s=>s.id===source.id)!;
 const data={title:'A source-connected polar story',paragraphs:[{text:input.body,citations:[s.chunks[1].id]}],sourceIds:[s.revision_id],format:'Student explainer' as const,language:'English' as const,previousId:null as string|null,generationId:null};
 await assert.rejects(()=>saveOutreach(reviewer,data));
 await assert.rejects(()=>saveOutreach(author,{...data,paragraphs:[{text:input.body,citations:['invented-chunk']}]}));
 const d=await saveOutreach(author,data);
 const act=(actor:Staff,action:'submit'|'approve'|'request_changes'|'publish'|'withdraw',id=d.id,checked=true)=>actOutreach(actor,id,{action,comment:'Test review decision',evidenceChecked:checked,languageChecked:checked});
 await assert.rejects(()=>getOutreach(other,d.id));assert.equal((await listOutreach(other)).length,0);
 await assert.rejects(()=>exportOutreach(author,d.id));await assert.rejects(()=>act(publisher,'publish'));
 await act(author,'submit');await assert.rejects(()=>saveOutreach(author,{...data,previousId:d.id}));
 await assert.rejects(()=>act({...author,role:'reviewer'},'approve'));await assert.rejects(()=>act(reviewer,'approve',d.id,false));
 await act(reviewer,'approve');await act(publisher,'publish');assert.equal((await publicOutreach(d.id)).length,1);assert.match(await exportOutreach(author,d.id),/Reviewed revision/);
 const next=await saveOutreach(author,{...data,previousId:d.id,title:'An updated reviewed polar story'});
 await assert.rejects(()=>act(publisher,'publish',next.id));await assert.rejects(()=>act(author,'submit',d.id));
 await act(author,'submit',next.id);await act(reviewer,'approve',next.id);await act(publisher,'publish',next.id);assert.equal((await publicOutreach(d.id)).length,0);
 await assert.rejects(()=>getPool().query("UPDATE outreach_revisions SET payload='{}' WHERE id=$1",[next.id]));
 await assert.rejects(()=>getPool().query('DELETE FROM outreach_events WHERE output_id=$1',[next.id]));
 await assert.rejects(()=>clearSource(author,s.revision_id));await clearSource(publisher,s.revision_id);
 const originalFetch=globalThis.fetch;const env={key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL,enabled:process.env.POLARBRIDGE_AI_ENABLED};
 try{
 delete process.env.OPENAI_API_KEY;await assert.rejects(()=>generateOutreach(author,{sourceIds:data.sourceIds,format:data.format,language:data.language}),/not connected/);
 process.env.OPENAI_API_KEY='isolated-test-key';process.env.OPENAI_MODEL='isolated-test-model';process.env.POLARBRIDGE_AI_ENABLED='1';
 let requests=0;
 globalThis.fetch=async(url,init)=>{requests++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init!.body as string);assert.equal(body.store,false);assert.equal(body.tools,undefined);assert(body.instructions.includes('untrusted data'));return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({insufficientEvidence:false,reason:'',draft:{title:data.title,paragraphs:data.paragraphs}})}]}],usage:{input_tokens:200,output_tokens:100}});};
 const generated=await generateOutreach(author,{sourceIds:data.sourceIds,format:data.format,language:'Hindi'});assert(generated.generationId);assert.equal(requests,1);
 // Explicit mocked-provider contract cases: these are not live model quality evaluations.
 for(let i=0;i<20;i++){
 globalThis.fetch=async()=>Response.json(i%4===0?{status:'incomplete'}:{status:'completed',output:[{content:[{type:'output_text',text:i%4===1?'not json':JSON.stringify(i%4===2?{insufficientEvidence:true,reason:'No evidence',draft:null}:{insufficientEvidence:false,reason:'',draft:{title:'Unsupported draft',paragraphs:[]}})}]}]});
 await assert.rejects(()=>generateDraft([s],data.format,i%2?'Hindi':'English'));
 }
 process.env.POLARBRIDGE_AI_PROVIDER='gemini';process.env.GEMINI_API_KEY='isolated-gemini-key';process.env.GEMINI_MODEL='gemini-3.8-flash';
 await assert.rejects(()=>generateOutreach(author,{sourceIds:data.sourceIds,format:data.format,language:'English'}),/clear each source/);
 await assert.rejects(()=>clearSource(publisher,s.revision_id,'openai'),/provider changed/);
 await clearSource(publisher,s.revision_id,'gemini');
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');assert(!String(url).includes('key='));const body=JSON.parse(init!.body as string);assert(body.systemInstruction.parts[0].text.includes('untrusted data'));assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.tools,undefined);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({insufficientEvidence:false,reason:'',draft:{title:data.title,paragraphs:data.paragraphs}})}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:80,thoughtsTokenCount:20}});};
 const gemini=await generateOutreach(author,{sourceIds:data.sourceIds,format:data.format,language:'English'});assert(gemini.generationId);
 assert.equal((await getPool().query('SELECT provider FROM outreach_generation_runs WHERE id=$1',[gemini.generationId])).rows[0].provider,'gemini');
 for(const result of [{candidates:[{finishReason:'MAX_TOKENS'}]},{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'STOP',content:{parts:[{text:'invalid json'}]}}]}]){globalThis.fetch=async()=>Response.json(result);await assert.rejects(()=>generateDraft([s],data.format,'Hindi'));}
 globalThis.fetch=async()=>Response.json({error:{}},{status:429});await assert.rejects(()=>generateDraft([s],data.format,'English'),/quota/);
 process.env.POLARBRIDGE_AI_PROVIDER='openai';delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
 globalThis.fetch=async()=>{throw new Error('Provider disconnected');};await assert.rejects(()=>generateOutreach(author,{sourceIds:data.sourceIds,format:data.format,language:'English'}),/could not respond/);
 }finally{process.env.POLARBRIDGE_AI_PROVIDER='openai';delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;globalThis.fetch=originalFetch;for(const [k,v] of Object.entries({OPENAI_API_KEY:env.key,OPENAI_MODEL:env.model,POLARBRIDGE_AI_ENABLED:env.enabled})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 const replacement=await reviseRecord(author,source.id,source.revision_id,{...input,title:'Replacement source for outreach tests'});await release(replacement.revision_id);
 assert.equal((await publicOutreach(next.id)).length,0);assert.equal((await getOutreach(author,next.id)).status,'withdrawn');await assert.rejects(()=>exportOutreach(author,next.id));await assert.rejects(()=>saveOutreach(author,data));
 const replacementSource=(await sourceList()).find(s=>s.id===source.id)!;assert.equal(replacementSource.cleared,false);
 const last=await saveOutreach(author,{...data,sourceIds:[replacementSource.revision_id],paragraphs:[{text:input.body,citations:[replacementSource.chunks[1].id]}]});await act(author,'submit',last.id);await act(reviewer,'approve',last.id);
 await transitionRecord(publisher,source.id,{action:'withdraw',revisionId:replacement.revision_id,comment:'Source withdrawn'});
 assert.equal((await getOutreach(author,last.id)).status,'changes_requested');await assert.rejects(()=>act(publisher,'publish',last.id));
 console.log('PASS: outreach ownership, exact-revision review, evidence validation, export gates, source replacement/withdrawal, AI clearance and mocked provider failure contracts (20 cases). Live AI not tested.');
}
