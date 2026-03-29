const Game = require("./Game");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous: 0/O, 1/I

class GameManager {
  constructor() {
    this.games = new Map();

    // Cleanup stale games every 30 minutes
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  generateCode() {
    let code;
    do {
      code = "";
      for (let i = 0; i < 4; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
    } while (this.games.has(code));
    return code;
  }

  createGame() {
    const code = this.generateCode();
    const game = new Game(code);
    this.games.set(code, game);
    return game;
  }

  getGame(code) {
    return this.games.get(code.toUpperCase()) || null;
  }

  removeGame(code) {
    this.games.delete(code);
  }

  cleanup() {
    const fourHours = 4 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [code, game] of this.games) {
      if (now - game.createdAt > fourHours) {
        this.games.delete(code);
      }
    }
  }
}

module.exports = new GameManager();
