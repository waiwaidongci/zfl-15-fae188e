const { Game, assert } = require('./setup');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  results.total += 1;
  try {
    Game.levelIndex = 0;
    Game.state = null;
    Game.history = [];
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
  Game.levelIndex = levelIndex;
  Game.state = Game.parseLevel(Game.currentLevel());
  Game.history = [];
  return Game.state;
}

function growAt(x, y) {
  const cell = Game.cellAt(x, y);
  return Game.grow(cell);
}

function simulateAt(x, y) {
  const cell = Game.cellAt(x, y);
  return Game.simulateGrow(cell);
}

function canGrowAt(x, y) {
  const cell = Game.cellAt(x, y);
  return Game.canGrow(cell);
}

function checkWin() {
  const level = Game.currentLevel();
  const winCondition = level.winCondition;
  const treeDone = Game.state.cells.filter((c) => c.tree && c.mycelium).length;
  const leavesDone = Game.state.cells.filter((c) => c.leaf && c.decomposed).length;
  return treeDone >= winCondition.requiredTrees && leavesDone >= winCondition.requiredLeaves;
}

suite('关卡解析', () => {
  test('解析关卡后初始化回合为1', () => {
    loadLevel(0);
    assert.strictEqual(Game.state.turn, 1);
  });

  test('解析关卡后初始养分正确', () => {
    loadLevel(0);
    assert.strictEqual(Game.state.nutrients, 34);
    loadLevel(1);
    assert.strictEqual(Game.state.nutrients, 38);
  });

  test('起始位置有菌丝', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    const startCell = Game.cellAt(start[0], start[1]);
    assert.ok(startCell.mycelium);
  });

  test('正确解析土壤类型', () => {
    loadLevel(0);
    const wetCell = Game.cellAt(6, 1);
    assert.strictEqual(wetCell.soil, 'wet');
    const dryCell = Game.cellAt(3, 1);
    assert.strictEqual(dryCell.soil, 'dry');
    const loamCell = Game.cellAt(0, 0);
    assert.strictEqual(loamCell.soil, 'loam');
  });

  test('正确解析树根标记', () => {
    loadLevel(0);
    const treeCell = Game.cellAt(8, 3);
    assert.ok(treeCell.tree);
  });

  test('正确解析落叶标记', () => {
    loadLevel(0);
    const leafCell = Game.cellAt(4, 1);
    assert.ok(leafCell.leaf);
  });

  test('正确解析微生物标记', () => {
    loadLevel(0);
    const microbeCell = Game.cellAt(4, 3);
    assert.ok(microbeCell.microbe);
  });

  test('正确解析障碍标记', () => {
    loadLevel(0);
    const tiles = Game.currentLevel().tiles;
    let hasBlock = false;
    for (const row of tiles) {
      if (row.includes('b')) {
        hasBlock = true;
        break;
      }
    }
    if (hasBlock) {
      const blockCells = Game.state.cells.filter((c) => c.block);
      assert.ok(blockCells.length > 0);
    }
  });

  test('初始化时没有已分解落叶和已竞争微生物', () => {
    loadLevel(0);
    const decomposed = Game.state.cells.filter((c) => c.decomposed);
    const competed = Game.state.cells.filter((c) => c.competed);
    assert.strictEqual(decomposed.length, 0);
    assert.strictEqual(competed.length, 0);
  });
});

suite('可扩张判断', () => {
  test('起始格子不可扩张（已占领）', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    assert.strictEqual(canGrowAt(start[0], start[1]), false);
  });

  test('与菌丝相邻的格子可扩张', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    const neighbors = Game.neighbors(Game.cellAt(start[0], start[1]));
    const hasGrowable = neighbors.some((c) => !c.block && Game.canGrow(c));
    assert.ok(hasGrowable);
  });

  test('不与菌丝相邻的格子不可扩张', () => {
    loadLevel(0);
    assert.strictEqual(canGrowAt(0, 0), false);
  });

  test('模拟扩张返回正确原因：已占领', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    const result = simulateAt(start[0], start[1]);
    assert.strictEqual(result.canGrow, false);
    assert.strictEqual(result.reason, '已占领');
  });

  test('模拟扩张返回正确原因：未连接菌丝', () => {
    loadLevel(0);
    const result = simulateAt(0, 0);
    assert.strictEqual(result.canGrow, false);
    assert.strictEqual(result.reason, '未连接菌丝');
  });
});

