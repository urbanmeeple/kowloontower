import { config } from './config.js.php';
import { screenToGrid, renderGame, getVerticalPan, setVerticalPan } from './render.js';
import { getLocalGameState } from './state.js';
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
        const PAN_STEP = config.view.keyPanAmount; // Amount to pan per key press
        const currentPan = getVerticalPan();
        if (event.key === 'ArrowUp') {
          setVerticalPan(currentPan + PAN_STEP); // Move up
          renderGame(getLocalGameState().rooms); // Re-render game
        } else if (event.key === 'ArrowDown') {
          setVerticalPan(currentPan - PAN_STEP); // Move down
          renderGame(getLocalGameState().rooms); // Re-render game
        }
      } catch (error) {
        console.error("Error in key event handler:", error);
      }
    });
    
    // Mouse wheel handler for vertical panning
    gameCanvas.addEventListener('wheel', event => {
      try {
        event.preventDefault();
        const WHEEL_SENSITIVITY = 0.5; // Adjust this value to control scroll sensitivity
        const wheelDelta = event.deltaY * WHEEL_SENSITIVITY;
        const currentPan = getVerticalPan();
        
        // Scroll down to pan down, scroll up to pan up
        setVerticalPan(currentPan - wheelDelta);
        renderGame(getLocalGameState().rooms); // Re-render game
      } catch (error) {
        console.error("Error in wheel event handler:", error);
      }
    }, { passive: false });
    
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
          const deltaY = touchStartY - event.touches[0].clientY; // Invert panning direction
          setVerticalPan(initialVerticalPan - deltaY); // Update vertical pan
          renderGame(getLocalGameState().rooms); // Re-render game
        }
        event.preventDefault();
      } catch (error) {
        console.error("Error in touchmove handler:", error);
      }
    }, { passive: false });
    
    gameCanvas.addEventListener('touchend', event => {
      // Nothing additional needed for touchend
    });
  } catch (error) {
    console.error("Error in initInputHandlers:", error);
  }
}

async function showRoomDetails(gridX, gridY) {
  try {
    const gameState = getLocalGameState(); // Fetch the local game state
    const roomData = gameState.rooms.find(
      room => room.location_x === gridX && room.location_y === gridY
    );
    if (roomData) {
      roomPopup.show(roomData); // Pass roomData directly to roomPopup
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
