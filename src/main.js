import './styles/main.css';
import { createGame } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
  const game = createGame();
  game.init();
});
