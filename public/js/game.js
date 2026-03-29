document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const name = params.get("name");

  if (!code || !name) {
    window.location.href = "/";
    return;
  }

  const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  let myIndex = null;

  // Keep-alive: ping server every 4 minutes to prevent Render free tier sleep
  setInterval(() => {
    fetch("/api/ping").catch(() => {});
  }, 4 * 60 * 1000);
  let myCard = [];
  let myMarked = new Set();
  let opponentMarked = new Set();
  let gameStatus = "waiting";

  // UI elements
  const gameCodeEl = document.getElementById("game-code");
  const waitingOverlay = document.getElementById("waiting-overlay");
  const waitingCode = document.getElementById("waiting-code");
  const yourCardEl = document.getElementById("your-card");
  const opponentCardEl = document.getElementById("opponent-card");
  const yourNameEl = document.getElementById("your-name");
  const opponentNameEl = document.getElementById("opponent-name");
  const yourScoreEl = document.getElementById("your-score");
  const opponentScoreEl = document.getElementById("opponent-score");
  const opponentCardTitle = document.getElementById("opponent-card-title");
  const disconnectedBanner = document.getElementById("disconnected-banner");
  const bingoOverlay = document.getElementById("bingo-overlay");
  const bingoTitle = document.getElementById("bingo-title");
  const bingoMessage = document.getElementById("bingo-message");
  const challengeText = document.getElementById("challenge-text");
  const challengeFor = document.getElementById("challenge-for");
  const playAgainBtn = document.getElementById("play-again");
  const copyCodeBtn = document.getElementById("copy-code");
  const waitingCopyBtn = document.getElementById("waiting-copy");

  gameCodeEl.textContent = code;
  waitingCode.textContent = code;

  // Join the game
  socket.emit("join-game", { code, name });

  // --- Socket Events ---

  socket.on("game-joined", (state) => {
    myIndex = state.playerIndex;
    myCard = state.you.card;
    myMarked = new Set(state.you.markedSquares);
    yourNameEl.textContent = state.you.name;
    gameStatus = state.status;

    renderYourCard();

    if (state.opponent) {
      showOpponent(state.opponent);
      waitingOverlay.classList.add("hidden");
    } else {
      waitingOverlay.classList.remove("hidden");
    }

    updateScores();
  });

  socket.on("opponent-joined", ({ opponentName, state }) => {
    waitingOverlay.classList.add("hidden");
    showOpponent(state.opponent);
    gameStatus = "playing";
    updateScores();
  });

  socket.on("game-start", () => {
    waitingOverlay.classList.add("hidden");
    gameStatus = "playing";
  });

  socket.on("square-marked", ({ squareIndex, marked, markedSquares }) => {
    myMarked = new Set(markedSquares);
    renderYourCard();
    updateScores();
  });

  socket.on("opponent-update", ({ opponentMarkedSquares }) => {
    opponentMarked = new Set(opponentMarkedSquares);
    renderOpponentCard();
    updateScores();
  });

  socket.on("bingo", (result) => {
    gameStatus = "bingo";
    showBingo(result);
  });

  socket.on("new-round-started", (state) => {
    myCard = state.you.card;
    myMarked = new Set(state.you.markedSquares);
    gameStatus = "playing";

    if (state.opponent) {
      opponentMarked = new Set(state.opponent.markedSquares);
      renderOpponentCard();
    }

    renderYourCard();
    updateScores();
    bingoOverlay.classList.add("hidden");
    clearConfetti();
  });

  socket.on("opponent-disconnected", () => {
    disconnectedBanner.classList.remove("hidden");
  });

  socket.on("opponent-reconnected", () => {
    disconnectedBanner.classList.add("hidden");
  });

  socket.on("error-msg", ({ message }) => {
    alert(message);
    window.location.href = "/";
  });

  // Reconnect handler
  socket.on("connect", () => {
    if (myIndex !== null) {
      socket.emit("join-game", { code, name });
    }
  });

  // --- Rendering ---

  function renderYourCard() {
    yourCardEl.innerHTML = "";
    myCard.forEach((trope, idx) => {
      const cell = document.createElement("button");
      cell.className = "bingo-cell";
      if (myMarked.has(idx)) cell.classList.add("marked");
      if (idx === 12) cell.classList.add("free-space");

      const text = document.createElement("span");
      text.className = "cell-text";
      text.textContent = trope;
      cell.appendChild(text);

      if (idx !== 12) {
        cell.addEventListener("click", () => {
          if (gameStatus !== "playing") return;
          socket.emit("mark-square", { squareIndex: idx });
          // Optimistic update
          if (myMarked.has(idx)) {
            myMarked.delete(idx);
          } else {
            myMarked.add(idx);
          }
          renderYourCard();
          updateScores();
        });
      }

      yourCardEl.appendChild(cell);
    });
  }

  function renderOpponentCard() {
    if (!opponentCardEl.dataset.initialized) return;

    const cells = opponentCardEl.querySelectorAll(".bingo-cell");
    cells.forEach((cell, idx) => {
      if (opponentMarked.has(idx)) {
        cell.classList.add("marked");
      } else {
        cell.classList.remove("marked");
      }
    });
  }

  function showOpponent(opponent) {
    opponentNameEl.textContent = opponent.name;
    opponentCardTitle.textContent = `${opponent.name}'s Card`;
    opponentMarked = new Set(opponent.markedSquares);
    disconnectedBanner.classList.toggle("hidden", opponent.connected);

    opponentCardEl.innerHTML = "";
    opponent.card.forEach((trope, idx) => {
      const cell = document.createElement("div");
      cell.className = "bingo-cell";
      if (opponentMarked.has(idx)) cell.classList.add("marked");
      if (idx === 12) cell.classList.add("free-space");

      const text = document.createElement("span");
      text.className = "cell-text";
      text.textContent = trope;
      cell.appendChild(text);

      opponentCardEl.appendChild(cell);
    });

    opponentCardEl.dataset.initialized = "true";
  }

  function updateScores() {
    // Score = marked squares minus the free space
    yourScoreEl.textContent = Math.max(0, myMarked.size - 1);
    opponentScoreEl.textContent = Math.max(0, opponentMarked.size - 1);
  }

  // --- Bingo Celebration ---

  function showBingo(result) {
    const isWinner = result.winnerIndex === myIndex;

    if (isWinner) {
      bingoTitle.textContent = "YOU GOT BINGO!";
      bingoMessage.textContent = `Congratulations, ${result.winnerName}!`;
    } else {
      bingoTitle.textContent = `${result.winnerName} GOT BINGO!`;
      bingoMessage.textContent = "So close! But here's a fun challenge for you:";
    }

    challengeText.textContent = result.challenge;
    challengeFor.textContent = `Challenge for: ${result.challengeFor}`;

    // Highlight winning line on the winner's card
    if (isWinner) {
      highlightWinningLine(yourCardEl, result.winningLine);
    } else {
      highlightWinningLine(opponentCardEl, result.winningLine);
    }

    bingoOverlay.classList.remove("hidden");
    createConfetti();
  }

  function highlightWinningLine(cardEl, line) {
    const cells = cardEl.querySelectorAll(".bingo-cell");
    line.forEach((idx) => {
      if (cells[idx]) cells[idx].classList.add("winning");
    });
  }

  function createConfetti() {
    const container = document.getElementById("confetti");
    const colors = ["#C41E3A", "#D4AF37", "#2E8B57", "#FFF8F0", "#8B1A1A"];
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = 1 + Math.random() * 2 + "s";
      piece.style.animationDelay = Math.random() * 1.5 + "s";
      piece.style.width = 6 + Math.random() * 8 + "px";
      piece.style.height = 6 + Math.random() * 8 + "px";
      container.appendChild(piece);
    }
  }

  function clearConfetti() {
    document.getElementById("confetti").innerHTML = "";
    // Clear winning highlights
    document.querySelectorAll(".winning").forEach((el) => el.classList.remove("winning"));
  }

  // --- Buttons ---

  playAgainBtn.addEventListener("click", () => {
    socket.emit("new-round");
  });

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.activeElement;
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = orig), 1500);
    });
  }

  copyCodeBtn.addEventListener("click", copyCode);
  waitingCopyBtn.addEventListener("click", copyCode);

  // Snow
  createSnow();
});

function createSnow() {
  const container = document.getElementById("snow");
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.style.left = Math.random() * 100 + "%";
    flake.style.animationDuration = 5 + Math.random() * 10 + "s";
    flake.style.animationDelay = Math.random() * 10 + "s";
    flake.style.opacity = 0.2 + Math.random() * 0.3;
    flake.style.width = flake.style.height = 2 + Math.random() * 4 + "px";
    container.appendChild(flake);
  }
}
