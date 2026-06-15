import { soilNames, cost } from '../data/levels.js';
import { canGrow, countLevelStats } from '../logic/state.js';
import { simulateGrow } from '../logic/actions.js';
import { tileClass, buildTileLabel } from './tile.js';

export function cacheDom() {
  return {
    mapEl: document.querySelector('#map'),
    logEl: document.querySelector('#log'),
    levelSelectEl: document.querySelector('#levelSelect'),
    srAnnounceEl: document.querySelector('#srAnnounce'),
    srLogEl: document.querySelector('#srLog'),
    nutrientEl: document.querySelector('#nutrients'),
    turnEl: document.querySelector('#turn'),
    treesEl: document.querySelector('#trees'),
    leavesEl: document.querySelector('#leaves'),
    lengthEl: document.querySelector('#length'),
    levelGoalEl: document.querySelector('#levelGoal'),
    hintEl: document.querySelector('.tile-hint'),
    detailsEl: document.querySelector('#tileDetails'),
    tileCoordEl: document.querySelector('#tileCoord'),
    tileSoilEl: document.querySelector('#tileSoil'),
    tileCostEl: document.querySelector('#tileCost'),
    tileTreeEl: document.querySelector('#tileTree'),
    tileLeafEl: document.querySelector('#tileLeaf'),
    tileMicrobeEl: document.querySelector('#tileMicrobe'),
    tileCanGrowEl: document.querySelector('#tileCanGrow'),
    previewEl: document.querySelector('#growPreview'),
    previewEffectsEl: document.querySelector('#previewEffects'),
    previewWarningsEl: document.querySelector('#previewWarnings'),
    deltaEl: document.querySelector('#previewDelta'),
    afterEl: document.querySelector('#previewAfter'),
    guideListEl: document.querySelector('#guideList'),
    guideEl: document.querySelector('#guide'),
    editorEl: document.querySelector('#editor'),
    editorNameEl: document.querySelector('#editorName'),
    editorGoalEl: document.querySelector('#editorGoal'),
    editorNutrientsEl: document.querySelector('#editorNutrients'),
    editorStartXEl: document.querySelector('#editorStartX'),
    editorStartYEl: document.querySelector('#editorStartY'),
    editorTreesEl: document.querySelector('#editorTrees'),
    editorLeavesEl: document.querySelector('#editorLeaves'),
    editorMapEl: document.querySelector('#editorMap'),
    editorValidationEl: document.querySelector('#editorValidation'),
    editorPreviewEl: document.querySelector('#editorPreview'),
    editorApplyEl: document.querySelector('#editorApply'),
    editorPreviewMapEl: document.querySelector('#editorPreviewMap'),
    editorPreviewStatsEl: document.querySelector('#editorPreviewStats'),
    editorImportEl: document.querySelector('#editorImport'),
  };
}

export function renderLevelOptions(dom, levels, levelIndex, isCustomLevel, customLevel) {
  dom.levelSelectEl.innerHTML = '';
  levels.forEach((level, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = level.name;
    dom.levelSelectEl.appendChild(option);
  });
  if (customLevel) {
    const option = document.createElement('option');
    option.value = levels.length;
    option.textContent = '★ ' + (customLevel.name || '自定义关卡');
    dom.levelSelectEl.appendChild(option);
  }
  dom.levelSelectEl.value = isCustomLevel && customLevel ? levels.length : levelIndex;
}

export function ensureMapDom(dom, state, onTileInteract) {
  if (dom._tileButtons) return;
  dom._tileButtons = [];
  dom.mapEl.innerHTML = '';

  for (let y = 0; y < 10; y += 1) {
    const row = [];
    for (let x = 0; x < 10; x += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.x = x;
      button.dataset.y = y;
      button.className = 'cell';

      button.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (e.key === 'ArrowUp') onTileInteract.moveFocus(0, -1);
        else if (e.key === 'ArrowDown') onTileInteract.moveFocus(0, 1);
        else if (e.key === 'ArrowLeft') onTileInteract.moveFocus(-1, 0);
        else if (e.key === 'ArrowRight') onTileInteract.moveFocus(1, 0);
        else if (e.key === 'Enter' || e.key === ' ') onTileInteract.activateFocused();
      });

      button.addEventListener('mouseenter', () => {
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        onTileInteract.hover(bx, by);
      });

      button.addEventListener('mouseleave', () => {
        onTileInteract.hoverEnd();
      });

      button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        onTileInteract.touch(bx, by);
      }, { passive: false });

      button.addEventListener('focus', () => {
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        onTileInteract.focus(bx, by);
      });

      button.addEventListener('blur', () => {
        setTimeout(() => {
          const stillInMap = document.activeElement &&
            document.activeElement.closest &&
            document.activeElement.closest('#map') !== null;
          if (stillInMap) return;
          onTileInteract.focusEnd();
        }, 0);
      });

      button.addEventListener('click', () => {
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        onTileInteract.click(bx, by);
      });

      dom.mapEl.appendChild(button);
      row.push(button);
    }
    dom._tileButtons.push(row);
  }
}

