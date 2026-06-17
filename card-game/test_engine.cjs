const { GameEngine } = require('./dist-engine/game/gameEngine');
const e = new GameEngine();
console.log('OK:', JSON.stringify(e.getState()).substring(0, 60));
