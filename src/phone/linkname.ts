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
