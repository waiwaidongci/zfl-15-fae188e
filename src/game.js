import { levels } from './data/levels.js';
import { parseLevel, cellAt, canGrow } from './logic/state.js';
import { grow, nextTurn, addLog, addLogOnce } from './logic/actions.js';
import { parseEditorMap, validateLevel, buildLevelFromEditor } from './logic/validation.js';
import * as render from './render/index.js';
import { buildTileLabel } from './render/tile.js';

export function createGame() {
  const state = {
    levelIndex: 0,
    levels: levels,
    customLevel: null,
    isCustomLevel: false,
    gameState: null,
    history: [],
    selectedCell: null,
    hoveredCell: null,
    focusedCell: null,
    previewCell: null,
    lastPreview: null,
    isRendering: false,
    dom: null,
  };

  function currentLevel() {
    if (state.isCustomLevel && state.customLevel) {
      return state.customLevel;
    }
    return state.levels[state.levelIndex];
  }

  function getUiState() {
    return {
      selectedCell: state.selectedCell,
      hoveredCell: state.hoveredCell,
      focusedCell: state.focusedCell,
      previewCell: state.previewCell,
      lastPreview: state.lastPreview,
    };
  }

  function doRender() {
    state.isRendering = true;
    render.render(
      state.dom,
      state.gameState,
      currentLevel(),
      getUiState(),
      state.levels,
      state.levelIndex,
      state.isCustomLevel,
      state.customLevel
    );

    if (state.hoveredCell) {
      const currentCell = cellAt(state.gameState, state.hoveredCell.x, state.hoveredCell.y);
      if (currentCell) {
        state.hoveredCell = currentCell;
        state.previewCell = currentCell;
        render.showTileInfo(state.dom, currentCell, state.gameState);
        state.lastPreview = render.showGrowPreview(state.dom, currentCell, state.gameState);
      }
    } else if (state.selectedCell) {
      const currentCell = cellAt(state.gameState, state.selectedCell.x, state.selectedCell.y);
      if (currentCell) {
        state.selectedCell = currentCell;
        render.showTileInfo(state.dom, currentCell, state.gameState);
      }
    } else {
      render.showTileInfo(state.dom, null, state.gameState);
      render.hideGrowPreview(state.dom);
    }

    const winCondition = currentLevel().winCondition;
    const treeDone = state.gameState.cells.filter((c) => c.tree && c.mycelium).length;
    const leavesDone = state.gameState.cells.filter((c) => c.leaf && c.decomposed).length;

    if (treeDone >= winCondition.requiredTrees && leavesDone >= winCondition.requiredLeaves) {
      const treeMet = winCondition.requiredTrees > 0 ? `已连接${treeDone}处树根` : '';
      const leafMet = winCondition.requiredLeaves > 0 ? `已分解${leavesDone}片落叶` : '';
      const parts = [treeMet, leafMet].filter(Boolean);
      state.gameState = addLogOnce(state.gameState, `网络稳定，森林进入共生状态。（${parts.join('，')}）`);
    }
    if (state.gameState.nutrients < 0) {
      state.gameState = addLogOnce(state.gameState, '养分透支，菌丝停止扩张。');
    }

    state.gameState._lastLogLen = state.gameState.log.length;
    state.isRendering = false;
  }

  function handleGrow(cell) {
    if (!canGrow(state.gameState, cell)) return false;
    const result = grow(state.gameState, state.history, cell);
    if (!result.success) {
      if (result.message) {
        state.gameState = addLog(state.gameState, result.message);
        render.announce(state.dom, '养分不足，无法扩张');
      }
      doRender();
      return false;
    }
    state.gameState = result.state;
    state.history = result.history;
    if (result.message) {
      state.gameState = addLog(state.gameState, result.message);
    }
    if (result.announce) {
      render.announce(state.dom, result.announce);
    }
    doRender();
    return true;
  }

  function handleNextTurn() {
    const result = nextTurn(state.gameState, state.history);
    state.gameState = result.state;
    state.history = result.history;
    state.gameState = addLog(state.gameState, result.message);
    render.announce(state.dom, result.announce);
    doRender();
  }

  function handleReset() {
    const level = currentLevel();
    level._index = state.levelIndex;
    state.gameState = parseLevel(level, state.isCustomLevel, state.customLevel?.name);
    state.history = [];
    state.selectedCell = null;
    state.hoveredCell = null;
    state.focusedCell = null;
    state.previewCell = null;
    state.lastPreview = null;
    render.hideGrowPreview(state.dom);
    render.announce(state.dom, `重置关卡：${currentLevel().name}`);
    doRender();
  }

  function handleUndo() {
    if (!state.history.length) return;
    state.gameState = JSON.parse(state.history.pop());
    if (state.selectedCell) {
      const currentCell = cellAt(state.gameState, state.selectedCell.x, state.selectedCell.y);
      if (currentCell) state.selectedCell = currentCell;
    }
    if (state.focusedCell) {
      const currentFocused = cellAt(state.gameState, state.focusedCell.x, state.focusedCell.y);
      if (currentFocused) state.focusedCell = currentFocused;
    }
    render.announce(state.dom, '撤销完成');
    doRender();
  }

  function handleSelectLevel(index, isCustom) {
    if (isCustom) {
      if (state.customLevel) {
        state.isCustomLevel = true;
        handleReset();
      }
    } else {
      state.levelIndex = index;
      state.isCustomLevel = false;
      handleReset();
    }
    render.renderLevelOptions(state.dom, state.levels, state.levelIndex, state.isCustomLevel, state.customLevel);
    if (!state.dom.guideEl.hidden) {
      render.renderGuide(state.dom, state.levels, state.levelIndex, state.isCustomLevel, state.customLevel, handleSelectLevel);
    }
  }

  function handleHover(x, y) {
    if (state.isRendering) return;
    const cell = cellAt(state.gameState, x, y);
    if (!cell) return;
    state.hoveredCell = cell;
    state.previewCell = cell;
    state.focusedCell = cell;
    render.showTileInfo(state.dom, cell, state.gameState);
    state.lastPreview = render.showGrowPreview(state.dom, cell, state.gameState);
    doRender();
  }

  function handleHoverEnd() {
    if (state.isRendering) return;
    state.hoveredCell = null;
    state.previewCell = null;
    render.hideGrowPreview(state.dom);
    render.showTileInfo(state.dom, state.selectedCell || state.focusedCell, state.gameState);
    doRender();
  }

  function handleTouch(x, y) {
    const cell = cellAt(state.gameState, x, y);
    if (!cell) return;
    if (state.previewCell && state.previewCell.x === cell.x && state.previewCell.y === cell.y) {
      state.selectedCell = cell;
      state.focusedCell = cell;
      render.hideGrowPreview(state.dom);
      state.previewCell = null;
      if (!handleGrow(cell)) doRender();
    } else {
      state.hoveredCell = cell;
      state.previewCell = cell;
      state.selectedCell = cell;
      state.focusedCell = cell;
      render.showTileInfo(state.dom, cell, state.gameState);
      state.lastPreview = render.showGrowPreview(state.dom, cell, state.gameState);
      doRender();
    }
  }

  function handleFocus(x, y) {
    if (state.isRendering) return;
    const cell = cellAt(state.gameState, x, y);
    if (!cell) return;
    if (state.focusedCell && state.focusedCell.x === x && state.focusedCell.y === y) return;
    state.focusedCell = cell;
    state.hoveredCell = cell;
    state.previewCell = cell;
    render.showTileInfo(state.dom, cell, state.gameState);
    state.lastPreview = render.showGrowPreview(state.dom, cell, state.gameState);
    doRender();
  }

  function handleFocusEnd() {
    if (state.isRendering) return;
    setTimeout(() => {
      const stillInMap = document.activeElement &&
        document.activeElement.closest &&
        document.activeElement.closest('#map') !== null;
      if (stillInMap) return;
      state.hoveredCell = null;
      state.previewCell = null;
      render.hideGrowPreview(state.dom);
      render.showTileInfo(state.dom, state.selectedCell, state.gameState);
      doRender();
    }, 0);
  }

  function handleClick(x, y) {
    const cell = cellAt(state.gameState, x, y);
    if (!cell) return;
    state.selectedCell = cell;
    state.focusedCell = cell;
    render.hideGrowPreview(state.dom);
    state.previewCell = null;
    if (!handleGrow(cell)) doRender();
  }

  function getFocusStartCell() {
    if (state.focusedCell) return state.focusedCell;
    if (state.selectedCell) return state.selectedCell;
    const activeEl = document.activeElement;
    if (activeEl && activeEl.closest && activeEl.closest('#map')) {
      const bx = parseInt(activeEl.getAttribute('data-x'), 10);
      const by = parseInt(activeEl.getAttribute('data-y'), 10);
      const cell = cellAt(state.gameState, bx, by);
      if (cell) return cell;
    }
    const current = currentLevel();
    if (current && current.start) {
      return cellAt(state.gameState, current.start[0], current.start[1]);
    }
    return cellAt(state.gameState, 0, 0);
  }

  function handleMoveFocus(dx, dy) {
    const startCell = getFocusStartCell();
    if (!startCell) return;
    const newX = startCell.x + dx;
    const newY = startCell.y + dy;
    if (newX < 0 || newX >= 10 || newY < 0 || newY >= 10) return;
    const target = cellAt(state.gameState, newX, newY);
    if (!target) return;
    state.focusedCell = target;
    state.hoveredCell = target;
    state.previewCell = target;
    render.showTileInfo(state.dom, target, state.gameState);
    state.lastPreview = render.showGrowPreview(state.dom, target, state.gameState);
    doRender();
    const btn = render.getFocusedButton(state.dom, newX, newY);
    if (btn && document.activeElement !== btn) {
      btn.focus({ preventScroll: true });
    }
    render.announce(state.dom, buildTileLabel(target, state.gameState));
  }

  function handleActivateFocused() {
    const target = state.focusedCell || state.selectedCell;
    if (!target) return;
    state.selectedCell = target;
    render.hideGrowPreview(state.dom);
    state.previewCell = null;
    if (!handleGrow(target)) {
      doRender();
    }
  }

  function handleToggleGuide() {
    const isOpen = render.toggleGuide(state.dom);
    if (isOpen) {
      render.renderGuide(state.dom, state.levels, state.levelIndex, state.isCustomLevel, state.customLevel, handleSelectLevel);
    }
  }

  function handleToggleEditor() {
    const result = render.toggleEditor(state.dom);
    if (result.editorOpen) {
      render.editorLoadFromCurrent(state.dom, currentLevel(), state.isCustomLevel);
    }
  }

  function handleEditorValidate() {
    const formData = render.editorCollectFormData(state.dom);
    const mapText = state.dom.editorMapEl.value;
    const lines = parseEditorMap(mapText);
    const result = validateLevel(formData, lines);

    render.editorRenderValidation(state.dom, result);
    render.editorRenderPreview(state.dom, lines, result.finalStart, result.stats);

    if (result.valid) {
      render.setEditorApplyEnabled(state.dom, true, {
        form: formData,
        lines: lines,
      });
    } else {
      render.setEditorApplyEnabled(state.dom, false);
    }
  }

  function handleEditorApply() {
    const data = render.getEditorApplyData(state.dom);
    if (!data) return;
    try {
      const level = buildLevelFromEditor(data.form, data.lines);
      state.customLevel = level;
      state.isCustomLevel = true;
      handleReset();
      render.renderLevelOptions(state.dom, state.levels, state.levelIndex, state.isCustomLevel, state.customLevel);
      state.dom.levelSelectEl.value = state.levels.length;
      render.closeEditor(state.dom);
      render.announce(state.dom, `已加载自定义关卡：${level.name}`);
    } catch (e) {
      console.error(e);
      alert('应用关卡失败：' + e.message);
    }
  }

  function handleEditorExport() {
    const formData = render.editorCollectFormData(state.dom);
    const mapText = state.dom.editorMapEl.value;
    const lines = parseEditorMap(mapText);
    const result = validateLevel(formData, lines);

    const level = {
      name: formData.name || '自定义关卡',
      goal: formData.goal || '完成自定义目标',
      nutrients: formData.nutrients,
      start: result.finalStart,
      winCondition: {
        requiredTrees: formData.winCondition.requiredTrees,
        requiredLeaves: formData.winCondition.requiredLeaves,
      },
      tiles: lines.map((l) => {
        let out = '';
        for (let x = 0; x < 10; x += 1) {
          out += l[x] || 'l';
        }
        return out;
      }),
    };
    render.exportJSON(level);
  }

  function handleEditorImport(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !Array.isArray(data.tiles)) {
          throw new Error('无效的关卡文件：缺少 tiles 数组');
        }
        const tiles = data.tiles.slice(0, 10);
        while (tiles.length < 10) tiles.push('llllllllll');
        const normalizedTiles = tiles.map((row) => {
          let r = row.slice(0, 10);
          while (r.length < 10) r += 'l';
          return r;
        });

        state.dom.editorNameEl.value = data.name || '';
        state.dom.editorGoalEl.value = data.goal || '';
        state.dom.editorNutrientsEl.value =
          (data.nutrients && data.nutrients > 0) ? data.nutrients : 30;
        if (Array.isArray(data.start) && data.start.length === 2) {
          state.dom.editorStartXEl.value =
            Math.max(0, Math.min(9, data.start[0]));
          state.dom.editorStartYEl.value =
            Math.max(0, Math.min(9, data.start[1]));
        }
        if (data.winCondition) {
          state.dom.editorTreesEl.value =
            Math.max(0, Math.min(20, data.winCondition.requiredTrees || 0));
          state.dom.editorLeavesEl.value =
            Math.max(0, Math.min(20, data.winCondition.requiredLeaves || 0));
        }
        state.dom.editorMapEl.value = normalizedTiles.join('\n');

        state.dom.editorValidationEl.hidden = true;
        state.dom.editorPreviewEl.hidden = true;
        state.dom.editorApplyEl.disabled = true;
        render.announce(state.dom, '已导入关卡文件，请点击校验按钮检查');
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function init() {
    state.dom = render.cacheDom();

    const tileInteract = {
      hover: handleHover,
      hoverEnd: handleHoverEnd,
      touch: handleTouch,
      focus: handleFocus,
      focusEnd: handleFocusEnd,
      click: handleClick,
      moveFocus: handleMoveFocus,
      activateFocused: handleActivateFocused,
    };

    render.ensureMapDom(state.dom, state.gameState, tileInteract);

    document.querySelector('#nextTurn').addEventListener('click', handleNextTurn);
    document.querySelector('#reset').addEventListener('click', handleReset);
    document.querySelector('#undo').addEventListener('click', handleUndo);
    document.querySelector('#toggleGuide').addEventListener('click', handleToggleGuide);
    document.querySelector('#toggleEditor').addEventListener('click', handleToggleEditor);
    document.querySelector('#editorValidate').addEventListener('click', handleEditorValidate);
    document.querySelector('#editorFillExample').addEventListener('click', () => {
      render.editorFillExample(state.dom);
    });
    document.querySelector('#editorClear').addEventListener('click', () => {
      render.editorClearMap(state.dom);
    });
    document.querySelector('#editorApply').addEventListener('click', handleEditorApply);
    document.querySelector('#editorExport').addEventListener('click', handleEditorExport);
    document.querySelector('#editorImportBtn').addEventListener('click', () => {
      state.dom.editorImportEl.click();
    });
    state.dom.editorImportEl.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleEditorImport(file);
      e.target.value = '';
    });

    state.dom.levelSelectEl.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (idx >= state.levels.length) {
        handleSelectLevel(idx, true);
      } else {
        handleSelectLevel(idx, false);
      }
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const inEditable = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (inEditable) return;

      const onMap = e.target && e.target.closest && e.target.closest('#map') !== null;
      const handledKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];

      if (!handledKeys.includes(e.key)) return;
      if (!onMap && (tag === 'button' || inEditable)) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') handleMoveFocus(0, -1);
        else if (e.key === 'ArrowDown') handleMoveFocus(0, 1);
        else if (e.key === 'ArrowLeft') handleMoveFocus(-1, 0);
        else if (e.key === 'ArrowRight') handleMoveFocus(1, 0);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (state.focusedCell || state.selectedCell) {
          e.preventDefault();
          handleActivateFocused();
        }
      }
    });

    render.renderLevelOptions(state.dom, state.levels, state.levelIndex, state.isCustomLevel, state.customLevel);
    handleReset();
  }

  return { init };
}
