const TROPES = require("../data/tropes");

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateCard() {
  const shuffled = shuffle(TROPES);
  const selected = shuffled.slice(0, 24);
  // Insert FREE space at center (index 12)
  selected.splice(12, 0, "FREE");
  return selected;
}

module.exports = { generateCard };
