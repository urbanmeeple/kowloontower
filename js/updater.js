import { config, gameState } from './config.js.php';
import { renderGame } from './render.js';
import { playerHUD } from './playerHUD.js'; // Assumes playerHUD.js exports a valid instance

// Fetch updated game state from the server.
export async function fetchGameState() {
  try {
    const controller = new AbortController();
    const TIMEOUT_MS = 5000;
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const playerID = localStorage.getItem(config.player.storageKey);
    const response = await fetch(`api/gameState.php?playerID=${encodeURIComponent(playerID)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const data = await response.json();
    // Process received data.
    if (data.grid) {
      // Check if grid changed (simple string comparison)
      const currentGrid = JSON.stringify(gameState.grid);
      const newGrid = JSON.stringify(data.grid);
      if (currentGrid !== newGrid) {
        gameState.grid = data.grid;
        gameState.lastUpdate = new Date();
        renderGame();
      }
      // Update HUD timer if provided.
      if (data.lastUpdateTime) {
        playerHUD.setTimerFromServer(data.lastUpdateTime);
      } else if (data.lastUpdateTimestamp) {
        playerHUD.setTimerFromServer(data.lastUpdateTimestamp);
      } else {
        playerHUD.resetUpdateTimer();
      }
      config.lastStateTimestamp = data.timestamp || new Date().getTime();
      // Update player data if provided.
      if (data.player) {
        gameState.player = { ...gameState.player, ...data.player };
        playerHUD.update(gameState.player);
      }
    }
  } catch (error) {
    console.error("Error in fetchGameState:", error);
  }
}

// Begin periodic updates.
export function startAutoUpdates() {
  try {
    let retryCount = 0;
    const maxRetries = 3;
    async function updateLoop() {
      if (retryCount >= maxRetries) {
        console.error("Max retries reached. Stopping updates.");
        return;
      }
      try {
        await fetchGameState();
        retryCount = 0;
      } catch (error) {
        retryCount++;
        console.error(`Retrying (${retryCount}/${maxRetries})...`);
      } finally {
        setTimeout(updateLoop, config.updateInterval);
      }
    }
    updateLoop();
  } catch (error) {
    console.error("Error in startAutoUpdates:", error);
  }
}
