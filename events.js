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
    Game.render();
  });

  Game.renderLevelOptions();
  Game.reset();
};

Game.init();
