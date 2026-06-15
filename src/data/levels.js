export const levels = [
  {
    name: '松林边缘',
    goal: '连接3处树根，分解至少2片落叶。',
    nutrients: 34,
    start: [1, 8],
    winCondition: {
      requiredTrees: 3,
      requiredLeaves: 2,
    },
    tiles: [
      'llllllllll',
      'llldflwmll',
      'llwllldlll',
      'ldllmllltd',
      'lllddllwll',
      'llwlllllll',
      'lllfdlmlll',
      'lmllllldtl',
      'lslldlllll',
      'lllltllldl',
    ],
  },
  {
    name: '桦树湿沟',
    goal: '绕过干层连接4处树根。',
    nutrients: 38,
    start: [0, 5],
    winCondition: {
      requiredTrees: 4,
      requiredLeaves: 0,
    },
    tiles: [
      'lllddflltl',
      'lwwldlmlll',
      'lldddllwll',
      'lllmllldll',
      'dldlllwllt',
      'sllllmllll',
      'lwwfdddfll',
      'lllmdllltl',
      'llldllwlll',
      'tlllllldll',
    ],
  },
];

export const cost = { loam: 3, wet: 2, dry: 6 };

export const validEditorChars = ['l', 'w', 'd', 't', 'f', 'm', 'b', 's'];

export const validCharNames = {
  l: '壤土',
  w: '湿土',
  d: '干层',
  t: '树根',
  f: '落叶',
  m: '微生物',
  b: '障碍',
  s: '起点',
};

export const soilNames = { loam: '壤土', wet: '湿土', dry: '干层' };
