import { initRender, animateBackground, resizeCanvas, renderPlayerListWindow } from './render.js';
import { initInputHandlers } from './input.js';
import { startAutoUpdates, fetchUpdatedGameState } from './updater.js';
import { initializePlayer, getPlayerIDFromStorage } from './player.js'; // Import missing function
import { roomPopup } from './roomPopup.js'; // Import roomPopup for proper initialization

/**
 * Update the CSS variable for the player HUD height dynamically.
 */
function updatePlayerHUDHeight() {
  const playerHUD = document.getElementById('player-hud');
  if (playerHUD) {
    const hudHeight = playerHUD.offsetHeight;
    document.documentElement.style.setProperty('--player-hud-height', `${hudHeight}px`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const gameCanvas = document.getElementById('gameCanvas');
    const backgroundContainer = document.getElementById('background-container');
    
    // Initialize rendering and Two.js instances.
    initRender(gameCanvas, backgroundContainer);
    
    // Initialize input handlers.
    initInputHandlers(gameCanvas);
    
    // Begin background animation.
    animateBackground();
    
    // First load game state directly - this ensures we have data before rendering
    console.log("Fetching initial game state...");
    await fetchUpdatedGameState();

    // Initialize the player
    await initializePlayer();
    console.log("Player initialization complete.");
    
    // Render the player list window
    renderPlayerListWindow();
    
    // Update the player HUD height dynamically
    updatePlayerHUDHeight();
    
    // Only now resize canvas and render (after we have game state and the player is initialized)
    resizeCanvas(gameCanvas);
    
    // Start periodic game state updates after initial load
    startAutoUpdates();
    
    // Attach resize event listener
    window.addEventListener('resize', () => {
      resizeCanvas(gameCanvas);
      updatePlayerHUDHeight(); // Update HUD height on window resize
    });
    
  } catch (error) {
    console.error("Error in main initialization:", error);
  }
});
