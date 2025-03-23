import { config } from './config.js';
import { initRender, animateBackground, resizeCanvas } from './render.js';
import { initInputHandlers } from './input.js';
import { startAutoUpdates } from './updater.js';
import { initializePlayer } from './player.js'; // New player module import
import { playerHUD } from './playerHUD.js'; // if exported
// Import roomPopup if needed.

document.addEventListener('DOMContentLoaded', () => {
  try {
    const gameCanvas = document.getElementById('gameCanvas');
    const backgroundContainer = document.getElementById('background-container');
    
    // Initialize rendering and Two.js instances.
    initRender(gameCanvas, backgroundContainer);
    
    // Initialize input handlers.
    initInputHandlers(gameCanvas);
    
    // Begin background animation.
    animateBackground();
    
    // Start periodic game state updates.
    startAutoUpdates();
    
    // Attach resize event listener using the new resizeCanvas function.
    window.addEventListener('resize', () => resizeCanvas(gameCanvas));
    
    // Optionally, call resizeCanvas() immediately for a correct initial sizing.
    resizeCanvas(gameCanvas);
    
    // Initialize the player using functions from the new player.js module.
    initializePlayer().then(() => {
      // Once player is initialized, you can perform further actions here...
      console.log("Player initialization complete.");
    });
    
    // ...existing code for additional initialization...
  } catch (error) {
    console.error("Error in main initialization:", error);
  }
});
