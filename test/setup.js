const fs = require('fs');
const path = require('path');

function createMinimalDom() {
  const mockElement = () => {
    const el = {
      addEventListener: () => {},
      textContent: '',
      innerHTML: '',
      hidden: false,
      className: '',
      setAttribute: () => {},
      removeAttribute: () => {},
      appendChild: () => {},
      focus: () => {},
      getAttribute: () => null,
      closest: () => null,
      removeChild: () => {},
      insertBefore: () => {},
      replaceChild: () => {},
      dataset: {},
      style: {}
    };
    return el;
  };

  global.document = {
    querySelector: () => mockElement(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => mockElement(),
    activeElement: null,
    body: mockElement()
  };
  global.window = {
    addEventListener: () => {},
    setTimeout: (fn) => fn()
  };
  global.HTMLElement = function() {};
}

function loadGameSources() {
  const baseDir = path.resolve(__dirname, '..');
  const sources = ['levels.js', 'state.js', 'actions.js', 'render.js'];
  sources.forEach((file) => {
    const filePath = path.join(baseDir, file);
    const code = fs.readFileSync(filePath, 'utf8');
    eval.call(global, code);
  });

  const originalInit = global.Game.init;
  global.Game.init = function() {};

  const eventsPath = path.join(baseDir, 'events.js');
  const eventsCode = fs.readFileSync(eventsPath, 'utf8');
  eval.call(global, eventsCode);

  global.Game.init = originalInit;

  global.Game.render = function() {};
  global.Game.announce = function() {};
  global.Game.showTileInfo = function() {};
  global.Game.showGrowPreview = function() {};
  global.Game.hideGrowPreview = function() {};
  global.Game.renderGuide = function() {};
  global.Game.toggleGuide = function() {};
  global.Game.cacheDom = function() {};
  global.Game.ensureMapDom = function() {};
  global.Game.renderLevelOptions = function() {};
  global.Game.updateTileDom = function() {};
  global.Game.buildTileLabel = function(cell) { return ''; };
  global.Game.tileClass = function(cell) { return ''; };
  global.Game.moveFocus = function() {};
  global.Game.activateFocused = function() {};
  global.Game._getFocusStartCell = function() { return null; };
  global.Game.countLevelStats = function(level) { return { trees: 0, leaves: 0, microbes: 0 }; };
}

createMinimalDom();
loadGameSources();

module.exports = {
  Game: global.Game,
  assert: require('assert')
};
