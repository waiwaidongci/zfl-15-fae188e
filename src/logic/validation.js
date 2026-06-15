import { validEditorChars, validCharNames } from '../data/levels.js';

export function parseEditorMap(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < 10; i += 1) {
    lines.push((rawLines[i] || '').trim());
  }
  return lines;
}

export function checkReachability(lines, start) {
  const visited = Array.from({ length: 10 }, () => new Array(10).fill(false));
  const queue = [[start[0], start[1]]];
  const treePositions = [];
  const leafPositions = [];

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const ch = lines[y]?.[x];
      if (ch === 't') treePositions.push([x, y]);
      if (ch === 'f') leafPositions.push([x, y]);
    }
  }

  visited[start[1]][start[0]] = true;
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (let d = 0; d < 4; d += 1) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
      if (visited[ny][nx]) continue;
      const ch = lines[ny]?.[nx];
      if (ch === 'b') continue;
      visited[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }

  const unreachableTrees = treePositions.filter(([x, y]) => !visited[y][x]);
  const unreachableLeaves = leafPositions.filter(([x, y]) => !visited[y][x]);

  return { unreachableTrees, unreachableLeaves, visited };
}

export function validateLevel(level, lines) {
  const errors = [];
  const warnings = [];
  const infos = [];
  let trees = 0;
  let leaves = 0;
  let microbes = 0;
  let blocks = 0;
  let startCount = 0;
  let startFromMap = null;
  const invalidChars = new Map();

  for (let y = 0; y < 10; y += 1) {
    const line = lines[y] || '';
    if (line.length !== 10) {
      errors.push({
        critical: true,
        msg: `第${y + 1}行长度错误：期望10字符，实际${line.length}字符`,
      });
      continue;
    }
    for (let x = 0; x < 10; x += 1) {
      const ch = line[x];
      if (!validEditorChars.includes(ch)) {
        if (!invalidChars.has(ch)) {
          invalidChars.set(ch, []);
        }
        invalidChars.get(ch).push(`(${x},${y})`);
      }
      if (ch === 't') trees += 1;
      else if (ch === 'f') leaves += 1;
      else if (ch === 'm') microbes += 1;
      else if (ch === 'b') blocks += 1;
      else if (ch === 's') {
        startCount += 1;
        startFromMap = [x, y];
      }
    }
  }

  for (const [ch, positions] of invalidChars.entries()) {
    const display = ch === ' ' ? '空格' : JSON.stringify(ch);
    errors.push({
      critical: true,
      msg: `非法字符 ${display} 出现在 ${positions.slice(0, 5).join('、')}${positions.length > 5 ? '等' + positions.length + '处' : ''}`,
    });
  }

  if (startCount > 1) {
    errors.push({
      critical: true,
      msg: `地图中存在${startCount}个起点标记's'，只能有0或1个`,
    });
  }

  const start = startFromMap || level.start;
  if (
    !start ||
    start.length !== 2 ||
    !Number.isInteger(start[0]) ||
    !Number.isInteger(start[1]) ||
    start[0] < 0 ||
    start[0] > 9 ||
    start[1] < 0 ||
    start[1] > 9
  ) {
    errors.push({
      critical: true,
      msg: '起点坐标无效：必须在0-9范围内',
    });
  } else {
    const startLine = lines[start[1]] || '';
    const startChar = startLine[start[0]];
    if (startChar === 'b') {
      errors.push({
        critical: true,
        msg: `起点 (${start[0]},${start[1]}) 落在障碍格'b'上`,
      });
    }
    if (startChar === 't' || startChar === 'f' || startChar === 'm') {
      warnings.push({
        msg: `起点 (${start[0]},${start[1]}) 与${validCharNames[startChar]}同格，相关元素将被起点覆盖`,
      });
    }
  }

  if (level.winCondition.requiredTrees > trees) {
    errors.push({
      critical: true,
      msg: `目标树根(${level.winCondition.requiredTrees})超过地图树根数量(${trees})`,
    });
  }
  if (level.winCondition.requiredLeaves > leaves) {
    errors.push({
      critical: true,
      msg: `目标落叶(${level.winCondition.requiredLeaves})超过地图落叶数量(${leaves})`,
    });
  }

  if (level.winCondition.requiredTrees === 0 && level.winCondition.requiredLeaves === 0) {
    warnings.push({
      msg: '目标树根和目标落叶均为0，开局即视为胜利',
    });
  }

  if (trees === 0 && level.winCondition.requiredTrees === 0) {
    infos.push({ msg: '地图中没有树根' });
  }
  if (leaves === 0 && level.winCondition.requiredLeaves === 0) {
    infos.push({ msg: '地图中没有落叶' });
  }

  if (errors.filter((e) => e.critical).length === 0 && start) {
    const reachResult = checkReachability(lines, start);
    const reachableTreesCount = trees - reachResult.unreachableTrees.length;
    const reachableLeavesCount = leaves - reachResult.unreachableLeaves.length;

    if (level.winCondition.requiredTrees > 0) {
      if (reachableTreesCount < level.winCondition.requiredTrees) {
        const count = reachResult.unreachableTrees.length;
        const samples = reachResult.unreachableTrees
          .slice(0, 3)
          .map((p) => `(${p[0]},${p[1]})`)
          .join('、');
        errors.push({
          critical: true,
          msg: `可达树根(${reachableTreesCount})少于目标树根(${level.winCondition.requiredTrees})，有${count}处树根不可达：${samples}${count > 3 ? '...' : ''}`,
        });
      } else if (reachResult.unreachableTrees.length > 0) {
        infos.push({
          msg: `地图中有${reachResult.unreachableTrees.length}处树根不可达，但数量足够完成目标`,
        });
      }
    }

    if (level.winCondition.requiredLeaves > 0) {
      if (reachableLeavesCount < level.winCondition.requiredLeaves) {
        const count = reachResult.unreachableLeaves.length;
        const samples = reachResult.unreachableLeaves
          .slice(0, 3)
          .map((p) => `(${p[0]},${p[1]})`)
          .join('、');
        errors.push({
          critical: true,
          msg: `可达落叶(${reachableLeavesCount})少于目标落叶(${level.winCondition.requiredLeaves})，有${count}片落叶不可达：${samples}${count > 3 ? '...' : ''}`,
        });
      } else if (reachResult.unreachableLeaves.length > 0) {
        infos.push({
          msg: `地图中有${reachResult.unreachableLeaves.length}片落叶不可达，但数量足够完成目标`,
        });
      }
    }
  }

  if (level.nutrients < 5) {
    warnings.push({
      msg: `初始养分(${level.nutrients})偏低，扩张可能受阻`,
    });
  }

  infos.push({
    msg: `地图统计：树根${trees}处 / 落叶${leaves}片 / 微生物${microbes}处 / 障碍${blocks}块`,
  });
  if (startFromMap) {
    infos.push({ msg: `已使用地图中的's'标记作为起点 (${startFromMap[0]},${startFromMap[1]})` });
  }

  const valid = errors.filter((e) => e.critical).length === 0;
  return {
    valid,
    errors,
    warnings,
    infos,
    stats: { trees, leaves, microbes, blocks },
    startFromMap,
    finalStart: startFromMap || level.start,
  };
}

export function buildLevelFromEditor(formData, lines) {
  const result = validateLevel(formData, lines);
  const finalLines = [];
  for (let y = 0; y < 10; y += 1) {
    let line = '';
    for (let x = 0; x < 10; x += 1) {
      let ch = lines[y]?.[x] || 'l';
      if (!validEditorChars.includes(ch)) ch = 'l';
      if (x === result.finalStart[0] && y === result.finalStart[1] && ch !== 'b') {
        if (ch === 's') ch = 'l';
      }
      if (ch === 's') ch = 'l';
      line += ch;
    }
    finalLines.push(line);
  }

  return {
    name: formData.name || '自定义关卡',
    goal: formData.goal || '完成自定义目标',
    nutrients: formData.nutrients,
    start: result.finalStart,
    winCondition: {
      requiredTrees: formData.winCondition.requiredTrees,
      requiredLeaves: formData.winCondition.requiredLeaves,
    },
    tiles: finalLines,
    _custom: true,
  };
}
