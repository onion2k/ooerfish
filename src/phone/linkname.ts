/**
 * Which link the address asks for. A file of its own, and not part of `link.ts`, because the page reads it at boot
 * while the links themselves (and Trystero behind one of them) are fetched only when Pair a phone is pressed: here
 * the boot carries a dozen lines and not the link's code.
 */

/** The two links there are. */
export type LinkName = 'local' | 'nostr';

/** The names of the links, for refusing one that is not known by name. */
const LINKS: readonly LinkName[] = ['local', 'nostr'];

/**
 * The link an address asks for with `?phonelink=`: nostr unless it says otherwise. A value not known is refused by
 * name, and the default kept, as the lab's settings do; it is not a lab setting, so it is never written back.
 */
export function readPhoneLink(query: URLSearchParams): { link: LinkName; refusal: string | null } {
  const text = query.get('phonelink');
  if (text === null) return { link: 'nostr', refusal: null };
  const link = LINKS.find((name) => name === text);
  if (link) return { link, refusal: null };
  return {
    link: 'nostr',
    refusal: `phonelink ${JSON.stringify(text)} is not known (${LINKS.join(' or ')}); using nostr`,
  };
}

/** What the phone page's address says: the room and its key, and which link to join it over. */
export type PhoneAddress = { ok: true; room: string; key: string; link: LinkName } | { ok: false; why: string };

/** A room or key as `newPairing` makes them, in base 36; nothing else is taken from an address, which anyone can write. */
const TOKEN = /^[0-9a-z]{4,64}$/;

/**
 * The pairing in the phone page's address fragment (`#room=…&key=…`, and `&link=local` for the tests' link). A fragment
 * is never sent to a server. A missing, odd or unknown part is refused by name, and the page then asks for the code to
 * be scanned again: a link that guessed would join a room nobody opened.
 */
export function readPhoneAddress(hash: string): PhoneAddress {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const room = params.get('room');
  const key = params.get('key');
  if (room === null) return { ok: false, why: 'the address has no room in it' };
  if (key === null) return { ok: false, why: 'the address has no key in it' };
  if (!TOKEN.test(room)) return { ok: false, why: 'the room in the address is not one the screen makes' };
  if (!TOKEN.test(key)) return { ok: false, why: 'the key in the address is not one the screen makes' };
  const name = params.get('link');
  if (name === null) return { ok: true, room, key, link: 'nostr' };
  const link = LINKS.find((known) => known === name);
  if (!link) return { ok: false, why: `link ${JSON.stringify(name)} is not known (${LINKS.join(' or ')})` };
  return { ok: true, room, key, link };
}
