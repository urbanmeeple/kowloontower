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

  // Ensure players array exists in the game state
  if (!gameState.players) {
    gameState.players = [];
    console.warn("Game state is missing 'players' array. Initialized as an empty array.");
  }

  // Note: The players array in the local game state does not include playerID.
  // Player data must be accessed using the username, which is unique.
  console.log("Game state updated in memory:", gameState);
}

export { fetchUpdatedGameState } from './updater.js';
