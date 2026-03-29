document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const createForm = document.getElementById("create-form");
  const joinForm = document.getElementById("join-form");
  const errorMsg = document.getElementById("error-msg");

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      if (tab.dataset.tab === "create") {
        createForm.classList.add("active");
        joinForm.classList.remove("active");
      } else {
        joinForm.classList.add("active");
        createForm.classList.remove("active");
      }
      errorMsg.classList.add("hidden");
    });
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
  }

  // Create game
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("create-name").value.trim();
    if (!name) return showError("Please enter your name");

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      window.location.href = `/game.html?code=${data.code}&name=${encodeURIComponent(name)}`;
    } catch {
      showError("Could not create game. Try again.");
    }
  });

  // Join game
  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("join-name").value.trim();
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    if (!name) return showError("Please enter your name");
    if (!code || code.length !== 4) return showError("Enter a 4-letter game code");

    try {
      const res = await fetch(`/api/games/${code}`);
      if (!res.ok) {
        const data = await res.json();
        return showError(data.error || "Game not found");
      }
      window.location.href = `/game.html?code=${code}&name=${encodeURIComponent(name)}`;
    } catch {
      showError("Could not join game. Try again.");
    }
  });

  // Snow effect
  createSnow();
});

function createSnow() {
  const container = document.getElementById("snow");
  for (let i = 0; i < 40; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.style.left = Math.random() * 100 + "%";
    flake.style.animationDuration = 5 + Math.random() * 10 + "s";
    flake.style.animationDelay = Math.random() * 10 + "s";
    flake.style.opacity = 0.3 + Math.random() * 0.5;
    flake.style.width = flake.style.height = 3 + Math.random() * 5 + "px";
    container.appendChild(flake);
  }
}
