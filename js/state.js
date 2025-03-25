// Local in-memory copy of the game state
let gameState = {};

// Function to get the current game state
export function getGameState() {
  return gameState;
}

// Function to update the game state
export function updateLocalGameState(newState) {
  gameState = { ...newState }; // Replace the current state with the new state
  console.log("Game state updated in memory:", gameState);
}
