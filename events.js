var Game = Game || {};

Game.init = function() {
  Game.cacheDom();

  document.querySelector("#nextTurn").addEventListener("click", Game.nextTurn);
  document.querySelector("#reset").addEventListener("click", Game.reset);
  document.querySelector("#toggleGuide").addEventListener("click", Game.toggleGuide);
  Game.levelSelectEl.addEventListener("change", (e) => {
    Game.levelIndex = parseInt(e.target.value, 10);
    Game.reset();
    if (!document.querySelector("#guide").hidden) Game.renderGuide();
  });
  document.querySelector("#undo").addEventListener("click", () => {
    if (!Game.history.length) return;
    Game.state = JSON.parse(Game.history.pop());
    if (Game.selectedCell) {
      const currentCell = Game.cellAt(Game.selectedCell.x, Game.selectedCell.y);
      if (currentCell) Game.selectedCell = currentCell;
    }
    if (Game.focusedCell) {
      const currentFocused = Game.cellAt(Game.focusedCell.x, Game.focusedCell.y);
      if (currentFocused) Game.focusedCell = currentFocused;
    }
    Game.announce("撤销完成");
    Game.render();
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const inEditable = tag === "input" || tag === "textarea" || tag === "select";
    if (inEditable) return;

    const onMap = e.target && e.target.closest && e.target.closest("#map") !== null;
    const handledKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "];

    if (!handledKeys.includes(e.key)) return;
    if (!onMap && (tag === "button" || inEditable)) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowUp") Game.moveFocus(0, -1);
      else if (e.key === "ArrowDown") Game.moveFocus(0, 1);
      else if (e.key === "ArrowLeft") Game.moveFocus(-1, 0);
      else if (e.key === "ArrowRight") Game.moveFocus(1, 0);
    } else if (e.key === "Enter" || e.key === " ") {
      if (Game.focusedCell || Game.selectedCell) {
        e.preventDefault();
        Game.activateFocused();
      }
    }
  });

  Game.renderLevelOptions();
  Game.reset();
};

Game.init();
