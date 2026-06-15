import { soilNames, cost } from '../data/levels.js';
import { canGrow } from '../logic/state.js';

export function buildTileLabel(cell, state) {
  const parts = [];
  parts.push(`坐标 (${cell.x}, ${cell.y})`);
  parts.push(soilNames[cell.soil]);

  if (cell.block) {
    parts.push('不可通行');
  }
  if (cell.mycelium) {
    parts.push('已占领');
  }
  if (cell.tree) {
    parts.push(cell.mycelium ? '树根已连接' : '树根');
  }
  if (cell.leaf) {
    parts.push(cell.decomposed ? '落叶已分解' : '落叶');
  }
  if (cell.microbe) {
    parts.push(cell.competed ? '微生物已竞争' : '存在微生物');
  }
  if (!cell.block && !cell.mycelium) {
    const canGrowTo = canGrow(state, cell);
    const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
    if (canGrowTo) {
      if (state.nutrients >= tileCost) {
        parts.push(`可扩张，消耗${tileCost}养分`);
      } else {
        parts.push(`可扩张但养分不足，需要${tileCost}养分`);
      }
    } else {
      parts.push('未连接菌丝');
    }
  }
  return parts.join('，');
}

export function tileClass(cell, state, selectedCell, hoveredCell, focusedCell, previewCell, lastPreview) {
  const classes = ['cell', cell.soil];
  if (cell.block) classes.push('block');
  if (cell.tree) classes.push('tree');
  if (cell.leaf && !cell.decomposed) classes.push('leaf');
  if (cell.microbe && !cell.competed) classes.push('microbe');
  if (cell.mycelium) classes.push('mycelium');
  if (canGrow(state, cell)) classes.push('frontier');
  if (selectedCell && selectedCell.x === cell.x && selectedCell.y === cell.y) classes.push('selected');
  if (hoveredCell && hoveredCell.x === cell.x && hoveredCell.y === cell.y) classes.push('hovered');
  if (focusedCell && focusedCell.x === cell.x && focusedCell.y === cell.y) classes.push('focused');
  if (previewCell && previewCell.x === cell.x && previewCell.y === cell.y) {
    classes.push('previewing');
    if (lastPreview) {
      if (!lastPreview.canGrow) {
        classes.push('preview-blocked');
      } else if (lastPreview.nutrientDelta >= 0) {
        classes.push('preview-positive');
      } else {
        const after = state.nutrients + lastPreview.nutrientDelta;
        if (after < 0) {
          classes.push('preview-negative-danger');
        } else if (state.nutrients < lastPreview.cost) {
          classes.push('preview-negative-low');
        } else {
          classes.push('preview-negative');
        }
      }
    }
  }
  return classes.join(' ');
}