export function updateTileDom(dom, cell, state, uiState) {
  if (!dom._tileButtons || !dom._tileButtons[cell.y]) return;
  const button = dom._tileButtons[cell.y][cell.x];
  if (!button) return;
  button.className = tileClass(
    cell,
    state,
    uiState.selectedCell,
    uiState.hoveredCell,
    uiState.focusedCell,
    uiState.previewCell,
    uiState.lastPreview
  );
  button.title = `${cell.soil} ${cell.x},${cell.y}`;
  button.setAttribute('aria-label', buildTileLabel(cell, state));
  if (cell.block) {
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.removeAttribute('aria-disabled');
  }
  if (cell.mycelium) {
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.removeAttribute('aria-pressed');
  }
}

export function announce(dom, text) {
  if (!dom.srAnnounceEl) return;
  dom.srAnnounceEl.textContent = '';
  setTimeout(() => { dom.srAnnounceEl.textContent = text; }, 30);
}

export function showTileInfo(dom, cell, state) {
  if (!cell) {
    dom.hintEl.hidden = false;
    dom.detailsEl.hidden = true;
    return;
  }

  dom.hintEl.hidden = true;
  dom.detailsEl.hidden = false;

  const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  const canGrowTo = canGrow(state, cell);

  dom.tileCoordEl.textContent = `(${cell.x}, ${cell.y})`;
  dom.tileSoilEl.textContent = soilNames[cell.soil];
  dom.tileCostEl.textContent = `${tileCost} 养分`;

  if (cell.tree) {
    dom.tileTreeEl.textContent = cell.mycelium ? '有（已连接）' : '有';
    dom.tileTreeEl.className = 'status-yes';
  } else {
    dom.tileTreeEl.textContent = '无';
    dom.tileTreeEl.className = 'status-no';
  }

  if (cell.leaf) {
    dom.tileLeafEl.textContent = cell.decomposed ? '有（已分解）' : '有';
    dom.tileLeafEl.className = 'status-yes';
  } else {
    dom.tileLeafEl.textContent = '无';
    dom.tileLeafEl.className = 'status-no';
  }

  if (cell.microbe) {
    dom.tileMicrobeEl.textContent = cell.competed ? '有（已竞争）' : '有';
    dom.tileMicrobeEl.className = 'status-yes';
  } else {
    dom.tileMicrobeEl.textContent = '无';
    dom.tileMicrobeEl.className = 'status-no';
  }

  if (cell.mycelium) {
    dom.tileCanGrowEl.textContent = '已占领';
    dom.tileCanGrowEl.className = 'status-yes';
  } else if (cell.block) {
    dom.tileCanGrowEl.textContent = '不可通行';
    dom.tileCanGrowEl.className = 'status-cannot';
  } else if (canGrowTo) {
    dom.tileCanGrowEl.textContent = state.nutrients >= tileCost ? '可以扩张' : '养分不足';
    dom.tileCanGrowEl.className = state.nutrients >= tileCost ? 'status-can' : 'status-cannot';
  } else {
    dom.tileCanGrowEl.textContent = '未连接菌丝';
    dom.tileCanGrowEl.className = 'status-cannot';
  }
}

