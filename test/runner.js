import { levels, cost } from '../src/data/levels.js';
import { parseLevel, cellAt, neighbors, canGrow, saveHistory } from '../src/logic/state.js';
import { simulateGrow, grow, nextTurn, checkWin } from '../src/logic/actions.js';
import { mulberry32Step, seedForLevel } from '../src/logic/rng.js';
import assert from 'node:assert/strict';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  results.total += 1;
  try {
    fn();
    results.passed += 1;
    results.tests.push({ name, status: 'passed' });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    results.failed += 1;
    results.tests.push({ name, status: 'failed', error: err.message });
    process.stdout.write(`  ✗ ${name}\n`);
    process.stdout.write(`    ${err.message}\n`);
  }
}

function suite(name, fn) {
  process.stdout.write(`\n${name}\n`);
  fn();
}

function loadLevel(levelIndex) {
  const level = { ...levels[levelIndex], _index: levelIndex };
  const state = parseLevel(level, false);
  return { level, state, history: [] };
}

function simulateAt(ctx, x, y) {
  const cell = cellAt(ctx.state, x, y);
  return simulateGrow(ctx.state, cell);
}

function canGrowAt(ctx, x, y) {
  const cell = cellAt(ctx.state, x, y);
  return canGrow(ctx.state, cell);
}

suite('关卡解析', () => {
  test('解析关卡后初始化回合为1', () => {
    const { state } = loadLevel(0);
    assert.strictEqual(state.turn, 1);
  });

  test('解析关卡后初始养分正确', () => {
    let ctx = loadLevel(0);
    assert.strictEqual(ctx.state.nutrients, 34);
    ctx = loadLevel(1);
    assert.strictEqual(ctx.state.nutrients, 38);
  });

  test('起始位置有菌丝', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    assert.ok(startCell.mycelium);
  });

  test('正确解析土壤类型', () => {
    const ctx = loadLevel(0);
    const wetCell = cellAt(ctx.state, 6, 1);
    assert.strictEqual(wetCell.soil, 'wet');
    const dryCell = cellAt(ctx.state, 3, 1);
    assert.strictEqual(dryCell.soil, 'dry');
    const loamCell = cellAt(ctx.state, 0, 0);
    assert.strictEqual(loamCell.soil, 'loam');
  });

  test('正确解析树根标记', () => {
    const ctx = loadLevel(0);
    const treeCell = cellAt(ctx.state, 8, 3);
    assert.ok(treeCell.tree);
  });

  test('正确解析落叶标记', () => {
    const ctx = loadLevel(0);
    const leafCell = cellAt(ctx.state, 4, 1);
    assert.ok(leafCell.leaf);
  });

  test('正确解析微生物标记', () => {
    const ctx = loadLevel(0);
    const microbeCell = cellAt(ctx.state, 4, 3);
    assert.ok(microbeCell.microbe);
  });

  test('正确解析障碍标记', () => {
    const ctx = loadLevel(0);
    const tiles = ctx.level.tiles;
    let hasBlock = false;
    for (const row of tiles) {
      if (row.includes('b')) {
        hasBlock = true;
        break;
      }
    }
    if (hasBlock) {
      const blockCells = ctx.state.cells.filter((c) => c.block);
      assert.ok(blockCells.length > 0);
    }
  });

  test('初始化时没有已分解落叶和已竞争微生物', () => {
    const ctx = loadLevel(0);
    const decomposed = ctx.state.cells.filter((c) => c.decomposed);
    const competed = ctx.state.cells.filter((c) => c.competed);
    assert.strictEqual(decomposed.length, 0);
    assert.strictEqual(competed.length, 0);
  });
});

suite('可扩张判断', () => {
  test('起始格子不可扩张（已占领）', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    assert.strictEqual(canGrowAt(ctx, start[0], start[1]), false);
  });

  test('与菌丝相邻的格子可扩张', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    const neighborCells = neighbors(ctx.state, startCell);
    const hasGrowable = neighborCells.some((c) => !c.block && canGrow(ctx.state, c));
    assert.ok(hasGrowable);
  });

  test('不与菌丝相邻的格子不可扩张', () => {
    const ctx = loadLevel(0);
    assert.strictEqual(canGrowAt(ctx, 0, 0), false);
  });

  test('模拟扩张返回正确原因：已占领', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    const result = simulateAt(ctx, start[0], start[1]);
    assert.strictEqual(result.canGrow, false);
    assert.strictEqual(result.reason, '已占领');
  });

  test('模拟扩张返回正确原因：未连接菌丝', () => {
    const ctx = loadLevel(0);
    const result = simulateAt(ctx, 0, 0);
    assert.strictEqual(result.canGrow, false);
    assert.strictEqual(result.reason, '未连接菌丝');
  });
});

