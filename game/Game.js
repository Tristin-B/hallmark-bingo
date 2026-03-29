const { generateCard } = require("./CardGenerator");
const CHALLENGES = require("../data/challenges");

const WIN_LINES = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

class Game {
  constructor(code) {
    this.code = code;
    this.players = [null, null];
    this.status = "waiting"; // waiting | playing | bingo
    this.createdAt = Date.now();
    this.bingoWinner = null;
    this.challenge = null;
    this.roundsPlayed = 0;
  }

  addPlayer(socketId, name) {
    const index = this.players[0] === null ? 0 : this.players[1] === null ? 1 : -1;
    if (index === -1) return null;

    const card = generateCard();
    const marked = new Set([12]); // FREE space pre-marked

    this.players[index] = { id: socketId, name, card, marked, connected: true };

    if (this.players[0] && this.players[1]) {
      this.status = "playing";
    }

    return index;
  }

  reconnectPlayer(socketId, name) {
    for (let i = 0; i < 2; i++) {
      if (this.players[i] && this.players[i].name === name) {
        this.players[i].id = socketId;
        this.players[i].connected = true;
        return i;
      }
    }
    return null;
  }

  markSquare(playerIndex, squareIndex) {
    const player = this.players[playerIndex];
    if (!player || this.status === "bingo") return null;
    if (squareIndex < 0 || squareIndex > 24 || squareIndex === 12) return null;

    if (player.marked.has(squareIndex)) {
      player.marked.delete(squareIndex);
    } else {
      player.marked.add(squareIndex);
    }

    return { marked: player.marked.has(squareIndex), markedSquares: [...player.marked] };
  }

  checkBingo(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) return null;

    for (const line of WIN_LINES) {
      if (line.every((idx) => player.marked.has(idx))) {
        return line;
      }
    }
    return null;
  }

  triggerBingo(playerIndex, winningLine) {
    this.status = "bingo";
    this.bingoWinner = playerIndex;
    this.challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    return {
      winnerIndex: playerIndex,
      winnerName: this.players[playerIndex].name,
      loserName: this.players[1 - playerIndex].name,
      winningLine,
      challenge: this.challenge,
      challengeFor: this.players[1 - playerIndex].name,
    };
  }

  newRound() {
    this.status = "playing";
    this.bingoWinner = null;
    this.challenge = null;
    this.roundsPlayed++;

    for (const player of this.players) {
      if (player) {
        player.card = generateCard();
        player.marked = new Set([12]);
      }
    }
  }

  getStateForPlayer(playerIndex) {
    const player = this.players[playerIndex];
    const opponent = this.players[1 - playerIndex];

    return {
      code: this.code,
      playerIndex,
      status: this.status,
      you: player
        ? { name: player.name, card: player.card, markedSquares: [...player.marked] }
        : null,
      opponent: opponent
        ? {
            name: opponent.name,
            card: opponent.card,
            markedSquares: [...opponent.marked],
            connected: opponent.connected,
          }
        : null,
      bingoWinner: this.bingoWinner,
      challenge: this.challenge,
      roundsPlayed: this.roundsPlayed,
    };
  }

  disconnectPlayer(socketId) {
    for (let i = 0; i < 2; i++) {
      if (this.players[i] && this.players[i].id === socketId) {
        this.players[i].connected = false;
        return i;
      }
    }
    return null;
  }

  get playerCount() {
    return this.players.filter((p) => p !== null).length;
  }

  get allDisconnected() {
    return this.players.every((p) => p === null || !p.connected);
  }
}

module.exports = Game;
