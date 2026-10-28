/**
 * The town below the plant, and the people in it (`docs/post.md`): content, said once here so the letters, the radio
 * and the later slices all name the same neighbours. The design names the townsfolk by role and leaves their names to
 * be chosen; these are the user's choice, to change as they like. A line is what a person is like, for whoever writes
 * in their voice next.
 */

export interface Person {
  name: string;
  line: string;
}

export const TOWN = {
  name: 'Brightwater',
  people: {
    postmistress: {
      name: 'Mrs Ida Penny',
      line: 'writes for anyone who cannot, ducks included; knows everything first',
    },
    engineer: {
      name: 'Wendell Fisk',
      line: 'the retired plant engineer: embarrassed, precise, kind; keeps saying it was not his department',
    },
    baker: {
      name: 'Marigold Bunn',
      line: 'pays in pies and buns; tells the weather by the rise of her dough',
    },
    club: { name: 'the Glow-Worms', line: 'the children’s club; capitals when excited' },
    mayor: { name: 'Mayor Hubert Quill', line: 'fond of a ceremony and a ribbon' },
    fisherman: { name: 'Old Ned', line: 'has caught everything once, in nineteen fifty-something' },
    rival: { name: 'Flo Keel', line: 'Old Ned’s rival: quicker, drier, buys the buns when she loses' },
    ducks: { name: 'the Mallards', line: 'the Duck Pond’s own, seven of them; Mrs Penny writes for them' },
  } satisfies Record<string, Person>,
  /** The club’s letters are written by one of its members. */
  club: { writer: 'Pip (age 9)' },
} as const;

export type Role = keyof typeof TOWN.people;