suite('不同土壤消耗', () => {
  test('壤土消耗为3', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    const neighborCells = neighbors(ctx.state, startCell);
    const loamNeighbor = neighborCells.find((c) => c.soil === 'loam' && !c.block);
    if (loamNeighbor) {
      const result = simulateGrow(ctx.state, loamNeighbor);
      assert.strictEqual(result.cost, 3);
    }
  });

  test('湿土消耗为2', () => {
    const ctx = loadLevel(0);
    const cell = cellAt(ctx.state, 6, 1);
    cell.mycelium = false;
    const neighbor = cellAt(ctx.state, 5, 1);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, cell);
    if (result.canGrow) {
      assert.strictEqual(result.cost, 2);
    }
  });

  test('干层消耗为6', () => {
    const ctx = loadLevel(0);
    const cell = cellAt(ctx.state, 3, 1);
    cell.mycelium = false;
    const neighbor = cellAt(ctx.state, 3, 2);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, cell);
    if (result.canGrow) {
      assert.strictEqual(result.cost, 6);
    }
  });

  test('扩张壤土后养分减少3', () => {
    const ctx = loadLevel(0);
    ctx.state.nutrients = 20;
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    const neighborCells = neighbors(ctx.state, startCell);
    const loamNeighbor = neighborCells.find(
      (c) => c.soil === 'loam' && !c.block && !c.microbe && !c.leaf && !c.tree
    );
    if (loamNeighbor) {
      const result = grow(ctx.state, ctx.history, loamNeighbor);
      ctx.state = result.state;
      ctx.history = result.history;
      assert.strictEqual(ctx.state.nutrients, 17);
    }
  });
});

suite('落叶分解', () => {
  test('分解落叶获得8养分', () => {
    const ctx = loadLevel(0);
    ctx.state.nutrients = 20;
    const leafCell = cellAt(ctx.state, 4, 1);
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, leafCell);
    const leafEffect = result.effects.find((e) => e.type === 'leaf');
    assert.ok(leafEffect);
    assert.strictEqual(leafEffect.value, 8);
  });

  test('扩张到落叶格子后标记为已分解', () => {
    const ctx = loadLevel(0);
    const leafCell = cellAt(ctx.state, 4, 1);
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const result = grow(ctx.state, ctx.history, leafCell);
    ctx.state = result.state;
    ctx.history = result.history;
    const updatedLeaf = cellAt(ctx.state, 4, 1);
    assert.ok(updatedLeaf.decomposed);
  });

  test('已分解的落叶不再提供养分', () => {
    const ctx = loadLevel(0);
    const leafCell = cellAt(ctx.state, 4, 1);
    leafCell.decomposed = true;
    leafCell.mycelium = false;
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, leafCell);
    const leafEffect = result.effects.find((e) => e.type === 'leaf');
    assert.strictEqual(leafEffect, undefined);
  });
});

