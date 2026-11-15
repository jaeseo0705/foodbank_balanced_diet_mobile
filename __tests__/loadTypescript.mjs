// Resolve the same relative TS/JSON imports as Metro for dependency-free Node tests.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        const url = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true };
    if (url.startsWith('file:') && url.endsWith('.json')) return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true };
    return next(url, context);
  },
});
