// Local in-memory copy of the game state
let gameState = {};

// Ensure players array exists in the game state
if (!gameState.players) {
  gameState.players = [];
}

// Note: active_datetime in the players table is stored in UTC format.
// Ensure to handle time zone conversions when comparing with local time.

// Function to get the current game state
export function getLocalGameState() {
  return gameState;
}

// Function to update the game state
export function updateLocalGameState(newState) {
  gameState = { ...newState }; // Replace the current state with the new state
  console.log("Game state updated in memory:", gameState);
}