suite('树根连接', () => {
  test('连接湿土树根获得5养分回馈', () => {
    const ctx = loadLevel(0);
    ctx.state.nutrients = 20;
    const treeCell = cellAt(ctx.state, 8, 3);
    treeCell.soil = 'wet';
    const neighbor = cellAt(ctx.state, 7, 3);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, treeCell);
    const treeEffect = result.effects.find((e) => e.type === 'tree');
    assert.ok(treeEffect);
    assert.strictEqual(treeEffect.value, 5);
  });

  test('连接非湿土树根获得3养分回馈', () => {
    const ctx = loadLevel(0);
    ctx.state.nutrients = 20;
    const treeCell = cellAt(ctx.state, 8, 3);
    treeCell.soil = 'loam';
    const neighbor = cellAt(ctx.state, 7, 3);
    neighbor.mycelium = true;
    const result = simulateGrow(ctx.state, treeCell);
    const treeEffect = result.effects.find((e) => e.type === 'tree');
    assert.ok(treeEffect);
    assert.strictEqual(treeEffect.value, 3);
  });

  test('回合推进时每处已连接树根回馈2养分', () => {
    const ctx = loadLevel(0);
    ctx.state.nutrients = 20;
    ctx.state.cells.filter((c) => c.tree).slice(0, 2).forEach((c) => { c.mycelium = true; });
    const prevNutrients = ctx.state.nutrients;
    const result = nextTurn(ctx.state, ctx.history);
    ctx.state = result.state;
    ctx.history = result.history;
    const myceliumCount = 2;
    const expectedUpkeep = Math.max(1, Math.floor(myceliumCount / 8));
    const expectedDelta = 2 * 2 - expectedUpkeep;
    assert.strictEqual(ctx.state.nutrients, prevNutrients + expectedDelta);
  });

  test('扩张到树根格子后标记为已占领', () => {
    const ctx = loadLevel(0);
    const treeCell = cellAt(ctx.state, 8, 3);
    const neighbor = cellAt(ctx.state, 7, 3);
    neighbor.mycelium = true;
    const result = grow(ctx.state, ctx.history, treeCell);
    ctx.state = result.state;
    ctx.history = result.history;
    const updatedTree = cellAt(ctx.state, 8, 3);
    assert.ok(updatedTree.mycelium);
  });
});

suite('微生物竞争', () => {
  test('微生物格子额外消耗3养分', () => {
    const ctx = loadLevel(0);
    const microbeCell = cellAt(ctx.state, 4, 3);
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const baseCost = cost[microbeCell.soil];
    const result = simulateGrow(ctx.state, microbeCell);
    assert.strictEqual(result.cost, baseCost + 3);
    const microbeEffect = result.effects.find((e) => e.type === 'microbe');
    assert.ok(microbeEffect);
    assert.strictEqual(microbeEffect.value, 3);
  });

  test('已竞争过的微生物格子不再额外消耗', () => {
    const ctx = loadLevel(0);
    const microbeCell = cellAt(ctx.state, 4, 3);
    microbeCell.competed = true;
    microbeCell.mycelium = false;
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const baseCost = cost[microbeCell.soil];
    const result = simulateGrow(ctx.state, microbeCell);
    assert.strictEqual(result.cost, baseCost);
  });

  test('扩张到微生物格子后标记为已竞争', () => {
    const ctx = loadLevel(0);
    const microbeCell = cellAt(ctx.state, 4, 3);
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const result = grow(ctx.state, ctx.history, microbeCell);
    ctx.state = result.state;
    ctx.history = result.history;
    const updatedMicrobe = cellAt(ctx.state, 4, 3);
    assert.ok(updatedMicrobe.competed);
  });

  test('确定性随机数生成：同一关卡种子相同', () => {
    const seed1 = seedForLevel(0);
    const seed2 = seedForLevel(0);
    assert.strictEqual(seed1, seed2);
  });

  test('确定性随机数生成：不同关卡种子不同', () => {
    const seed1 = seedForLevel(0);
    const seed2 = seedForLevel(1);
    assert.notStrictEqual(seed1, seed2);
  });

  test('Mulberry32 PRNG产生确定性序列', () => {
    const state1 = mulberry32Step(42);
    const state2 = mulberry32Step(42);
    assert.strictEqual(state1.value, state2.value);
    assert.strictEqual(state1.nextState, state2.nextState);
  });
});

