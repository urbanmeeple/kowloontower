import { config } from './config.js.php';
import { renderGame } from './render.js';
import { playerHUD } from './playerHUD.js'; // Assumes playerHUD.js exports a valid instance
import { updateLocalGameState, getGameState } from './state.js'; // Import state management functions

// Fetch updated game state from the server.
export async function fetchUpdatedGameState() {
  try {
    const response = await fetch('api/getCache.php');
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();

    // Update the local in-memory game state
    updateLocalGameState(data);

    // Update the game and HUD after the local game state is updated
    updateGameAndHUD();

    console.log("Game state successfully updated from cache.");
  } catch (error) {
    console.error("Error in fetchUpdatedGameState:", error);
  }
}

// Function to update the player HUD and re-render the game
export function updateGameAndHUD() {
  try {
    const gameState = getGameState();

    // Fetch the player's username from localStorage
    const storedUsername = localStorage.getItem(config.player.usernameKey);

    // Update the player HUD with the current player's data
    const currentPlayer = gameState.players.find(player => player.username === storedUsername);
    if (currentPlayer) {
      playerHUD.update(currentPlayer);
    }

    // Re-render the game using the updated game state
    renderGame(gameState.rooms);
  } catch (error) {
    console.error("Error in updateGameAndHUD:", error);
  }
}

// Begin periodic updates.
export async function startAutoUpdates() {
  try {
    const response = await fetch('api/getCacheStatus.php');
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    // localCacheTimestamp is a variable storing the last known cache update time.
    if (data.lastCacheUpdate && data.lastCacheUpdate > localCacheTimestamp) {
      // New update available: fetch updated cache data
      localCacheTimestamp = data.lastCacheUpdate;
      console.log("New cache update detected. Fetching updated game state...");
      await fetchUpdatedGameState(); // Your function to call getCache.php and update local game state

    }
  } catch (error) {
    console.error("Error polling cache status:", error);
  } finally {
    // Poll periodically (e.g., every 10 seconds)
    setTimeout(startAutoUpdates, config.autoUpdatePollingInterval);
  }
}
