import { config } from './config.js.php';
import { renderGame } from './render.js';
import { playerHUD } from './playerHUD.js';
import { updateLocalGameState, getLocalGameState } from './state.js';
import { getPlayerState } from './player.js';

// Track the last known timestamp of the cache file
// Using localStorage to persist between page reloads
const CACHE_TIMESTAMP_KEY = 'kowloonTowerCacheTimestamp';

/**
 * Fetch updated game state from the server.
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function fetchUpdatedGameState() {
  try {
    console.log("Fetching updated game state from cache...");
    const response = await fetch('api/getCache.php');
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();

    // Update the local in-memory game state
    updateLocalGameState(data);

    // Update the game and HUD after the local game state is updated
    updateGameAndHUD();

    console.log("Game state successfully updated from cache.");
    return true;
  } catch (error) {
    console.error("Error in fetchUpdatedGameState:", error);
    return false;
  }
}

/**
 * Update the player HUD and re-render the game
 */
export function updateGameAndHUD() {
  try {
    const gameState = getLocalGameState();
    if (!gameState || !gameState.rooms) {
      console.error("Invalid game state, cannot update HUD and render game");
      return;
    }

    // Get current player state including username
    const playerState = getPlayerState();
    const username = playerState.username;
    
    if (username && gameState.players) {
      // Find the player data by username
      const currentPlayer = gameState.players.find(player => player.username === username);
      
      if (currentPlayer) {
        // Count rooms owned by this player
        let roomCount = 0;
        if (gameState.players_rooms) {
          roomCount = gameState.players_rooms.filter(pr => pr.username === username).length;
        }

        // Update current player with room count
        const updatedPlayerState = {
          ...playerState,
          ...currentPlayer,
          roomCount: roomCount
        };
        
        // Update the HUD
        playerHUD.update(updatedPlayerState);
      }
    }

    // Re-render the game using the updated room data
    renderGame(gameState.rooms);
    
    console.log(`Game rendered with ${gameState.rooms ? gameState.rooms.length : 0} rooms`);
    
    // Store the current timestamp when we successfully updated
    if (gameState.lastUpdate) {
      localStorage.setItem(CACHE_TIMESTAMP_KEY, gameState.lastUpdate);
    }
  } catch (error) {
    console.error("Error in updateGameAndHUD:", error);
  }
}

/**
 * Begin periodic updates of game state
 */
export async function startAutoUpdates() {
  try {
    console.log("Starting auto updates...");
    
    // Try to fetch cache status immediately
    await checkAndFetchCache();
    
    // Set up the periodic polling every 10 seconds (or use config value)
    const UPDATE_INTERVAL = config.updateInterval || 10000;
    setInterval(checkAndFetchCache, UPDATE_INTERVAL);
    
    console.log(`Auto-updates scheduled every ${UPDATE_INTERVAL}ms`);
  } catch (error) {
    console.error("Error starting auto updates:", error);
  }
}

/**
 * Check if the cache file has been updated and fetch new data if needed
 */
async function checkAndFetchCache() {
  try {
    // Get the last known timestamp
    const lastKnownTimestamp = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
    
    // Fetch current cache file timestamp
    const response = await fetch('api/getCacheStatus.php');
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    
    console.log("Cache check - Server timestamp:", data.lastCacheUpdate, "Local timestamp:", lastKnownTimestamp);
    
    // Compare timestamps and update if needed
    if (data.lastCacheUpdate && data.lastCacheUpdate > lastKnownTimestamp) {
      console.log("Cache is newer than last known version. Fetching updates...");
      localStorage.setItem(CACHE_TIMESTAMP_KEY, data.lastCacheUpdate);
      await fetchUpdatedGameState();
    } else {
      console.log("Cache is current, no update needed");
    }
  } catch (error) {
    console.error("Error checking cache status:", error);
  }
}