export function showGrowPreview(dom, cell, state) {
  if (!cell) {
    dom.previewEl.hidden = true;
    return null;
  }

  const result = simulateGrow(state, cell);

  dom.previewEl.hidden = false;

  dom.previewEffectsEl.innerHTML = '';
  dom.previewWarningsEl.innerHTML = '';

  if (result.canGrow) {
    const hasEnoughNutrients = state.nutrients >= result.cost;
    const baseSoilCost = cost[cell.soil];
    const hasMicrobeCost = cell.microbe && !cell.competed;

    dom.deltaEl.textContent = (result.nutrientDelta >= 0 ? '+' : '') + result.nutrientDelta;
    dom.deltaEl.className = result.nutrientDelta >= 0 ? 'delta-positive' : 'delta-negative';

    const afterValue = state.nutrients + result.nutrientDelta;
    dom.afterEl.textContent = afterValue;
    dom.afterEl.className = afterValue >= 0 ? (hasEnoughNutrients ? 'after-ok' : 'after-low') : 'after-negative';

    const costLi = document.createElement('li');
    costLi.className = 'effect-cost';
    costLi.innerHTML = `<span class="effect-label">土壤消耗${hasMicrobeCost ? '（基础）' : ''}</span><span class="effect-value">-${baseSoilCost}</span>`;
    dom.previewEffectsEl.appendChild(costLi);

    result.effects.forEach((effect) => {
      const li = document.createElement('li');
      li.className = `effect-${effect.type}`;
      const sign = effect.type === 'microbe' ? '-' : '+';
      li.innerHTML = `<span class="effect-label">${effect.label}</span><span class="effect-value">${sign}${effect.value}</span>`;
      dom.previewEffectsEl.appendChild(li);
    });

    const summary = document.createElement('li');
    summary.className = `effect-summary ${result.nutrientDelta >= 0 ? 'summary-positive' : 'summary-negative'}`;
    summary.innerHTML = `<span class="effect-label">净变化</span><span class="effect-value">${result.nutrientDelta >= 0 ? '+' : ''}${result.nutrientDelta}</span>`;
    dom.previewEffectsEl.appendChild(summary);

    if (!hasEnoughNutrients) {
      const warn = document.createElement('li');
      warn.className = 'warning-blocker';
      warn.textContent = `养分不足：需要 ${result.cost}，当前 ${state.nutrients}`;
      dom.previewWarningsEl.appendChild(warn);
    }
  } else {
    dom.deltaEl.textContent = '—';
    dom.deltaEl.className = 'delta-na';
    dom.afterEl.textContent = '—';
    dom.afterEl.className = 'after-na';

    const blocker = document.createElement('li');
    blocker.className = 'warning-blocker';
    blocker.textContent = `无法扩张：${result.reason}`;
    dom.previewWarningsEl.appendChild(blocker);
  }

  result.warnings.forEach((warning) => {
    const li = document.createElement('li');
    li.className = 'warning-item';
    li.textContent = warning;
    dom.previewWarningsEl.appendChild(li);
  });

  return result;
}

export function hideGrowPreview(dom) {
  dom.previewEl.hidden = true;
}

export function render(dom, state, level, uiState, levels, levelIndex, isCustomLevel, customLevel) {
  const winCondition = level.winCondition;
  dom.levelSelectEl.value = isCustomLevel && customLevel
    ? levels.length
    : levelIndex;
  dom.levelGoalEl.textContent = level.goal;

  if (uiState.previewCell && uiState.lastPreview && uiState.lastPreview.canGrow) {
    const previewVal = state.nutrients + uiState.lastPreview.nutrientDelta;
    const delta = uiState.lastPreview.nutrientDelta;
    dom.nutrientEl.innerHTML = `<span class="nutrient-base">${state.nutrients}</span> <span class="nutrient-preview-arrow">→</span> <span class="nutrient-preview ${delta >= 0 ? 'nutrient-up' : 'nutrient-down'}">${previewVal}</span> <span class="nutrient-delta ${delta >= 0 ? 'delta-up' : 'delta-down'}">(${delta >= 0 ? '+' : ''}${delta})</span>`;
  } else {
    dom.nutrientEl.textContent = state.nutrients;
    dom.nutrientEl.className = '';
  }
  dom.turnEl.textContent = state.turn;

  const treeDone = state.cells.filter((cell) => cell.tree && cell.mycelium).length;
  const leavesDone = state.cells.filter((cell) => cell.leaf && cell.decomposed).length;
  const length = state.cells.filter((cell) => cell.mycelium).length;
  dom.treesEl.textContent = `${treeDone}/${winCondition.requiredTrees}`;
  dom.leavesEl.textContent = `${leavesDone}/${winCondition.requiredLeaves}`;
  dom.lengthEl.textContent = length;

  state.cells.forEach((cell) => {
    updateTileDom(dom, cell, state, uiState);
  });

  dom.logEl.innerHTML = '';
  state.log.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    dom.logEl.appendChild(li);
  });

  const currentLogLen = state.log.length;
  const prevLogLength = state._lastLogLen || 0;
  if (currentLogLen > prevLogLength) {
    const newEntries = state.log.slice(0, currentLogLen - prevLogLength);
    if (dom.srLogEl) dom.srLogEl.textContent = newEntries.join('；');
  }
}

