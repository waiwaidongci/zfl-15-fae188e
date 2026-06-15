import { cost } from '../data/levels.js';
import { canGrow, neighbors, saveHistory } from './state.js';
import { mulberry32Step } from './rng.js';

export function simulateGrow(state, cell) {
  const result = {
    canGrow: false,
    reason: '',
    cost: 0,
    nutrientDelta: 0,
    effects: [],
    warnings: [],
  };

  if (cell.block) {
    result.reason = '不可通行';
    result.warnings.push('此格子无法通行');
    return result;
  }

  if (cell.mycelium) {
    result.reason = '已占领';
    result.warnings.push('菌丝已占领此格');
    return result;
  }

  if (!neighbors(state, cell).some((item) => item.mycelium)) {
    result.reason = '未连接菌丝';
    result.warnings.push('需与已有菌丝相邻');
    return result;
  }

  result.canGrow = true;
  result.cost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  result.nutrientDelta = -result.cost;

  if (cell.leaf && !cell.decomposed) {
    result.effects.push({ type: 'leaf', label: '落叶分解', value: 8 });
    result.nutrientDelta += 8;
  } else if (cell.leaf && cell.decomposed) {
    result.warnings.push('落叶已分解，无法再次回收');
  }

  if (cell.tree) {
    const treeValue = cell.soil === 'wet' ? 5 : 3;
    result.effects.push({ type: 'tree', label: '树根回馈', value: treeValue });
    result.nutrientDelta += treeValue;
  }

  if (cell.microbe && !cell.competed) {
    result.effects.push({ type: 'microbe', label: '微生物额外消耗', value: 3 });
    result.warnings.push('微生物竞争将额外消耗3养分');
  } else if (cell.microbe && cell.competed) {
    result.warnings.push('微生物已竞争过');
  }

  if (state.nutrients < result.cost) {
    result.reason = '养分不足';
    result.warnings.push(`需要${result.cost}养分，当前仅${state.nutrients}`);
  }

  return result;
}

export function grow(state, history, cell) {
  if (!canGrow(state, cell)) return { state, history, success: false, message: '' };
  const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  if (state.nutrients < tileCost) {
    return { state, history, success: false, message: '养分不足，前沿停止扩张。' };
  }

  const newHistory = saveHistory(history, state);
  const newState = JSON.parse(JSON.stringify(state));
  const targetCell = newState.cells.find((c) => c.x === cell.x && c.y === cell.y);

  targetCell.mycelium = true;
  newState.nutrients -= tileCost;

  let message = '';
  if (targetCell.leaf && !targetCell.decomposed) {
    targetCell.decomposed = true;
    newState.nutrients += 8;
    message = '落叶被分解，养分回流。';
  } else if (targetCell.tree) {
    newState.nutrients += targetCell.soil === 'wet' ? 5 : 3;
    message = '树根被接入网络。';
  } else if (targetCell.microbe && !targetCell.competed) {
    targetCell.competed = true;
    message = '微生物竞争消耗额外养分。';
  } else {
    const soilName = targetCell.soil === 'dry' ? '干层' : targetCell.soil === 'wet' ? '湿土' : '壤土';
    message = `${soilName}中新生菌丝。`;
  }

  const delta = newState.nutrients - state.nutrients;
  const announce = `扩张成功，养分${delta >= 0 ? '增加' : '减少'}${Math.abs(delta)}，当前${newState.nutrients}`;

  return { state: newState, history: newHistory, success: true, message, announce };
}

export function nextTurn(state, history) {
  const newHistory = saveHistory(history, state);
  const newState = JSON.parse(JSON.stringify(state));

  newState.turn += 1;
  const prevNutrients = newState.nutrients;
  const myceliumCount = newState.cells.filter((cell) => cell.mycelium).length;
  const upkeep = Math.max(1, Math.floor(myceliumCount / 8));
  const treeLinks = newState.cells.filter((cell) => cell.mycelium && cell.tree).length;
  newState.nutrients += treeLinks * 2 - upkeep;

  let rngState = newState._rngState;
  newState.cells.forEach((cell) => {
    if (cell.microbe && !cell.mycelium) {
      const rngResult = mulberry32Step(rngState);
      rngState = rngResult.nextState;
      if (rngResult.value < 0.18) {
        const target = neighbors(newState, cell).find(
          (item) => !item.mycelium && !item.tree && !item.leaf
        );
        if (target) target.microbe = true;
      }
    }
  });
  newState._rngState = rngState;

  const message = `维持消耗${upkeep}点，树根回馈${treeLinks * 2}点。`;
  const delta = newState.nutrients - prevNutrients;
  const announce = `进入第${newState.turn}回合，养分${delta >= 0 ? '增加' : '减少'}${Math.abs(delta)}，当前${newState.nutrients}`;

  return { state: newState, history: newHistory, message, announce };
}

export function checkWin(state, winCondition) {
  const treeDone = state.cells.filter((c) => c.tree && c.mycelium).length;
  const leavesDone = state.cells.filter((c) => c.leaf && c.decomposed).length;
  return treeDone >= winCondition.requiredTrees && leavesDone >= winCondition.requiredLeaves;
}

export function addLog(state, text, maxLen = 6) {
  const newState = { ...state, log: [text, ...state.log].slice(0, maxLen) };
  return newState;
}

export function addLogOnce(state, text, maxLen = 6) {
  if (state.log.includes(text)) return state;
  return addLog(state, text, maxLen);
}
