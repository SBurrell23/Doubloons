// A stand-in for PeerJS so the session layer can be imported headlessly.
// The netcode simulation injects its own transport, so this is never
// actually constructed -- it only has to satisfy the import.
export class Peer {
  constructor() { throw new Error('PeerJS is not available in the simulation; inject a transport.'); }
}