export function renderGuide(dom, levels, levelIndex, isCustomLevel, customLevel, onSelect) {
  dom.guideListEl.innerHTML = '';
  levels.forEach((level, index) => {
    const stats = countLevelStats(level);
    const item = document.createElement('div');
    item.className = 'guide-item' +
      (!isCustomLevel && index === levelIndex ? ' active' : '');
    item.innerHTML = `
      <h3>${level.name}</h3>
      <p class="guide-goal">${level.goal}</p>
      <dl>
        <div><dt>初始养分</dt><dd>${level.nutrients}</dd></div>
        <div><dt>树根数量</dt><dd>${stats.trees}</dd></div>
        <div><dt>落叶数量</dt><dd>${stats.leaves}</dd></div>
        <div><dt>微生物数量</dt><dd>${stats.microbes}</dd></div>
      </dl>
    `;
    item.addEventListener('click', () => onSelect(index, false));
    dom.guideListEl.appendChild(item);
  });
  if (isCustomLevel && customLevel) {
    const level = customLevel;
    const stats = countLevelStats(level);
    const item = document.createElement('div');
    item.className = 'guide-item active';
    item.innerHTML = `
      <h3>★ ${level.name}</h3>
      <p class="guide-goal">${level.goal}</p>
      <dl>
        <div><dt>初始养分</dt><dd>${level.nutrients}</dd></div>
        <div><dt>树根数量</dt><dd>${stats.trees}</dd></div>
        <div><dt>落叶数量</dt><dd>${stats.leaves}</dd></div>
        <div><dt>微生物数量</dt><dd>${stats.microbes}</dd></div>
      </dl>
    `;
    dom.guideListEl.appendChild(item);
  }
}

export function toggleGuide(dom) {
  dom.guideEl.hidden = !dom.guideEl.hidden;
  return !dom.guideEl.hidden;
}

export function toggleEditor(dom) {
  const guideHidden = dom.guideEl.hidden;
  if (dom.editorEl.hidden) {
    dom.editorEl.hidden = false;
    dom.guideEl.hidden = true;
  } else {
    dom.editorEl.hidden = true;
  }
  return { editorOpen: !dom.editorEl.hidden, guideWasOpen: !guideHidden };
}

export function editorLoadFromCurrent(dom, level, isCustomLevel) {
  dom.editorNameEl.value = isCustomLevel ? level.name : '';
  dom.editorGoalEl.value = isCustomLevel ? level.goal : '';
  dom.editorNutrientsEl.value = level.nutrients;
  dom.editorStartXEl.value = level.start[0];
  dom.editorStartYEl.value = level.start[1];
  dom.editorTreesEl.value = level.winCondition.requiredTrees;
  dom.editorLeavesEl.value = level.winCondition.requiredLeaves;
  const tiles = level.tiles.slice(0, 10);
  while (tiles.length < 10) tiles.push('llllllllll');
  dom.editorMapEl.value = tiles.join('\n');
  dom.editorValidationEl.hidden = true;
  dom.editorPreviewEl.hidden = true;
  dom.editorApplyEl.disabled = true;
}

