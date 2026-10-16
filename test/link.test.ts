/** The link between the screen and the phone: which one the address asks for, and the local one, which tests use. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localLink, type Link } from '../src/phone/link';
import { readPhoneLink } from '../src/phone/linkname';

describe('the link the address asks for', () => {
  const read = (search: string) => readPhoneLink(new URLSearchParams(search));

  it('is nostr when the address says nothing', () => {
    expect(read('')).toEqual({ link: 'nostr', refusal: null });
  });

  it('is local when the address asks for it, and nostr when it asks for that', () => {
    expect(read('?phonelink=local')).toEqual({ link: 'local', refusal: null });
    expect(read('?phonelink=nostr')).toEqual({ link: 'nostr', refusal: null });
  });

  it('refuses a value it does not know by name, and keeps the default', () => {
    const got = read('?phonelink=nonsense');
    expect(got.link).toBe('nostr');
    expect(got.refusal).toContain('phonelink');
    expect(got.refusal).toContain('"nonsense"');
    // an empty value is not a name either
    expect(read('?phonelink=').refusal).toContain('""');
  });
});

describe('the local link', () => {
  const open: Link[] = [];
  /** A link in a room of this test's own, so that tests never hear each other. */
  const room = `test-${Math.random().toString(36).slice(2)}`;
  const made = (r = room) => {
    const link = localLink(r);
    open.push(link);
    return link;
  };
  afterEach(() => {
    for (const link of open.splice(0)) link.leave();
  });

  it('tells each of two links of the other joining, once', async () => {
    const a = made();
    const seenByA = vi.fn();
    a.onJoin(seenByA);
    const b = made();
    const seenByB = vi.fn();
    b.onJoin(seenByB);
    await vi.waitFor(() => {
      expect(seenByA).toHaveBeenCalledTimes(1);
      expect(seenByB).toHaveBeenCalledTimes(1);
    });
    // the one that was there first is told of the newcomer by name, and the newcomer of the one that was there
    expect(seenByA.mock.calls[0][0]).toEqual(expect.any(String));
    expect(seenByA.mock.calls[0][0]).not.toBe(seenByB.mock.calls[0][0]);
  });

  it('carries a message each way, from the peer that sent it', async () => {
    const a = made();
    const b = made();
    let aPeer = '';
    let bPeer = '';
    a.onJoin((p) => (bPeer = p));
    b.onJoin((p) => (aPeer = p));
    await vi.waitFor(() => expect(aPeer && bPeer).toBeTruthy());
    const heardByA = vi.fn();
    const heardByB = vi.fn();
    a.onMessage(heardByA);
    b.onMessage(heardByB);
    a.send({ kind: 'busy' });
    b.send({ kind: 'up' });
    await vi.waitFor(() => {
      expect(heardByB).toHaveBeenCalledWith({ kind: 'busy' }, aPeer);
      expect(heardByA).toHaveBeenCalledWith({ kind: 'up' }, bPeer);
    });
  });

  it('sends to one peer only when it is told which', async () => {
    const a = made();
    const joined = vi.fn();
    a.onJoin(joined);
    const b = made();
    const c = made();
    // a learns which peer is which from what each says of itself
    const named = new Map<string, string>();
    a.onMessage((raw, peer) => void named.set((raw as { name: string }).name, peer));
    const heardByB = vi.fn();
    const heardByC = vi.fn();
    // b and c hear each other's introductions too; only a's messages, which have a kind, are counted
    b.onMessage((raw) => {
      if ((raw as { kind?: string }).kind) heardByB();
    });
    c.onMessage((raw) => {
      if ((raw as { kind?: string }).kind) heardByC();
    });
    await vi.waitFor(() => expect(joined).toHaveBeenCalledTimes(2));
    b.send({ name: 'b' });
    c.send({ name: 'c' });
    await vi.waitFor(() => expect(named.size).toBe(2));
    a.send({ kind: 'only' }, named.get('b'));
    await vi.waitFor(() => expect(heardByB).toHaveBeenCalledTimes(1));
    expect(heardByC).not.toHaveBeenCalled();
    // and a message to all reaches both
    a.send({ kind: 'all' });
    await vi.waitFor(() => {
      expect(heardByB).toHaveBeenCalledTimes(2);
      expect(heardByC).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps one room from another', async () => {
    const a = made();
    const other = made(`${room}-other`);
    const heard = vi.fn();
    const joined = vi.fn();
    other.onMessage(heard);
    other.onJoin(joined);
    a.send({ kind: 'busy' });
    const b = made();
    await vi.waitFor(() => expect(b).toBeDefined());
    // let a few turns of the event loop pass: nothing is expected, and there is nothing to wait for
    await new Promise((done) => setTimeout(done, 50));
    expect(heard).not.toHaveBeenCalled();
    expect(joined).toHaveBeenCalledTimes(0);
  });

  it('tells the others when a link leaves, and sends nothing after', async () => {
    const a = made();
    const b = made();
    const joined: string[] = [];
    const left: string[] = [];
    a.onJoin((p) => joined.push(p));
    a.onLeave((p) => left.push(p));
    await vi.waitFor(() => expect(joined).toHaveLength(1));
    const heard = vi.fn();
    a.onMessage(heard);
    b.leave();
    await vi.waitFor(() => expect(left).toEqual(joined));
    expect(() => b.send({ kind: 'up' })).not.toThrow();
    await new Promise((done) => setTimeout(done, 50));
    expect(heard).not.toHaveBeenCalled();
  });

  it('can be joined again after a leave, by a new link with a new name', async () => {
    const a = made();
    const joined: string[] = [];
    a.onJoin((p) => joined.push(p));
    const b = made();
    await vi.waitFor(() => expect(joined).toHaveLength(1));
    b.leave();
    const again = made();
    await vi.waitFor(() => expect(joined).toHaveLength(2));
    expect(joined[1]).not.toBe(joined[0]);
    expect(again).toBeDefined();
  });
});