suite('不同土壤消耗', () => {
  test('壤土消耗为3', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    const startCell = Game.cellAt(start[0], start[1]);
    const neighbors = Game.neighbors(startCell);
    const loamNeighbor = neighbors.find((c) => c.soil === 'loam' && !c.block);
    if (loamNeighbor) {
      const result = Game.simulateGrow(loamNeighbor);
      assert.strictEqual(result.cost, 3);
    }
  });

  test('湿土消耗为2', () => {
    loadLevel(0);
    const cell = Game.cellAt(6, 1);
    cell.mycelium = false;
    const neighbor = Game.cellAt(5, 1);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(cell);
    if (result.canGrow) {
      assert.strictEqual(result.cost, 2);
    }
  });

  test('干层消耗为6', () => {
    loadLevel(0);
    const cell = Game.cellAt(3, 1);
    cell.mycelium = false;
    const neighbor = Game.cellAt(3, 2);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(cell);
    if (result.canGrow) {
      assert.strictEqual(result.cost, 6);
    }
  });

  test('扩张壤土后养分减少3', () => {
    loadLevel(0);
    Game.state.nutrients = 20;
    const start = Game.currentLevel().start;
    const startCell = Game.cellAt(start[0], start[1]);
    const neighbors = Game.neighbors(startCell);
    const loamNeighbor = neighbors.find((c) => c.soil === 'loam' && !c.block && !c.microbe && !c.leaf && !c.tree);
    if (loamNeighbor) {
      Game.grow(loamNeighbor);
      assert.strictEqual(Game.state.nutrients, 17);
    }
  });
});

suite('落叶分解', () => {
  test('分解落叶获得8养分', () => {
    loadLevel(0);
    Game.state.nutrients = 20;
    const leafCell = Game.cellAt(4, 1);
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(leafCell);
    const leafEffect = result.effects.find((e) => e.type === 'leaf');
    assert.ok(leafEffect);
    assert.strictEqual(leafEffect.value, 8);
  });

  test('扩张到落叶格子后标记为已分解', () => {
    loadLevel(0);
    const leafCell = Game.cellAt(4, 1);
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    Game.grow(leafCell);
    assert.ok(leafCell.decomposed);
  });

  test('已分解的落叶不再提供养分', () => {
    loadLevel(0);
    const leafCell = Game.cellAt(4, 1);
    leafCell.decomposed = true;
    leafCell.mycelium = false;
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(leafCell);
    const leafEffect = result.effects.find((e) => e.type === 'leaf');
    assert.strictEqual(leafEffect, undefined);
  });
});

suite('树根连接', () => {
  test('连接湿土树根获得5养分回馈', () => {
    loadLevel(0);
    Game.state.nutrients = 20;
    const treeCell = Game.cellAt(8, 3);
    treeCell.soil = 'wet';
    const neighbor = Game.cellAt(7, 3);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(treeCell);
    const treeEffect = result.effects.find((e) => e.type === 'tree');
    assert.ok(treeEffect);
    assert.strictEqual(treeEffect.value, 5);
  });

  test('连接非湿土树根获得3养分回馈', () => {
    loadLevel(0);
    Game.state.nutrients = 20;
    const treeCell = Game.cellAt(8, 3);
    treeCell.soil = 'loam';
    const neighbor = Game.cellAt(7, 3);
    neighbor.mycelium = true;
    const result = Game.simulateGrow(treeCell);
    const treeEffect = result.effects.find((e) => e.type === 'tree');
    assert.ok(treeEffect);
    assert.strictEqual(treeEffect.value, 3);
  });

  test('回合推进时每处已连接树根回馈2养分', () => {
    loadLevel(0);
    Game.state.nutrients = 20;
    Game.state.cells.filter((c) => c.tree).slice(0, 2).forEach((c) => { c.mycelium = true; });
    const prevNutrients = Game.state.nutrients;
    Game.nextTurn();
    const expectedUpkeep = Math.max(1, Math.floor(2 / 8));
    const expectedDelta = 2 * 2 - expectedUpkeep;
    assert.strictEqual(Game.state.nutrients, prevNutrients + expectedDelta);
  });

  test('扩张到树根格子后标记为已占领', () => {
    loadLevel(0);
    const treeCell = Game.cellAt(8, 3);
    const neighbor = Game.cellAt(7, 3);
    neighbor.mycelium = true;
    Game.grow(treeCell);
    assert.ok(treeCell.mycelium);
  });
});

suite('微生物竞争', () => {
  test('微生物格子额外消耗3养分', () => {
    loadLevel(0);
    const microbeCell = Game.cellAt(4, 3);
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    const baseCost = Game.cost[microbeCell.soil];
    const result = Game.simulateGrow(microbeCell);
    assert.strictEqual(result.cost, baseCost + 3);
    const microbeEffect = result.effects.find((e) => e.type === 'microbe');
    assert.ok(microbeEffect);
    assert.strictEqual(microbeEffect.value, 3);
  });

  test('已竞争过的微生物格子不再额外消耗', () => {
    loadLevel(0);
    const microbeCell = Game.cellAt(4, 3);
    microbeCell.competed = true;
    microbeCell.mycelium = false;
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    const baseCost = Game.cost[microbeCell.soil];
    const result = Game.simulateGrow(microbeCell);
    assert.strictEqual(result.cost, baseCost);
  });

  test('扩张到微生物格子后标记为已竞争', () => {
    loadLevel(0);
    const microbeCell = Game.cellAt(4, 3);
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    Game.grow(microbeCell);
    assert.ok(microbeCell.competed);
  });

  test('确定性随机数生成：同一关卡种子相同', () => {
    const seed1 = Game.seedForLevel(0);
    const seed2 = Game.seedForLevel(0);
    assert.strictEqual(seed1, seed2);
  });

  test('确定性随机数生成：不同关卡种子不同', () => {
    const seed1 = Game.seedForLevel(0);
    const seed2 = Game.seedForLevel(1);
    assert.notStrictEqual(seed1, seed2);
  });

  test('Mulberry32 PRNG产生确定性序列', () => {
    const state1 = Game.mulberry32Step(42);
    const state2 = Game.mulberry32Step(42);
    assert.strictEqual(state1.value, state2.value);
    assert.strictEqual(state1.nextState, state2.nextState);
  });
});