export function editorCollectFormData(dom) {
  const parseBoundedNumber = function(selector, fallback, min, max) {
    const value = parseInt(dom[selector].value, 10);
    if (Number.isNaN(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  };
  const parseStartCoord = function(selector) {
    const raw = dom[selector].value.trim();
    if (raw === '') return null;
    const value = parseInt(raw, 10);
    if (Number.isNaN(value)) return null;
    return value;
  };
  return {
    name: dom.editorNameEl.value.trim(),
    goal: dom.editorGoalEl.value.trim(),
    nutrients: parseBoundedNumber('editorNutrientsEl', 30, 1, 200),
    start: [
      parseStartCoord('editorStartXEl'),
      parseStartCoord('editorStartYEl'),
    ],
    winCondition: {
      requiredTrees: parseBoundedNumber('editorTreesEl', 0, 0, 20),
      requiredLeaves: parseBoundedNumber('editorLeavesEl', 0, 0, 20),
    },
  };
}

export function editorFillExample(dom) {
  const example = [
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
  ];
  dom.editorMapEl.value = example.join('\n');
  dom.editorNameEl.value = '自定义示例';
  dom.editorGoalEl.value = '连接3处树根，分解至少2片落叶';
  dom.editorNutrientsEl.value = 34;
  dom.editorStartXEl.value = 1;
  dom.editorStartYEl.value = 8;
  dom.editorTreesEl.value = 3;
  dom.editorLeavesEl.value = 2;
}

export function editorClearMap(dom) {
  const empty = [];
  for (let i = 0; i < 10; i += 1) empty.push('llllllllll');
  dom.editorMapEl.value = empty.join('\n');
  dom.editorValidationEl.hidden = true;
  dom.editorPreviewEl.hidden = true;
  dom.editorApplyEl.disabled = true;
}

export function editorRenderValidation(dom, result) {
  dom.editorValidationEl.hidden = false;
  dom.editorValidationEl.className = 'editor-validation ' +
    (result.valid ? 'validation-success' : 'validation-error');

  let html = '';
  html += `<h4>${result.valid ? '✓ 校验通过' : '✕ 校验失败'}</h4>`;
  html += '<ul>';

  const criticalErrors = result.errors.filter((e) => e.critical);
  criticalErrors.forEach((e) => {
    html += `<li class="error-critical">错误：${e.msg}</li>`;
  });
  result.errors.filter((e) => !e.critical).forEach((e) => {
    html += `<li>错误：${e.msg}</li>`;
  });
  result.warnings.forEach((w) => {
    html += `<li>警告：${w.msg}</li>`;
  });
  result.infos.forEach((i) => {
    html += `<li>信息：${i.msg}</li>`;
  });

  html += '</ul>';
  dom.editorValidationEl.innerHTML = html;
}

export function editorRenderPreview(dom, lines, start, stats) {
  dom.editorPreviewEl.hidden = false;
  dom.editorPreviewMapEl.innerHTML = '';

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const ch = lines[y]?.[x] || 'l';
      const cell = document.createElement('div');
      cell.className = 'editor-preview-cell';

      let soil = 'loam';
      if (ch === 'w') soil = 'wet';
      else if (ch === 'd') soil = 'dry';
      else if (ch === 'b') soil = 'block';
      cell.classList.add(soil);

      const validChars = ['l', 'w', 'd', 't', 'f', 'm', 'b', 's'];
      if (!validChars.includes(ch)) {
        cell.style.background = '#a23535';
        cell.title = `非法字符: ${ch}`;
      }
      if (ch === 't') cell.classList.add('tree');
      if (ch === 'f') cell.classList.add('leaf');
      if (ch === 'm') cell.classList.add('microbe');
      if (start && x === start[0] && y === start[1] && ch !== 'b') {
        cell.classList.add('start');
      }
      if (ch === 's' && !(start && x === start[0] && y === start[1])) {
        cell.classList.add('start');
      }

      dom.editorPreviewMapEl.appendChild(cell);
    }
  }

  const soilCount = { loam: 0, wet: 0, dry: 0, block: 0 };
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const ch = lines[y]?.[x];
      if (ch === 'w') soilCount.wet += 1;
      else if (ch === 'd') soilCount.dry += 1;
      else if (ch === 'b') soilCount.block += 1;
      else soilCount.loam += 1;
    }
  }

  dom.editorPreviewStatsEl.innerHTML = `
    <div><dt>壤土</dt><dd>${soilCount.loam}</dd></div>
    <div><dt>湿土</dt><dd>${soilCount.wet}</dd></div>
    <div><dt>干层</dt><dd>${soilCount.dry}</dd></div>
    <div><dt>障碍</dt><dd>${soilCount.block}</dd></div>
    <div><dt>树根</dt><dd>${stats.trees}</dd></div>
    <div><dt>落叶</dt><dd>${stats.leaves}</dd></div>
    <div><dt>微生物</dt><dd>${stats.microbes}</dd></div>
    <div><dt>起点</dt><dd>(${start[0]},${start[1]})</dd></div>
  `;
}

export function setEditorApplyEnabled(dom, enabled, data) {
  dom.editorApplyEl.disabled = !enabled;
  if (enabled && data) {
    dom.editorApplyEl.dataset.level = JSON.stringify(data);
  } else {
    delete dom.editorApplyEl.dataset.level;
  }
}

export function getEditorApplyData(dom) {
  if (dom.editorApplyEl.disabled || !dom.editorApplyEl.dataset.level) return null;
  try {
    return JSON.parse(dom.editorApplyEl.dataset.level);
  } catch (_e) {
    return null;
  }
}

export function closeEditor(dom) {
  dom.editorEl.hidden = true;
}

export function exportJSON(level) {
  const exportData = {
    name: level.name || '自定义关卡',
    goal: level.goal || '完成自定义目标',
    nutrients: level.nutrients,
    start: level.start,
    winCondition: {
      requiredTrees: level.winCondition.requiredTrees,
      requiredLeaves: level.winCondition.requiredLeaves,
    },
    tiles: level.tiles.map((l) => {
      let out = '';
      for (let x = 0; x < 10; x += 1) {
        out += l[x] || 'l';
      }
      return out;
    }),
    _exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `level_${(exportData.name || 'custom').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getFocusedButton(dom, x, y) {
  if (!dom._tileButtons || !dom._tileButtons[y]) return null;
  return dom._tileButtons[y][x] || null;
}
