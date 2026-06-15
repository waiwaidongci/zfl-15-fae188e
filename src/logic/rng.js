export function mulberry32Step(a) {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value: result, nextState: a };
}

export function seedForLevel(index) {
  return (1779033703 ^ Math.imul(index, 2654435761)) >>> 0;
}

export function hashString(str) {
  let hash = 1779033703;
  for (let i = 0; i < str.length; i += 1) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}