suite('撤销功能', () => {
  test('扩张后撤销可恢复养分', () => {
    loadLevel(0);
    const initialNutrients = Game.state.nutrients;
    const start = Game.currentLevel().start;
    const startCell = Game.cellAt(start[0], start[1]);
    const neighbors = Game.neighbors(startCell);
    const target = neighbors.find((c) => !c.block && !c.microbe && !c.leaf && !c.tree);
    if (target) {
      Game.grow(target);
      assert.notStrictEqual(Game.state.nutrients, initialNutrients);
      Game.state = JSON.parse(Game.history.pop());
      assert.strictEqual(Game.state.nutrients, initialNutrients);
    }
  });

  test('扩张后撤销可恢复菌丝占领状态', () => {
    loadLevel(0);
    const start = Game.currentLevel().start;
    const startCell = Game.cellAt(start[0], start[1]);
    const neighbors = Game.neighbors(startCell);
    const target = neighbors.find((c) => !c.block);
    if (target) {
      Game.grow(target);
      const targetX = target.x;
      const targetY = target.y;
      Game.state = JSON.parse(Game.history.pop());
      const restoredCell = Game.cellAt(targetX, targetY);
      assert.strictEqual(restoredCell.mycelium, false);
    }
  });

  test('历史记录保存成功', () => {
    loadLevel(0);
    Game.saveHistory();
    assert.strictEqual(Game.history.length, 1);
  });

  test('历史记录超过40条时移除最旧记录', () => {
    loadLevel(0);
    for (let i = 0; i < 50; i++) {
      Game.saveHistory();
    }
    assert.strictEqual(Game.history.length, 40);
  });

  test('撤销恢复分解状态', () => {
    loadLevel(0);
    const leafCell = Game.cellAt(4, 1);
    const neighbor = Game.cellAt(4, 2);
    neighbor.mycelium = true;
    Game.grow(leafCell);
    assert.ok(leafCell.decomposed);
    Game.state = JSON.parse(Game.history.pop());
    const restoredLeaf = Game.cellAt(4, 1);
    assert.strictEqual(restoredLeaf.decomposed, false);
  });
});

suite('胜利条件', () => {
  test('关卡1需要3个树根和2片落叶', () => {
    loadLevel(0);
    const winCondition = Game.currentLevel().winCondition;
    assert.strictEqual(winCondition.requiredTrees, 3);
    assert.strictEqual(winCondition.requiredLeaves, 2);
  });

  test('关卡2需要4个树根和0片落叶', () => {
    loadLevel(1);
    const winCondition = Game.currentLevel().winCondition;
    assert.strictEqual(winCondition.requiredTrees, 4);
    assert.strictEqual(winCondition.requiredLeaves, 0);
  });

  test('未满足条件时不判定胜利', () => {
    loadLevel(0);
    assert.strictEqual(checkWin(), false);
  });

  test('连接足够树根和分解足够落叶后判定胜利', () => {
    loadLevel(0);
    const winCondition = Game.currentLevel().winCondition;
    Game.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees).forEach((c) => { c.mycelium = true; });
    Game.state.cells.filter((c) => c.leaf).slice(0, winCondition.requiredLeaves).forEach((c) => { c.decomposed = true; });
    assert.strictEqual(checkWin(), true);
  });

  test('关卡2仅需树根无需落叶', () => {
    loadLevel(1);
    const winCondition = Game.currentLevel().winCondition;
    Game.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees).forEach((c) => { c.mycelium = true; });
    assert.strictEqual(checkWin(), true);
  });

  test('树根数量不足时不胜利', () => {
    loadLevel(0);
    const winCondition = Game.currentLevel().winCondition;
    Game.state.cells.filter((c) => c.tree).slice(0, winCondition.requiredTrees - 1).forEach((c) => { c.mycelium = true; });
    Game.state.cells.filter((c) => c.leaf).slice(0, winCondition.requiredLeaves).forEach((c) => { c.decomposed = true; });
    assert.strictEqual(checkWin(), false);
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