suite('撤销功能', () => {
  test('扩张后撤销可恢复养分', () => {
    const ctx = loadLevel(0);
    const initialNutrients = ctx.state.nutrients;
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    const neighborCells = neighbors(ctx.state, startCell);
    const target = neighborCells.find((c) => !c.block && !c.microbe && !c.leaf && !c.tree);
    if (target) {
      const result = grow(ctx.state, ctx.history, target);
      ctx.state = result.state;
      ctx.history = result.history;
      assert.notStrictEqual(ctx.state.nutrients, initialNutrients);
      ctx.state = JSON.parse(ctx.history.pop());
      assert.strictEqual(ctx.state.nutrients, initialNutrients);
    }
  });

  test('扩张后撤销可恢复菌丝占领状态', () => {
    const ctx = loadLevel(0);
    const start = ctx.level.start;
    const startCell = cellAt(ctx.state, start[0], start[1]);
    const neighborCells = neighbors(ctx.state, startCell);
    const target = neighborCells.find((c) => !c.block);
    if (target) {
      const targetX = target.x;
      const targetY = target.y;
      const result = grow(ctx.state, ctx.history, target);
      ctx.state = result.state;
      ctx.history = result.history;
      ctx.state = JSON.parse(ctx.history.pop());
      const restoredCell = cellAt(ctx.state, targetX, targetY);
      assert.strictEqual(restoredCell.mycelium, false);
    }
  });

  test('历史记录保存成功', () => {
    const ctx = loadLevel(0);
    ctx.history = saveHistory(ctx.history, ctx.state);
    assert.strictEqual(ctx.history.length, 1);
  });

  test('历史记录超过40条时移除最旧记录', () => {
    const ctx = loadLevel(0);
    for (let i = 0; i < 50; i++) {
      ctx.history = saveHistory(ctx.history, ctx.state);
    }
    assert.strictEqual(ctx.history.length, 40);
  });

  test('撤销恢复分解状态', () => {
    const ctx = loadLevel(0);
    const leafCell = cellAt(ctx.state, 4, 1);
    const neighbor = cellAt(ctx.state, 4, 2);
    neighbor.mycelium = true;
    const result = grow(ctx.state, ctx.history, leafCell);
    ctx.state = result.state;
    ctx.history = result.history;
    const grownLeaf = cellAt(ctx.state, 4, 1);
    assert.ok(grownLeaf.decomposed);
    ctx.state = JSON.parse(ctx.history.pop());
    const restoredLeaf = cellAt(ctx.state, 4, 1);
    assert.strictEqual(restoredLeaf.decomposed, false);
  });
});

suite('胜利条件', () => {
  test('关卡1需要3个树根和2片落叶', () => {
    const ctx = loadLevel(0);
    const winCondition = ctx.level.winCondition;
    assert.strictEqual(winCondition.requiredTrees, 3);
    assert.strictEqual(winCondition.requiredLeaves, 2);
  });

  test('关卡2需要4个树根和0片落叶', () => {
    const ctx = loadLevel(1);
    const winCondition = ctx.level.winCondition;
    assert.strictEqual(winCondition.requiredTrees, 4);
    assert.strictEqual(winCondition.requiredLeaves, 0);
  });

  test('未满足条件时不判定胜利', () => {
    const ctx = loadLevel(0);
    assert.strictEqual(checkWin(ctx.state, ctx.level.winCondition), false);
  });

  test('连接足够树根和分解足够落叶后判定胜利', () => {
    const ctx = loadLevel(0);
    const winCondition = ctx.level.winCondition;
    ctx.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees).forEach((c) => { c.mycelium = true; });
    ctx.state.cells.filter((c) => c.leaf).slice(0, winCondition.requiredLeaves).forEach((c) => { c.decomposed = true; });
    assert.strictEqual(checkWin(ctx.state, winCondition), true);
  });

  test('关卡2仅需树根无需落叶', () => {
    const ctx = loadLevel(1);
    const winCondition = ctx.level.winCondition;
    ctx.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees).forEach((c) => { c.mycelium = true; });
    assert.strictEqual(checkWin(ctx.state, winCondition), true);
  });

  test('树根数量不足时不胜利', () => {
    const ctx = loadLevel(0);
    const winCondition = ctx.level.winCondition;
    ctx.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees - 1).forEach((c) => { c.mycelium = true; });
    ctx.state.cells.filter((c) => c.leaf).slice(0, winCondition.requiredLeaves).forEach((c) => { c.decomposed = true; });
    assert.strictEqual(checkWin(ctx.state, winCondition), false);
  });
});

process.stdout.write(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
process.stdout.write(`测试完成：${results.passed}/${results.total} 通过`);
if (results.failed > 0) {
  process.stdout.write(`，${results.failed} 失败`);
}
process.stdout.write(`\n`);

if (results.failed > 0) {
  process.exit(1);
}
