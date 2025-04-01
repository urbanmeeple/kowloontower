import { config } from './config.js.php';
import { renderGame, resetBrightnessCycle, updatePlayerListWindow } from './render.js';
import { playerHUD } from './playerHUD.js';
import { updateLocalGameState, getLocalGameState } from './state.js';
import { getPlayerUsername, fetchPlayerBids, getPlayerRent, getPlayerDividends } from './player.js'; // Updated imports
import { roomPopup } from './roomPopup.js'; // Ensure roomPopup is imported
import { showIncomeOverlay } from './infoOverlay.js'; // Import showIncomeOverlay

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
    
    // Get the current cache timestamp and store it
    const timestamp = await getCacheLastUpdate();
    if (timestamp) {
      console.log("Storing cache timestamp:", timestamp);
      localStorage.setItem(config.player.cacheTimestampKey, timestamp.toString());
      
      // Calculate remaining time for reset
      const now = Math.floor(Date.now() / 1000);
      const elapsedTime = now - timestamp;
      const remainingTime = Math.max(config.cronJobInterval - elapsedTime, 0);
      
      // Reset the timer with the new timestamp and interval from config
      playerHUD.resetTimer(timestamp, config.cronJobInterval);
      
      // Reset the brightness cycle to sync with the cron job and timer
      resetBrightnessCycle(remainingTime, config.cronJobInterval);

      // Update player list window on timer reset
      updatePlayerListWindow();
      
      console.log(`Timer reset with timestamp ${timestamp} and interval ${config.cronJobInterval}s, ${remainingTime}s remaining`);
    }

    console.log("Game state successfully updated from cache.");
    return true;
  } catch (error) {
    console.error("Error in fetchUpdatedGameState:", error);
    return false;
  }
}

/**
 * Fetch the last cache update timestamp from the server.
 * @returns {Promise<number|null>} The last cache update timestamp or null if an error occurs.
 */
export async function getCacheLastUpdate() {
  try {
    const response = await fetch('api/getCacheStatus.php');
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();

    if (data.lastCacheUpdate) {
      console.log("Cache last update timestamp fetched:", data.lastCacheUpdate);
      return data.lastCacheUpdate;
    } else {
      console.error("Cache status response missing 'lastCacheUpdate'.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching cache status:", error);
    return null;
  }
}

/**
 * Update the player HUD and re-render the game
 */
export async function updateGameAndHUD() {
  try {
    const gameState = getLocalGameState();
    if (!gameState || !gameState.rooms) {
      console.error("Invalid game state, cannot update HUD and render game");
      return;
    }

    // Refresh player's active bids and wait for completion
    await fetchPlayerBids();

    // Get current player username and active bids
    const username = getPlayerUsername();
    const activeBids = getActiveBids();

    if (username && gameState.players) {
      // Find the player data by username
      const currentPlayer = gameState.players.find(player => player.username === username);

      if (currentPlayer) {
        // Count rooms owned by this player
        let roomCount = 0;
        if (gameState.players_rooms) {
          roomCount = gameState.players_rooms.filter(pr => pr.username === username).length;
        }

        // Update current player with room count and active bids
        const updatedPlayerState = {
          ...currentPlayer,
          roomCount: roomCount,
          activeBids: activeBids
        };

        // Update the HUD
        playerHUD.update(updatedPlayerState);
      }
    }

    // Re-render the game using the updated room data
    renderGame(gameState.rooms);

    console.log(`Game rendered with ${gameState.rooms ? gameState.rooms.length : 0} rooms`);
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
    
    // Set up the periodic polling every autoUpdatePollingInterval (for example every 10 sec)
    const UPDATE_INTERVAL = config.autoUpdatePollingInterval;
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
    // Get the last known timestamp, defaulting to 0 if not set
    const lastKnownTimestamp = parseInt(localStorage.getItem(config.player.cacheTimestampKey) || '0', 10);

    // Fetch current cache file timestamp
    const response = await fetch('api/getCacheStatus.php');
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    
    console.log("Cache check - Server timestamp:", data.lastCacheUpdate, "Local timestamp:", lastKnownTimestamp);
    
    // Compare timestamps and update if needed
    if (data.lastCacheUpdate && data.lastCacheUpdate > lastKnownTimestamp) {
      console.log("Cache is newer than last known version. Fetching updates...");
      localStorage.setItem(config.player.cacheTimestampKey, data.lastCacheUpdate.toString());
      await fetchUpdatedGameState();

      // Reset bid buttons after the update
      roomPopup.enableBidButtons();

      // Show income overlay with updated rent and dividends
      const rent = getPlayerRent();
      const dividends = getPlayerDividends();
      showIncomeOverlay(rent, dividends);

    } else {
      console.log("Cache is current, no update needed");
      
      // Even if cache hasn't changed, make sure timer is running with current timestamp
      if (data.lastCacheUpdate) {
        // Calculate remaining time for the current cycle
        const now = Math.floor(Date.now() / 1000);
        const elapsedTime = now - data.lastCacheUpdate;
        const remainingTime = Math.max(config.cronJobInterval - elapsedTime, 0);
        
        // Reset both timer and brightness with same values
        playerHUD.resetTimer(data.lastCacheUpdate, config.cronJobInterval);
        resetBrightnessCycle(remainingTime, config.cronJobInterval);

        // Update player list window on timer reset
        updatePlayerListWindow();
      }
    }
  } catch (error) {
    console.error("Error checking cache status:", error);
  }
}
