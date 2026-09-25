import type { ScoreId } from './audio';

/** A thing in the view that carries a memory. Region is an ellipse in scene units (x 0..1.6, y 0..1). */
export interface Subject {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  line: string;
}

/**
 * Something that passes through the view once: Joe on the bridge, the bus, the robin.
 * Pour paint on it while it's there and it stays in the painting. Its timing lives in the scene config.
 */
export interface Moment {
  id: string;
  appears?: string;
  caught: string;
  /** Once it has gone, if it was caught. */
  after?: string;
  /** Once it has gone, if it wasn't. */
  missed?: string;
  /** Replaces the chapter's closing line if this moment was missed. */
  closeMissed?: string;
  /** Someone she expects to see who isn't there: painting them shows the empty place. */
  ghost?: boolean;
}

export interface Chapter {
  id: Exclude<ScoreId, 'title' | 'lift'>;
  card: string;
  voice: 'gran' | 'grandchild';
  lines: { at: number; text: string }[];
  subjects: Subject[];
  close: string;
  closeLow: string;
  closeFull?: string;
  brush?: number;
  moments?: Moment[];
  /** Seconds of pouring she has time for, when that's short. */
  paint?: number;
}

export const TITLE = 'Pentimento';
export const DEFINITION = 'A pentimento is an earlier painting that shows through the paint on top of it.';

