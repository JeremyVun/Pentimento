export interface Palette {
  sky0: string; sky1: string; sky2: string;
  sun: string; sunGlow: string;
  cloudLit: string; cloudShade: string;
  hillFar: string; hillMid: string; hillNear: string; hillNearShade: string;
  field1: string; field2: string; field3: string;
  treeDark: string; treeLit: string;
  wall1: string; wall2: string; wall3: string; wallShade: string;
  roof: string; roof2: string; roofShade: string;
  window: string; windowLit: string;
  river0: string; river1: string; riverLight: string; riverDark: string;
  stone: string; stoneShade: string; stoneDark: string;
  bank: string; bankShade: string; lane: string;
  grass: string; grassShade: string; gardenWall: string; gardenWallShade: string; path: string;
  trunk: string; trunkShade: string;
  leafDark: string; leafMid: string; leafLight: string;
  wood: string; woodShade: string;
  skin: string; ink: string;
}

export type Leaves = 'stick' | 'none' | 'spring' | 'summer' | 'autumn';
export type Weather = 'rain' | 'storm' | 'snow' | 'leaves' | 'petals' | null;
export type Figure =
  | 'father' | 'ferryman' | 'workers' | 'joeBridge' | 'joeGarden' | 'joeBeans' | 'swimmers'
  | 'lanterns' | 'bus' | 'child' | 'june' | 'kidsBridge' | 'strollers' | 'rower' | 'train' | 'joeGhost' | 'fatherGhost';

export interface SceneConfig {
  pal: Palette;
  sun?: { x: number; y: number; r: number; glow: number };
  moon?: { x: number; y: number; r: number };
  stars?: boolean;
  clouds: { kind: 'cumulus' | 'streaky' | 'storm' | 'rain'; n: number; y0: number; y1: number; speed: number; scale: number };
  town: number;
  townLit?: boolean;
  snow?: boolean;
  flood?: boolean;
  ice?: boolean;
  bridge: 'none' | 'building' | 'built';
  lamps?: 'off' | 'on' | 'dawn';
  ferry: 'active' | 'moored' | 'wreck' | 'none';
  fig: { size: number; leaves: Leaves; fruit?: boolean; broken?: boolean; snow?: boolean };
  bench?: boolean;
  washing?: boolean;
  beans?: 'green' | 'bare';
  figures: Figure[];
  birds?: 'swallows' | 'robin' | 'gulls';
  weather?: Weather;
  mist?: boolean;
  cherry?: boolean;
  kitchenLight?: boolean;
  window?: boolean;
  blur?: number;
  wind: number;
  lightning?: boolean;
  duration: number;
  /** Scene second each passing moment begins (Joe's crossing, the bus, the robin...). */
  moments?: Record<string, number>;
  /** Scene second the church bell strikes eight. */
  bellAt?: number;
  /** The train comes in from the left instead of leaving to the left. */
  trainArrives?: boolean;
  /** Her eyes have gone: no pencil lines, only blurred colour. */
  noPencil?: boolean;
}

const base: Palette = {
  sky0: '#6fa7d8', sky1: '#a9cbe6', sky2: '#ebe4cf',
  sun: '#fff4cf', sunGlow: '#fff1c1',
  cloudLit: '#fbf6ea', cloudShade: '#b3c2da',
  hillFar: '#a3b6d1', hillMid: '#8fae93', hillNear: '#77a86e', hillNearShade: '#5a8a5e',
  field1: '#b9c96a', field2: '#dcc46a', field3: '#8fb45e',
  treeDark: '#3c6647', treeLit: '#6f9a55',
  wall1: '#f2e2c4', wall2: '#e9c697', wall3: '#efd9cf', wallShade: '#b39a8c',
  roof: '#c25a3d', roof2: '#9c4b3b', roofShade: '#7e3f36',
  window: '#4a4c5c', windowLit: '#f6c35a',
  river0: '#a5c8dc', river1: '#3f7ea4', riverLight: '#eef6f4', riverDark: '#2c5c7d',
  stone: '#e3d2b4', stoneShade: '#a79484', stoneDark: '#5d5660',
  bank: '#99bd6c', bankShade: '#6f9a58', lane: '#dcc9a2',
  grass: '#8db862', grassShade: '#5f8f4c', gardenWall: '#d2bf9f', gardenWallShade: '#9b8873', path: '#dccaa6',
  trunk: '#7d6d60', trunkShade: '#56493f',
  leafDark: '#2f5a3b', leafMid: '#548a4a', leafLight: '#98c070',
  wood: '#8a6446', woodShade: '#5c4230',
  skin: '#e9b99a', ink: '#2b2a33',
};

