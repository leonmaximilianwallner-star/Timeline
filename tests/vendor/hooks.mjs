// Lets Node load the server function as Supabase does: its "jsr:" import of the push library is
// answered with the bundled copy here. Used as  node --import ./tests/vendor/hooks.mjs …
import { register } from 'node:module';
const BUNDLE = new URL('./webpush.bundle.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next){
    if(specifier === 'jsr:@negrel/webpush@0.5.0') return { url: ${JSON.stringify(BUNDLE)}, shortCircuit: true };
    return next(specifier, context);
  }`));