export const CHAPTERS: Chapter[] = [
  {
    id: 'nine',
    card: 'Nine',
    voice: 'gran',
    lines: [
      { at: 3, text: "This board is older than your mother, so I'd better explain it." },
      { at: 16, text: 'My aunt gave me a tin of paints for my ninth birthday. There were twelve colours, and I used up the white first.' },
      { at: 33, text: 'This was the view from my bedroom window. There was no bridge then, so everyone crossed on the ferry.' },
    ],
    moments: [
      {
        id: 'ferry',
        caught: 'The ferryman was called Mr Aldous. He let children ride for free if they bailed out the water.',
        missed: "Mr Aldous took the ferry across every half hour. He never kept still long enough for me to paint him.",
      },
    ],
    subjects: [
      { id: 'fig', x: 0.17, y: 0.92, rx: 0.1, ry: 0.07, line: 'My father planted the fig tree that spring. It was a stick with two leaves, and he watered it every evening.' },
      { id: 'swallows', x: 0.95, y: 0.22, rx: 0.45, ry: 0.13, line: 'Swallows nested under our roof. I tried to paint them, but they always came out as smudges.' },
    ],
    close: 'I only had the one board. So the next year, I painted over it.',
    closeLow: "I didn't paint much that year. I was nine, and it was summer.",
  },
  {
    id: 'sixteen',
    card: 'Sixteen',
    voice: 'gran',
    lines: [
      { at: 3, text: 'At sixteen I wanted to leave this town, and I told everyone so.' },
      { at: 17, text: 'They were building the bridge that year. It took three years, and the whole town complained about the noise.' },
      { at: 32, text: 'I kept painting the view, even though I said I was sick of it.' },
    ],
    moments: [
      {
        id: 'train',
        appears: 'The train to the city ran along the far side of the valley every afternoon.',
        caught: 'I knew the timetable by heart. One day I was going to be on that train.',
        missed: "I watched it go without painting it. I told myself I'd be on it the next year.",
      },
    ],
    subjects: [
      { id: 'bridge', x: 0.76, y: 0.565, rx: 0.3, ry: 0.06, line: 'The builders came from the city. After school we sat on the bank and watched them work.' },
      { id: 'ferry', x: 0.79, y: 0.675, rx: 0.27, ry: 0.035, line: 'Mr Aldous knew the bridge would put him out of work. He painted his boat bright blue anyway.' },
      { id: 'fig', x: 0.2, y: 0.85, rx: 0.12, ry: 0.1, line: "The fig tree was taller than me by then. It still hadn't grown a single fig." },
    ],
    close: "I said I'd leave when I finished school. I didn't, and I'm still not sure why.",
    closeLow: 'I hardly painted that year. I was too busy being sixteen.',
  },
  {
    id: 'twentythree',
    card: 'Twenty-three',
    voice: 'gran',
    lines: [
      { at: 3, text: 'The bridge opened the spring I turned twenty-three. The ferry stopped the same week.' },
    ],
    moments: [
      {
        id: 'joe',
        appears: 'Every morning at eight, a man in a yellow coat crossed the bridge.',
        caught: 'The first time he waved at me, I dropped my brush out of the window.',
        after: 'His name was Joe. He worked at the post office, and he was never late.',
        missed: "He was across the bridge before I could paint him. I didn't know his name yet.",
        closeMissed: 'I did get him into a painting in the end. His name was Joe, and we married the next summer.',
      },
    ],
    subjects: [
      { id: 'ferry', x: 0.405, y: 0.7, rx: 0.07, ry: 0.03, line: 'They dragged the ferry up onto the bank and left it there. Nettles grew through it for years.' },
      { id: 'cherry', x: 1.3, y: 0.62, rx: 0.2, ry: 0.05, line: 'The cherry trees on the far bank flowered that week. The petals floated down the river for days.' },
    ],
    close: 'We married the next summer. Joe moved in with a bicycle and two chairs.',
    closeLow: "I didn't paint much that spring. I spent most of it on the bridge.",
  },
  {
    id: 'thirtyone',
    card: 'Thirty-one',
    voice: 'gran',
    lines: [
      { at: 3, text: 'Our daughter June was born in May. That summer the washing line was never empty.' },
      { at: 11, text: 'I nearly didn\'t paint that year. I did this one in twenty minutes while she slept.' },
    ],
    paint: 9,
    moments: [
      {
        id: 'kids',
        caught: "Children jumped off the bridge into the river, which wasn't allowed. I'd done it too, once.",
        missed: "Children jumped off the bridge into the river, which wasn't allowed.",
      },
    ],
    subjects: [
      { id: 'washing', x: 0.26, y: 0.83, rx: 0.22, ry: 0.06, line: 'Joe hung the washing out every morning before work. He always pegged the socks in pairs.' },
      { id: 'fig', x: 0.2, y: 0.68, rx: 0.2, ry: 0.14, line: 'The fig tree grew its first figs that summer. My father ate the first one standing under the tree.' },
    ],
    close: "She woke up before I'd finished the sky.",
    closeLow: "She woke up before I'd painted much at all.",
    closeFull: 'She woke up just as I finished.',
  },
  {
    id: 'fortyfour',
    card: 'Forty-four',
    voice: 'gran',
    lines: [
      { at: 3, text: 'My father died in the November. A week later the river flooded, right up to the garden wall.' },
      { at: 17, text: "I painted this one at night, because I couldn't sleep." },
      { at: 33, text: 'Joe left the kitchen lamp on for me. I could see its light on the wet grass.' },
    ],
    subjects: [
      { id: 'lanterns', x: 0.74, y: 0.53, rx: 0.33, ry: 0.04, line: 'The water came within a foot of the arches. Half the town stood on the bridge all night to watch.' },
      { id: 'kitchen', x: 0.2, y: 0.95, rx: 0.17, ry: 0.07, line: "June was thirteen. She sat up with me and didn't say much, and that helped." },
    ],
    moments: [
      {
        id: 'father',
        ghost: true,
        caught: 'My father used to stand under the fig tree after supper. I kept expecting to see him there.',
        missed: 'My father used to stand under the fig tree after supper. I kept expecting to see him there.',
      },
    ],
    close: 'The flood broke a branch off his fig tree. In the spring, it grew new leaves around the break.',
    closeLow: "I couldn't paint much that winter. I've left it the way it was.",
  },
  {
    id: 'fortynine',
    card: 'Forty-nine',
    voice: 'gran',
    lines: [
      { at: 3, text: "June left for the city when she was eighteen. I'd wanted to leave at her age, and she actually did it." },
      { at: 58, text: 'The house was very quiet that winter. It took us a long time to get used to it.' },
    ],
    moments: [
      {
        id: 'bus',
        appears: "She caught the eight o'clock bus over the bridge.",
        caught: 'She waved from the back window of the bus. I painted her as a red dot, because that was her coat.',
        after: 'Joe waved until the bus was out of sight.',
        missed: "The bus was over the bridge before I'd picked up my brush. Joe waved until it was out of sight.",
      },
    ],
    subjects: [
      { id: 'joe', x: 0.42, y: 0.86, rx: 0.1, ry: 0.08, line: 'Joe took up gardening after that. He grew far more beans than two people could eat.' },
      { id: 'fig', x: 0.19, y: 0.66, rx: 0.22, ry: 0.17, line: 'The figs ripened late that year. Joe picked them and gave most of them away.' },
    ],
    close: 'She rang every Sunday, and she still does.',
    closeLow: "I didn't paint much that autumn. I kept going into her room instead.",
  },
  {
    id: 'seventytwo',
    card: 'Seventy-two',
    voice: 'gran',
    lines: [
      { at: 3, text: 'Joe died in the January. We had been married forty-eight years.' },
      { at: 62, text: 'I nearly didn\'t paint this one. June came home and sat with me while I did.' },
    ],
    moments: [
      {
        id: 'joeGhost',
        ghost: true,
        caught: "For a long time I still looked at the bridge at eight o'clock.",
        missed: "For a long time I still looked at the bridge at eight o'clock.",
      },
      {
        id: 'robin',
        caught: "A robin came to the garden wall every morning that winter. I fed it Joe's biscuits.",
        missed: 'A robin came to the garden wall every morning that winter.',
      },
    ],
    subjects: [
      { id: 'bench', x: 0.375, y: 0.885, rx: 0.065, ry: 0.035, line: 'Joe built that bench the summer June was born. I still sit on it most mornings.' },
      { id: 'bridge', x: 0.74, y: 0.56, rx: 0.35, ry: 0.06, line: 'The bridge was very quiet in the snow. You could hear the river moving under the ice.' },
    ],
    close: 'When the snow melted, I planted his beans. I planted far too many, the way he always did.',
    closeLow: "I couldn't paint much that year, and I haven't touched it since.",
  },
  {
    id: 'eightysix',
    card: 'Eighty-six',
    voice: 'gran',
    brush: 1.5,
    lines: [
      { at: 3, text: 'My eyes went the way my mother\'s did. Now I see colours and not much else.' },
      { at: 13, text: "I don't go out much any more, so this time I painted the window as well." },
      { at: 21, text: 'You were four that spring. You spent the whole visit under the fig tree.' },
    ],
    moments: [
      {
        id: 'child',
        caught: 'You asked me why the fig tree had no flowers. I told you the flowers are inside the figs, which is true.',
      },
    ],
    subjects: [
      { id: 'tulips', x: 1.22, y: 0.79, rx: 0.07, ry: 0.1, line: "June brings me tulips. She thinks I can't tell they're from the supermarket." },
      { id: 'bridge', x: 0.74, y: 0.56, rx: 0.35, ry: 0.06, line: "I can't see the bridge any more. I know where it is, so I painted it anyway." },
    ],
    close: "I want you to have the board. Paint over my pictures, because that's what it's for.",
    closeLow: "I didn't manage much this year. That leaves more room for you.",
  },
  {
    id: 'later',
    card: 'Twenty years later',
    voice: 'grandchild',
    lines: [
      { at: 3, text: "Gran died the winter after she gave me the board. It sat in a cupboard at Mum's for twenty years." },
      { at: 17, text: 'I live in her house now. This is the view from her bedroom window.' },
      { at: 37, text: 'In some lights you can see her paintings under mine. The bridge shows through the most.' },
    ],
    subjects: [
      { id: 'fig', x: 0.2, y: 0.62, rx: 0.25, ry: 0.2, line: "The fig tree is enormous now. I still haven't seen a fig flower." },
      { id: 'swallows', x: 0.95, y: 0.22, rx: 0.45, ry: 0.13, line: 'Swallows still nest under the roof. Gran could never paint them, and neither can I.' },
    ],
    moments: [
      {
        id: 'train',
        appears: 'I came home on the afternoon train, the one Gran used to watch.',
        caught: "She wanted to be on it when she was sixteen. I've been on it more times than I can count.",
        missed: 'Gran wanted to be on that train when she was sixteen. She never did get on it.',
      },
      {
        id: 'kids',
        caught: "Children still jump off the bridge. It still isn't allowed.",
      },
    ],
    close: "I'll paint it again next summer.",
    closeLow: "I haven't painted much yet. I'll do more next summer.",
  },
];

export const UI = {
  begin: 'Begin',
  sound: 'Turn your sound on.',
  keys: 'You can also move with the arrow keys and pour with Space.',
  rotate: 'Turn your phone sideways for a bigger painting.',
  hintMouse: 'Click to pour paint, or hold to pour more. The painting dries when the music ends.',
  hintTouch: 'Tap to pour paint, or hold to pour more. The painting dries when the music ends.',
  catchMouse: 'Click on the ferry to paint it in before it goes.',
  catchTouch: 'Tap the ferry to paint it in before it goes.',
  finish: 'Finish painting',
  lift: 'Hold to lift the paint and see the years underneath.',
  save: 'Save image',
  again: 'Start again',
  mute: 'Mute',
  unmute: 'Unmute',
  contextLost: 'The graphics card was reset. Reload the page to carry on.',
  noWebgl: "This game needs WebGL 2, which your browser doesn't support. Try a recent version of Chrome, Firefox or Safari.",
};
