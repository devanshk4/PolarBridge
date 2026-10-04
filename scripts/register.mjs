// Run TypeScript maintenance scripts without a child-process transpiler.
import { registerHooks } from 'node:module';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier,context,nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url=new URL(specifier,context.parentURL);
      if (!/\.[a-z]+$/i.test(url.pathname) && existsSync(fileURLToPath(url)+'.ts')) return nextResolve(url.href+'.ts',context);
    }
    return nextResolve(specifier,context);
  },
  load(url,context,nextLoad) {
    if(url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/')) return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
    return nextLoad(url,context);
  },
});
