import { config } from './config.js.php';
import { screenToGrid, renderGame, getVerticalPan, setVerticalPan } from './render.js';
import { gameState } from './config.js.php';
import { roomPopup } from './roomPopup.js'; // Assumes roomPopup.js exports a class instance

// Initialize input event handlers for mouse and key events.
export function initInputHandlers(gameCanvas) {
  try {
    // Left click handler to trigger room popup.
    gameCanvas.addEventListener('click', event => {
      try {
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const gridPos = screenToGrid(mouseX, mouseY);
        if (gridPos.x >= 0 && gridPos.x < config.gridWidth &&
            gridPos.y >= 0 && gridPos.y < config.gridHeight) {
          showRoomDetails(gridPos.x, gridPos.y);
        }
      } catch (error) {
        console.error("Error in left click handler:", error);
      }
    });
    // Prevent default context menu on right click.
    gameCanvas.addEventListener('contextmenu', event => event.preventDefault());
    
    // Key handler for vertical panning.
    window.addEventListener('keydown', event => {
      try {
        const PAN_STEP = config.view.keyPanAmount;
        const currentPan = getVerticalPan();
        if (event.key === 'ArrowUp') {
          setVerticalPan(currentPan + PAN_STEP);
          renderGame();
        } else if (event.key === 'ArrowDown') {
          setVerticalPan(currentPan - PAN_STEP);
          renderGame();
        }
      } catch (error) {
        console.error("Error in key event handler:", error);
      }
    });
    
    // Touch events (vertical panning)
    let touchStartY = 0;
    let initialVerticalPan = 0;
    gameCanvas.addEventListener('touchstart', event => {
      try {
        if (event.touches.length === 1) {
          touchStartY = event.touches[0].clientY;
          initialVerticalPan = getVerticalPan(); // Use getter to capture current pan
        }
      } catch (error) {
        console.error("Error in touchstart handler:", error);
      }
    }, { passive: false });
    
    gameCanvas.addEventListener('touchmove', event => {
      try {
        if (event.touches.length === 1) {
          const deltaY = event.touches[0].clientY - touchStartY;
          setVerticalPan(initialVerticalPan + deltaY); // Use setter to update vertical pan
          renderGame();
        }
        event.preventDefault();
      } catch (error) {
        console.error("Error in touchmove handler:", error);
      }
    }, { passive: false });
    
    gameCanvas.addEventListener('touchend', event => {
      // Nothing additional.
    });
  } catch (error) {
    console.error("Error in initInputHandlers:", error);
  }
}

async function showRoomDetails(gridX, gridY) {
  try {
    //TODO: Fetch gameState from gameState.php instead of using gameState from config
    const roomData = gameState.grid[gridY][gridX];
    if (roomData) {
      let owner = null;
      if (roomData.status === 'constructed') {
        owner = await fetchRoomOwner(roomData.id);
      }
      roomPopup.show(roomData, owner);
    }
  } catch (error) {
    console.error("Error in showRoomDetails:", error);
  }
}
  
async function fetchRoomOwner(roomID) {
  try {
    // Replace with real API call if needed; returning dummy data.
    return { username: 'PlayerName' };
  } catch (error) {
    console.error("Error in fetchRoomOwner:", error);
    return null;
  }
}
