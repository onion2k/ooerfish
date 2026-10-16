/**
 * How the screen and the phone talk: a `Link` is a room with other peers in it, over which either end sends a message
 * to one peer or to all and hears the same, and knows when a peer joins or leaves. There are two. `trysteroLink` is the
 * real one, WebRTC set up through public Nostr relays by Trystero, loaded only when it is wanted. `localLink` is over a
 * `BroadcastChannel`, which carries messages between two pages of one browser and so needs no network and no relay: it
 * is for the tests, so that none of them depends on a service the game does not run. Both ends use the same interface,
 * the phone page too, so a test plays the phone with the very code the phone runs. Without this seam the end-to-end
 * test would have to reach the public relays, and fail whenever they were slow.
 */

/** A room with peers in it. What arrives is `unknown`: a peer is only a stranger who knows the key. */
export interface Link {
  /** Sends a message to the peer named, or to every peer in the room. */
  send(message: unknown, to?: string): void;
  /** Hears every message, with the peer it came from; a later call replaces the handler. */
  onMessage(handler: (raw: unknown, peer: string) => void): void;
  /** Hears each peer that joins; a later call replaces the handler. */
  onJoin(handler: (peer: string) => void): void;
  /** Hears each peer that leaves; a later call replaces the handler. */
  onLeave(handler: (peer: string) => void): void;
  /** Leaves the room, and tells the others so. */
  leave(): void;
}

/** The name the game is known by on the public relays, so that nobody else's rooms are ours. */
export const APP_ID = 'ooerfish-phone-v1';

/** The real link: Trystero, imported now and not before, so that the game's boot never fetches it. */
export async function trysteroLink(room: string, key: string): Promise<Link> {
  const { joinRoom } = await import('trystero');
  const joined = joinRoom({ appId: APP_ID, password: key }, room, {
    onJoinError: (e) => console.warn(`phone: could not join the room: ${e.error}`),
  });
  const action = joined.makeAction<import('trystero').JsonValue>('m');
  return {
    send: (message, to) => void action.send(message as import('trystero').JsonValue, to ? { target: to } : undefined),
    onMessage: (handler) => {
      action.onMessage = (data, { peerId }) => handler(data, peerId);
    },
    onJoin: (handler) => {
      joined.onPeerJoin = handler;
    },
    onLeave: (handler) => {
      joined.onPeerLeave = handler;
    },
    leave: () => void joined.leave(),
  };
}

/** What passes over the channel of `localLink`, which carries its own joining and leaving. */
type Wire =
  | { t: 'hi'; from: string }
  | { t: 'here'; from: string; to: string }
  | { t: 'bye'; from: string }
  | { t: 'msg'; from: string; to?: string; body: unknown };

/**
 * A link over a `BroadcastChannel` named for the room, for tests. A newcomer announces itself, those already there
 * answer it, so each hears of the other; a link says it leaves when it is left, or when its page is hidden for the
 * last time, which is how a closed tab is heard here.
 */
export function localLink(room: string): Link {
  const me = crypto.randomUUID();
  const channel = new BroadcastChannel(`ooerfish-phone-${room}`);
  const peers = new Set<string>();
  let onMessage: (raw: unknown, peer: string) => void = () => {};
  let onJoin: (peer: string) => void = () => {};
  let onLeave: (peer: string) => void = () => {};
  let open = true;

  const post = (wire: Wire) => {
    if (open) channel.postMessage(wire);
  };
  const meet = (peer: string) => {
    if (peers.has(peer)) return;
    peers.add(peer);
    onJoin(peer);
  };

  channel.onmessage = (event: MessageEvent<Wire>) => {
    const wire = event.data;
    if (wire.from === me) return;
    switch (wire.t) {
      case 'hi':
        // the answer goes first, so the newcomer knows of this link before whatever this link then sends it
        post({ t: 'here', from: me, to: wire.from });
        meet(wire.from);
        return;
      case 'here':
        if (wire.to === me) meet(wire.from);
        return;
      case 'bye':
        if (peers.delete(wire.from)) onLeave(wire.from);
        return;
      case 'msg':
        if (wire.to === undefined || wire.to === me) onMessage(wire.body, wire.from);
        return;
    }
  };

  const leave = () => {
    if (!open) return;
    post({ t: 'bye', from: me });
    open = false;
    channel.close();
    peers.clear();
    if (typeof globalThis.removeEventListener === 'function') globalThis.removeEventListener('pagehide', leave);
  };
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', leave);
  post({ t: 'hi', from: me });

  return {
    send: (body, to) => post({ t: 'msg', from: me, to, body }),
    onMessage: (handler) => {
      onMessage = handler;
    },
    onJoin: (handler) => {
      onJoin = handler;
    },
    onLeave: (handler) => {
      onLeave = handler;
    },
    leave,
  };
}
