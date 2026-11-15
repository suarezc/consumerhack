const stops = [0, 0.35, 0.68, 0.82, 1];

const ramps = {
  skyTop: ['#c9cfe0', '#bfd9e6', '#e8c9a8', '#3a3566', '#0b1030'],
  skyBottom: ['#f3d9cf', '#eaf1ea', '#f2a37c', '#b5668a', '#1d2452'],
  hillFar: ['#a9b3c6', '#9fc0b8', '#c98f7f', '#5a4777', '#171c44'],
  hillMid: ['#7f93a0', '#6fa08e', '#9a6a66', '#3e3560', '#111538'],
  ground: ['#33503f', '#375f45', '#3d4034', '#1c1936', '#090c22'],
  bark: ['#3b2f33', '#3a2c28', '#33221f', '#15112a', '#04050d'],
  leaf: ['#7fa58a', '#6fa46f', '#8a9a55', '#2c4a5c', '#1c3646'],
  ink: ['#2a2740', '#26323a', '#3a2420', '#f3e6dc', '#f6efe6'],
};

function interpolate(colors: string[], time: number) {
  let index = 0;
  while (index < stops.length - 2 && time > stops[index + 1]) index++;
  const fraction = (time - stops[index]) / (stops[index + 1] - stops[index]);
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(colors[index].slice(offset, offset + 2), 16);
    const b = parseInt(colors[index + 1].slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * fraction);
  });
  return `rgb(${channels.join(',')})`;
}

function luminance(channels: number[]) {
  const linear = channels.map((value) => value / 255 <= 0.04045
    ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: number[], b: number[]) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function themeAt(timeOfDay: number) {
  const time = Number.isFinite(timeOfDay) ? Math.max(0, Math.min(1, timeOfDay)) : 0;
  const top = interpolate(ramps.skyTop, time).match(/\d+/g)!.map(Number);
  const bottom = interpolate(ramps.skyBottom, time).match(/\d+/g)!.map(Number);
  const hill = interpolate(ramps.hillFar, time).match(/\d+/g)!.map(Number);
  const backgrounds = [top, bottom, hill];
  const dark = [42, 39, 64];
  const paper = [246, 239, 230];
  const darkText = backgrounds.every((background) => contrast(dark, background) >= 4.6);
  let scrim = 0;
  if (!darkText) {
    while (scrim < 0.8 && backgrounds.some((background) => contrast(paper,
      background.map((value, channel) => value * (1 - scrim) + [9, 12, 34][channel] * scrim)) < 4.6)) scrim += 0.01;
  }
  return {
    timeOfDay: time,
    skyTop: interpolate(ramps.skyTop, time),
    skyBottom: interpolate(ramps.skyBottom, time),
    skyBands: Array.from({ length: 48 }, (_, index) => `rgb(${top.map((value, channel) =>
      Math.round(value + (bottom[channel] - value) * index / 47)).join(',')})`),
    hillFar: interpolate(ramps.hillFar, time),
    hillMid: interpolate(ramps.hillMid, time),
    ground: interpolate(ramps.ground, time),
    bark: interpolate(ramps.bark, time),
    leaf: interpolate(ramps.leaf, time),
    ink: interpolate(ramps.ink, time),
    text: darkText ? '#2a2740' : '#f6efe6',
    screenScrim: `rgba(9,12,34,${scrim.toFixed(2)})`,
    paper: '#f6efe6',
    petal: '#ffe9e0',
    lantern: '#ffd27a',
    panel: '#090c22',
    muted: '#c6c1c2',
    line: 'rgba(246,239,230,0.34)',
    wash: 'rgba(246,239,230,0.10)',
  };
}

export type StoryTimeTheme = ReturnType<typeof themeAt>;
