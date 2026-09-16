// Resolve hook: point `peerjs` at the stub above. PeerJS ships as
// CommonJS, so Node cannot take its named exports the way the bundler
// does, and src/net/net.js would fail to import at all.
const STUB = new URL('./peerjs-stub.mjs', import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === 'peerjs') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
