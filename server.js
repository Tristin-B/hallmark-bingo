const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const gameManager = require("./game/GameManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- REST API ---

app.post("/api/games", (req, res) => {
  const game = gameManager.createGame();
  res.json({ code: game.code });
});

app.get("/api/games/:code", (req, res) => {
  const game = gameManager.getGame(req.params.code);
  if (!game) return res.status(404).json({ error: "Game not found" });
  if (game.playerCount >= 2) return res.status(400).json({ error: "Game is full" });
  res.json({ code: game.code, players: game.playerCount });
});

// --- Socket.IO ---

io.on("connection", (socket) => {
  let currentGame = null;
  let currentPlayerIndex = null;

  socket.on("join-game", ({ code, name }) => {
    const game = gameManager.getGame(code);
    if (!game) return socket.emit("error-msg", { message: "Game not found" });

    // Try reconnecting first
    let playerIndex = game.reconnectPlayer(socket.id, name);

    if (playerIndex === null) {
      // New player
      playerIndex = game.addPlayer(socket.id, name);
      if (playerIndex === null) {
        return socket.emit("error-msg", { message: "Game is full" });
      }
    }

    currentGame = game;
    currentPlayerIndex = playerIndex;
    socket.join(`game:${game.code}`);

    // Send state to this player
    socket.emit("game-joined", game.getStateForPlayer(playerIndex));

    // Notify opponent
    const opponent = game.players[1 - playerIndex];
    if (opponent && opponent.connected) {
      io.to(opponent.id).emit("opponent-joined", {
        opponentName: name,
        state: game.getStateForPlayer(1 - playerIndex),
      });
    }

    // If both players are in, start
    if (game.status === "playing" && game.players[0] && game.players[1]) {
      io.to(`game:${game.code}`).emit("game-start", {
        players: game.players.map((p) => (p ? { name: p.name } : null)),
      });
    }
  });

  socket.on("mark-square", ({ squareIndex }) => {
    if (!currentGame || currentPlayerIndex === null) return;
    if (currentGame.status !== "playing") return;

    const result = currentGame.markSquare(currentPlayerIndex, squareIndex);
    if (!result) return;

    // Confirm to the marking player
    socket.emit("square-marked", {
      playerIndex: currentPlayerIndex,
      squareIndex,
      marked: result.marked,
      markedSquares: result.markedSquares,
    });

    // Update opponent
    const opponent = currentGame.players[1 - currentPlayerIndex];
    if (opponent && opponent.connected) {
      io.to(opponent.id).emit("opponent-update", {
        opponentMarkedSquares: result.markedSquares,
      });
    }

    // Check bingo
    if (result.marked) {
      const winningLine = currentGame.checkBingo(currentPlayerIndex);
      if (winningLine) {
        const bingoResult = currentGame.triggerBingo(currentPlayerIndex, winningLine);
        io.to(`game:${currentGame.code}`).emit("bingo", bingoResult);
      }
    }
  });

  socket.on("new-round", () => {
    if (!currentGame) return;
    currentGame.newRound();

    // Send new state to each player
    for (let i = 0; i < 2; i++) {
      const player = currentGame.players[i];
      if (player && player.connected) {
        io.to(player.id).emit("new-round-started", currentGame.getStateForPlayer(i));
      }
    }
  });

  socket.on("disconnect", () => {
    if (!currentGame) return;
    const idx = currentGame.disconnectPlayer(socket.id);
    if (idx !== null) {
      const opponent = currentGame.players[1 - idx];
      if (opponent && opponent.connected) {
        io.to(opponent.id).emit("opponent-disconnected");
      }
    }

    // Cleanup if both disconnected for a while
    if (currentGame.allDisconnected) {
      setTimeout(() => {
        const game = gameManager.getGame(currentGame.code);
        if (game && game.allDisconnected) {
          gameManager.removeGame(game.code);
        }
      }, 5 * 60 * 1000); // 5 min grace period
    }
  });
});

// --- Start ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hallmark Bingo running on http://localhost:${PORT}`);
});