const p = (o: Partial<Palette>): Palette => ({ ...base, ...o });

export const SCENES: Record<string, SceneConfig> = {
  title: {
    pal: p({
      sky0: '#5b6aa6', sky1: '#e3a88a', sky2: '#fbdca2', sun: '#fff0c4', sunGlow: '#ffd79a',
      cloudLit: '#ffd7a8', cloudShade: '#a07a9c',
      hillFar: '#9d86a8', hillMid: '#b38c7a', hillNear: '#8f9a5f', hillNearShade: '#6b6f4f',
      field1: '#d8b060', field2: '#e7c577', field3: '#a7a456',
      treeDark: '#4a4f3c', treeLit: '#a19655',
      wall1: '#f6d6a6', wall2: '#f0bb82', wall3: '#f3cdb5', wallShade: '#9c7b86',
      roof: '#c8583c', roof2: '#a4493a', roofShade: '#7a3e45',
      river0: '#f5cf9a', river1: '#5e6690', riverLight: '#fff0c8', riverDark: '#3f4570',
      stone: '#f0c79a', stoneShade: '#9a7684', stoneDark: '#57475e',
      bank: '#a9a45a', bankShade: '#7b7648', lane: '#ebc795',
      grass: '#9aa557', grassShade: '#6c7547', gardenWall: '#e5bf92', gardenWallShade: '#9b7c7c', path: '#eccb9a',
      trunk: '#6d5552', trunkShade: '#4a3a40',
      leafDark: '#2f4a3a', leafMid: '#5e7f45', leafLight: '#b9b35e',
    }),
    sun: { x: 0.52, y: 0.38, r: 0.035, glow: 0.42 },
    clouds: { kind: 'streaky', n: 7, y0: 0.08, y1: 0.33, speed: 0.004, scale: 1 },
    town: 1, townLit: true, bridge: 'built', lamps: 'on', ferry: 'none',
    fig: { size: 0.85, leaves: 'summer', fruit: true },
    bench: true,
    figures: ['strollers'], birds: 'swallows', wind: 0.2, duration: 0,
  },

  nine: {
    pal: base,
    sun: { x: 1.36, y: 0.13, r: 0.04, glow: 0.3 },
    clouds: { kind: 'cumulus', n: 6, y0: 0.08, y1: 0.3, speed: 0.006, scale: 1 },
    town: 0, bridge: 'none', ferry: 'active',
    fig: { size: 0.04, leaves: 'stick' },
    figures: ['father', 'ferryman'], birds: 'swallows', wind: 0.4, duration: 80, moments: { ferry: 40 },
  },

  sixteen: {
    pal: p({
      sky0: '#56649e', sky1: '#d49a7c', sky2: '#f4c682', sun: '#ffe0a2', sunGlow: '#ffc978',
      cloudLit: '#f8c79c', cloudShade: '#8a6f95',
      hillFar: '#8f82a8', hillMid: '#a98a70', hillNear: '#b58a58', hillNearShade: '#7d5f4b',
      field1: '#d3a24e', field2: '#bb7c3f', field3: '#a08b4d',
      treeDark: '#6a4a33', treeLit: '#d39a38',
      wall1: '#f4cf9e', wall2: '#eab27f', wall3: '#f0c6ae', wallShade: '#8e6a78',
      roof: '#b84a38', roof2: '#96403a', roofShade: '#6c3a48',
      river0: '#efbf8e', river1: '#565c88', riverLight: '#ffe4b2', riverDark: '#3b3c64',
      stone: '#ebc496', stoneShade: '#8b6c7a', stoneDark: '#4a3c55',
      bank: '#b09a52', bankShade: '#7c6a45', lane: '#e8c28f',
      grass: '#a8a052', grassShade: '#6f6a44', gardenWall: '#e0b98a', gardenWallShade: '#8f7078', path: '#e8c595',
      trunk: '#62504a', trunkShade: '#433640',
      leafDark: '#6f5a2c', leafMid: '#bf8c32', leafLight: '#e9c15c',
      wood: '#8a5a3c', woodShade: '#5a3a30',
    }),
    sun: { x: 0.2, y: 0.33, r: 0.045, glow: 0.4 },
    clouds: { kind: 'streaky', n: 8, y0: 0.06, y1: 0.3, speed: 0.008, scale: 1 },
    town: 0.2, bridge: 'building', ferry: 'active',
    fig: { size: 0.24, leaves: 'autumn' },
    figures: ['workers', 'ferryman', 'train'], birds: 'gulls', weather: 'leaves', wind: 0.8, duration: 80, moments: { train: 44 },
  },

  twentythree: {
    pal: p({
      sky0: '#8aa4bd', sky1: '#c9d5d8', sky2: '#f0f0e2', sun: '#fffbe8', sunGlow: '#fff8de',
      cloudLit: '#f5f4ef', cloudShade: '#98a5b6',
      hillFar: '#94a9b6', hillMid: '#8db08f', hillNear: '#7aa877', hillNearShade: '#5a8763',
      field1: '#a8c97c', field2: '#c6d98c', field3: '#8dbb6a',
      treeDark: '#3f6a4e', treeLit: '#7eae63',
      wall1: '#f1e7d6', wall2: '#e6d0b0', wall3: '#eadbd5', wallShade: '#a49da4',
      roof: '#b9624b', roof2: '#8f5a52', roofShade: '#6e4c50',
      river0: '#bccdd4', river1: '#50748b', riverLight: '#f6f8f2', riverDark: '#35566c',
      stone: '#ebe0ca', stoneShade: '#a2978d', stoneDark: '#5f5d68',
      bank: '#8fbc68', bankShade: '#699552', lane: '#d6ccb4',
      grass: '#86b864', grassShade: '#5f9452', gardenWall: '#d6c8b0', gardenWallShade: '#9a9186', path: '#d8cfb8',
      leafDark: '#3c6d3f', leafMid: '#6ea94f', leafLight: '#b6da7b',
    }),
    sun: { x: 1.2, y: 0.16, r: 0.035, glow: 0.22 },
    clouds: { kind: 'rain', n: 7, y0: 0.05, y1: 0.3, speed: 0.007, scale: 1.1 },
    town: 0.4, bridge: 'built', lamps: 'off', ferry: 'moored',
    fig: { size: 0.36, leaves: 'spring' },
    figures: ['joeBridge'], weather: 'rain', cherry: true, wind: 0.3, duration: 85, moments: { joe: 34 }, bellAt: 33.4,
  },

  thirtyone: {
    pal: p({
      sky0: '#3a80c4', sky1: '#7ab4de', sky2: '#dbeaec', sun: '#ffffff', sunGlow: '#fffbe6',
      cloudLit: '#ffffff', cloudShade: '#a7c0dc',
      hillFar: '#86a6c8', hillMid: '#78a879', hillNear: '#5f9e56', hillNearShade: '#467a45',
      field1: '#cdc54f', field2: '#e3bb48', field3: '#7fae4d',
      treeDark: '#2c5838', treeLit: '#5d9544',
      wall1: '#f8efdb', wall2: '#f2d28c', wall3: '#f3dccf', wallShade: '#a2939e',
      roof: '#c9553a', roof2: '#a24735', roofShade: '#7a3a3c',
      river0: '#86c2e2', river1: '#2a6ea0', riverLight: '#ffffff', riverDark: '#1f5680',
      stone: '#f2e4c9', stoneShade: '#9b8f95', stoneDark: '#4f4f62',
      bank: '#78b04d', bankShade: '#558b3f', lane: '#e8d6a8',
      grass: '#72b048', grassShade: '#4a8538', gardenWall: '#e2d0ad', gardenWallShade: '#9c8b80', path: '#eadab0',
      leafDark: '#1f4a2e', leafMid: '#3d7c3a', leafLight: '#7db654',
    }),
    sun: { x: 0.92, y: 0.07, r: 0.04, glow: 0.2 },
    clouds: { kind: 'cumulus', n: 4, y0: 0.1, y1: 0.28, speed: 0.004, scale: 0.8 },
    town: 0.6, bridge: 'built', lamps: 'off', ferry: 'wreck',
    fig: { size: 0.5, leaves: 'summer', fruit: true },
    bench: true, washing: true,
    figures: ['joeGarden', 'swimmers', 'kidsBridge'], birds: 'swallows', wind: 0.5, duration: 50, moments: { kids: 14 },
  },

  fortyfour: {
    pal: p({
      sky0: '#121a2c', sky1: '#232e48', sky2: '#394360', sun: '#e8e6d0', sunGlow: '#9aa3c0',
      cloudLit: '#5a6684', cloudShade: '#2c3552',
      hillFar: '#222b40', hillMid: '#1d2a33', hillNear: '#1b2a2c', hillNearShade: '#131e22',
      field1: '#243230', field2: '#2a3533', field3: '#1f2d2a',
      treeDark: '#131d20', treeLit: '#253438',
      wall1: '#3e445a', wall2: '#3a3d52', wall3: '#434459', wallShade: '#262a3b',
      roof: '#2c2e3e', roof2: '#282838', roofShade: '#1b1c2a',
      window: '#1c1e2a', windowLit: '#f5b94e',
      river0: '#3c4a66', river1: '#1a2438', riverLight: '#8497ba', riverDark: '#0f1522',
      stone: '#4f556c', stoneShade: '#2c3042', stoneDark: '#141824',
      bank: '#1f3029', bankShade: '#15221d', lane: '#34393f',
      grass: '#1f3029', grassShade: '#15221d', gardenWall: '#454654', gardenWallShade: '#282a36', path: '#3a3b44',
      trunk: '#322d33', trunkShade: '#1e1b22',
      leafDark: '#141c1c', leafMid: '#1d2a26', leafLight: '#2b3a33',
      wood: '#3a3036', woodShade: '#241e24',
      skin: '#8a6a60', ink: '#0d0f16',
    }),
    moon: { x: 1.18, y: 0.14, r: 0.028 },
    clouds: { kind: 'storm', n: 9, y0: 0.02, y1: 0.32, speed: 0.02, scale: 1.3 },
    town: 0.8, townLit: true, flood: true, bridge: 'built', lamps: 'on', ferry: 'none',
    fig: { size: 0.62, leaves: 'none', broken: true },
    bench: true,
    figures: ['lanterns', 'fatherGhost'], weather: 'storm', kitchenLight: true, wind: 1, lightning: true, duration: 80, moments: { father: 36 },
  },

  fortynine: {
    pal: p({
      sky0: '#a9b6c4', sky1: '#e3d6c0', sky2: '#f6e6c6', sun: '#fff6dc', sunGlow: '#ffeec6',
      cloudLit: '#f8eedd', cloudShade: '#c2bfc4',
      hillFar: '#c9c6c8', hillMid: '#c2b9a0', hillNear: '#b7ad86', hillNearShade: '#958d74',
      field1: '#d6ba7e', field2: '#c5a268', field3: '#b9b07a',
      treeDark: '#9c6a3a', treeLit: '#dca848',
      wall1: '#ede2d2', wall2: '#e4d0b4', wall3: '#e8d8d2', wallShade: '#a89ea3',
      roof: '#ab6451', roof2: '#8e5c55', roofShade: '#735058',
      river0: '#ece2d2', river1: '#7a8a94', riverLight: '#fff8ea', riverDark: '#5d6c78',
      stone: '#e8dac4', stoneShade: '#a69a96', stoneDark: '#6b6670',
      bank: '#b3aa76', bankShade: '#8f8864', lane: '#e3d3b2',
      grass: '#a2a86c', grassShade: '#7d8456', gardenWall: '#dccdb2', gardenWallShade: '#9d928a', path: '#e2d4b6',
      leafDark: '#8a5a24', leafMid: '#d49a3a', leafLight: '#f1c862',
    }),
    sun: { x: 1.28, y: 0.3, r: 0.05, glow: 0.45 },
    clouds: { kind: 'streaky', n: 6, y0: 0.05, y1: 0.28, speed: 0.004, scale: 1 },
    town: 1, bridge: 'built', lamps: 'off', ferry: 'none',
    fig: { size: 0.7, leaves: 'autumn', fruit: true },
    bench: true, beans: 'green',
    figures: ['bus', 'joeBeans'], weather: 'leaves', mist: true, wind: 0.3, duration: 80, moments: { bus: 24 }, bellAt: 23.4,
  },

  seventytwo: {
    pal: p({
      sky0: '#7a8cae', sky1: '#d8c3c9', sky2: '#f5dcc6', sun: '#fff0dc', sunGlow: '#ffdcc0',
      cloudLit: '#f3d8d0', cloudShade: '#9ea7c0',
      hillFar: '#c9d0e1', hillMid: '#dfe4ee', hillNear: '#ecf0f5', hillNearShade: '#b8c3d8',
      field1: '#eef1f6', field2: '#e4e9f1', field3: '#dce2ec',
      treeDark: '#5a5a66', treeLit: '#8d8c98',
      wall1: '#dcd8dc', wall2: '#d6cdc8', wall3: '#ddd3d2', wallShade: '#8f93a8',
      roof: '#f3f5f9', roof2: '#eef1f6', roofShade: '#aab3c8',
      window: '#4a4e62', windowLit: '#f4c46a',
      river0: '#aab4c6', river1: '#4a586e', riverLight: '#e9eef4', riverDark: '#35425a',
      stone: '#d9d5d8', stoneShade: '#8c92a8', stoneDark: '#4b5066',
      bank: '#eef1f6', bankShade: '#bcc6da', lane: '#e6e9f0',
      grass: '#f1f3f7', grassShade: '#c3cbdf', gardenWall: '#cfcbcf', gardenWallShade: '#8a8fa4', path: '#e9ebf1',
      trunk: '#4c4549', trunkShade: '#332e33',
      leafDark: '#5a5a5a', leafMid: '#6a6a6a', leafLight: '#7a7a7a',
      wood: '#4f6b58', woodShade: '#35493d',
    }),
    sun: { x: 0.98, y: 0.43, r: 0.04, glow: 0.35 },
    clouds: { kind: 'streaky', n: 5, y0: 0.05, y1: 0.3, speed: 0.003, scale: 1 },
    town: 1, townLit: true, snow: true, ice: true, bridge: 'built', lamps: 'dawn', ferry: 'none',
    fig: { size: 0.78, leaves: 'none', snow: true, broken: true },
    bench: true, beans: 'bare',
    figures: ['joeGhost'], birds: 'robin', weather: 'snow', wind: 0.15, duration: 95, moments: { joeGhost: 26.6, robin: 52 }, bellAt: 26,
  },

  eightysix: {
    pal: p({
      sky0: '#8db6da', sky1: '#d2e2e4', sky2: '#f6ead0', sun: '#fff7de', sunGlow: '#fff0c8',
      cloudLit: '#fdf6e6', cloudShade: '#bac6d8',
      hillFar: '#abbed2', hillMid: '#a8c29a', hillNear: '#8ebf78', hillNearShade: '#6d9d62',
      field1: '#c8da8a', field2: '#e8d88a', field3: '#a6cc78',
      treeDark: '#4f8052', treeLit: '#9ccb70',
      river0: '#b9d6e2', river1: '#5a90b2', riverLight: '#f8fbf6',
      stone: '#f1e4cc', stoneShade: '#aa9d94',
      grass: '#9acb6a', grassShade: '#72a656', bank: '#98c76a',
      leafDark: '#3f7a3e', leafMid: '#7cba58', leafLight: '#c4e286',
      wood: '#3e4a45', woodShade: '#27302c',
    }),
    sun: { x: 1.05, y: 0.2, r: 0.045, glow: 0.35 },
    clouds: { kind: 'cumulus', n: 5, y0: 0.08, y1: 0.28, speed: 0.004, scale: 1 },
    town: 1, bridge: 'built', lamps: 'off', ferry: 'none',
    fig: { size: 0.88, leaves: 'spring' },
    bench: true,
    figures: ['child', 'june'], weather: 'petals', cherry: true, window: true, blur: 0.011, wind: 0.3, duration: 85, moments: { child: 24 }, noPencil: true,
  },

  later: {
    pal: p({
      sky0: '#5f9fd6', sky1: '#a4cbe8', sky2: '#eee6d0',
      field1: '#bccb6a', field2: '#e0c86c',
      leafDark: '#2b5638', leafMid: '#4c8a44', leafLight: '#95c868',
    }),
    sun: { x: 1.36, y: 0.12, r: 0.04, glow: 0.3 },
    clouds: { kind: 'cumulus', n: 6, y0: 0.08, y1: 0.3, speed: 0.006, scale: 1 },
    town: 1, bridge: 'built', lamps: 'off', ferry: 'none',
    fig: { size: 1, leaves: 'summer', fruit: true },
    bench: true,
    figures: ['kidsBridge', 'rower', 'train'], birds: 'swallows', wind: 0.4, duration: 85, moments: { train: 26, kids: 58 }, trainArrives: true,
  },
};
