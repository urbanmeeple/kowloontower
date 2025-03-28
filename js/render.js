import { config } from './config.js.php';
import { getLocalGameState } from './state.js';
import { getPlayerState } from './player.js';

// Constants to replace magic numbers
const GRID_LEFT_PADDING_CELLS = 100;  // Extra cells on left/right for horizontal centering
const GRID_TOP_PADDING_CELLS = 20;    // Top padding cells for grid
const GRID_BOTTOM_EXTRA_CELLS = 100;  // Extra bottom cells for gameView height

// Two.js instances and rendering offsets
export let gameTwo, backgroundTwo;
export let verticalPan = -400; // starting vertical offset

// Brightness cycle tracking variables
let brightnessCycleStartTime = Date.now(); // When the cycle started
let isCycleActive = true; // Whether we're in an active cycle or keeping minimum brightness

// NEW: Export getter and setter for verticalPan.
export function getVerticalPan() {
    return verticalPan;
}
export function setVerticalPan(newPan) {
    verticalPan = newPan;
}

/**
 * Resets the brightness cycle to sync with a new cache update
 * This should be called whenever the cron job updates the game state
 * @param {number} [remainingTime] - Optional remaining time in seconds until next cron job
 * @param {number} [cronJobInterval] - Optional total interval length in seconds
 */
export function resetBrightnessCycle(remainingTime, cronJobInterval) {
    // If we have timing information, sync with timer
    if (remainingTime !== undefined && cronJobInterval !== undefined) {
        // Calculate elapsed time in the cycle
        const elapsedTime = cronJobInterval - remainingTime;
        
        // Set brightnessCycleStartTime to a time in the past that would place us
        // at the correct point in the cycle
        const elapsedMs = elapsedTime * 1000; // Convert seconds to milliseconds
        brightnessCycleStartTime = Date.now() - elapsedMs;
        
        console.log(`Brightness cycle synchronized: ${elapsedTime}s elapsed, ${remainingTime}s remaining in ${cronJobInterval}s cycle`);
    } else {
        // No timing information provided, just reset to beginning
        brightnessCycleStartTime = Date.now();
        console.log("Brightness cycle reset to beginning");
    }
    
    isCycleActive = true;
}

export function initRender(canvas, backgroundContainer) {
  try {
    // Create Two.js instances for background and game rendering.
    backgroundTwo = new Two({ type: Two.Types.svg, fullscreen: true }).appendTo(backgroundContainer);
    gameTwo = new Two({ domElement: canvas, fullscreen: true });
    // Ensure gameTwo renders above backgroundTwo by adjusting z-index.
    backgroundTwo.renderer.domElement.style.zIndex = '0';
    gameTwo.renderer.domElement.style.zIndex = '1';

    // NEW: Set verticalPan so that the grid's base is at the bottom of the screen.
    const towerBottom = GRID_TOP_PADDING_CELLS * config.cellSize + config.gridHeight * config.cellSize;
    verticalPan = gameTwo.height - towerBottom - config.cellSize;
    
    // We'll initialize the brightness cycle in updater.js after timer is initialized
    updateGridOffset(gameTwo);
  } catch (error) {
    console.error("Error during initRender:", error);
  }
}

export let gridOffsetX = 0, gridOffsetY = 0;
export function updateGridOffset(twoInstance) {
  try {
    gridOffsetX = (twoInstance.width - (config.gridWidth * config.cellSize)) / 2;
    const BOTTOM_MARGIN = 50; 
    gridOffsetY = twoInstance.height - (config.gridHeight * config.cellSize) - BOTTOM_MARGIN;
    gridOffsetY = Math.max(10, gridOffsetY);
  } catch (error) {
    console.error("Error in updateGridOffset:", error);
  }
}

export function renderBackground() {
  try {
    backgroundTwo.clear();
    // Adjust brightness using a helper (here we simply use top color; you may enhance this)
    const bgColor = adjustBrightness(config.colors.background.top, config.colors.background.brightness);
    const bgRect = backgroundTwo.makeRectangle(
      backgroundTwo.width / 2,
      backgroundTwo.height / 2,
      backgroundTwo.width,
      backgroundTwo.height
    );
    bgRect.fill = bgColor;
    bgRect.noStroke();
    backgroundTwo.update();
  } catch (error) {
    console.error("Error in renderBackground:", error);
  }
}

function adjustBrightness(hexColor, factor) {
  try {
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error("Error in adjustBrightness:", error);
    return hexColor; // Fallback
  }
}

/**
 * Check if the player has an active bid on a room
 * @param {number} roomID - The room ID to check for bids
 * @returns {Object|null} The bid object if found, otherwise null
 */
function getPlayerBidForRoom(roomID) {
  const playerState = getPlayerState();
  if (!playerState.activeBids) return null;
  
  return playerState.activeBids.find(bid => bid.roomID == roomID);
}

export function renderGame(rooms) {
  try {
    if (!rooms) {
      console.error("Error in renderGame: 'rooms' is undefined or null.");
      return;
    }
    gameTwo.clear();

    // Render ground rectangle directly in the scene (without parent's translation).
    const towerBottom = GRID_TOP_PADDING_CELLS * config.cellSize + config.gridHeight * config.cellSize;
    const groundWidth = gameTwo.width;  // full canvas width
    const groundHeight = config.gridHeight * config.cellSize + (GRID_TOP_PADDING_CELLS + GRID_BOTTOM_EXTRA_CELLS) * config.cellSize;
    const groundCenterX = gameTwo.width / 2;
    const groundCenterY = towerBottom + groundHeight / 2 + verticalPan;
    const groundRect = new Two.Rectangle(groundCenterX, groundCenterY, groundWidth, groundHeight);
    groundRect.fill = config.colors.ground;
    groundRect.noStroke();
    gameTwo.add(groundRect);  // add directly to the root

    // Compute horizontal translation to center the grid.
    const fixedHorizontal = () => gameTwo.width / 2 - (GRID_LEFT_PADDING_CELLS * config.cellSize + (config.gridWidth * config.cellSize) / 2);
    const parentGroup = new Two.Group();
    parentGroup.translation.set(fixedHorizontal(), verticalPan);

    // Create child group for the tower grid.
    const gridGroup = new Two.Group();
    gridGroup.translation.set(GRID_LEFT_PADDING_CELLS * config.cellSize, GRID_TOP_PADDING_CELLS * config.cellSize);

    // Draw grid lines.
    for (let x = 0; x <= config.gridWidth; x++) {
      const line = new Two.Line(
        x * config.cellSize, 0,
        x * config.cellSize, config.gridHeight * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gridGroup.add(line);
    }
    for (let y = 0; y <= config.gridHeight; y++) {
      const line = new Two.Line(
        0, y * config.cellSize,
        config.gridWidth * config.cellSize, y * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gridGroup.add(line);
    }

    // Draw rooms using the provided rooms data
    rooms.forEach(room => {
      const roomX = room.location_x * config.cellSize + config.cellSize / 2;
      const roomY = room.location_y * config.cellSize + config.cellSize / 2;
      const roomSize = config.cellSize - 2;

      // Check if player has a bid on this room
      const playerBid = getPlayerBidForRoom(room.roomID);

      if (room.status === 'constructed') {
        const roomRect = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
        roomRect.fill = config.colors.room;
        roomRect.stroke = '#000000';
        roomRect.linewidth = 2;
        gridGroup.add(roomRect);

        const sectorType = room.sector_type || 'default';
        const icon = config.sectorIcons[sectorType] || config.sectorIcons.default; // Access sectorIcons from config
        const iconText = new Two.Text(icon, roomX, roomY, {
          size: config.cellSize * 0.8,
          alignment: 'center',
          baseline: 'middle',
          style: 'normal',
          family: 'Arial'
        });
        iconText.fill = '#FFFFFF';
        gridGroup.add(iconText);
        
        // Add bid indicator if player has a buy bid on this room
        if (playerBid && playerBid.type === 'buy') {
          // Currency symbol in top-right corner
          const bidIndicator = new Two.Text('💰', roomX + roomSize/2.5, roomY - roomSize/2.5, {
            size: config.cellSize * 0.4,
            alignment: 'center',
            baseline: 'middle',
            style: 'normal',
            family: 'Arial'
          });
          bidIndicator.fill = '#4CAF50'; // Green color
          gridGroup.add(bidIndicator);
        }
      } else if (room.status === 'planned') {
        const plannedRoom = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
        plannedRoom.fill = 'rgba(255, 0, 0, 0.2)';
        plannedRoom.stroke = '#808080';
        plannedRoom.linewidth = 2;
        gridGroup.add(plannedRoom);

        const sectorType = room.sector_type || 'default';
        const icon = config.sectorIcons[sectorType] || config.sectorIcons.default; // Access sectorIcons from config
        const iconText = new Two.Text(icon, roomX, roomY, {
          size: config.cellSize * 0.8,
          alignment: 'center',
          baseline: 'middle',
          style: 'normal',
          family: 'Arial'
        });
        iconText.fill = 'rgba(255, 255, 255, 0.5)';
        gridGroup.add(iconText);
        
        // Add bid indicator if player has a construct bid on this room
        if (playerBid && playerBid.type === 'construct') {
          // Currency symbol in top-right corner
          const bidIndicator = new Two.Text('💰', roomX + roomSize/2.5, roomY - roomSize/2.5, {
            size: config.cellSize * 0.4,
            alignment: 'center',
            baseline: 'middle',
            style: 'normal',
            family: 'Arial'
          });
          bidIndicator.fill = '#4CAF50'; // Green color
          gridGroup.add(bidIndicator);
        }
      }
    });

    parentGroup.add(gridGroup);
    gameTwo.add(parentGroup);
    gameTwo.update();
  } catch (error) {
    console.error("Error in renderGame:", error);
  }
}

// Helper function to convert screen coordinates to grid cell coordinates.
export function screenToGrid(screenX, screenY) {
  try {
    const fixedHorizontal = () => gameTwo.width / 2 - (GRID_LEFT_PADDING_CELLS * config.cellSize + (config.gridWidth * config.cellSize)/2);
    const gridOriginX = fixedHorizontal() + GRID_LEFT_PADDING_CELLS * config.cellSize;
    const gridOriginY = verticalPan + GRID_TOP_PADDING_CELLS * config.cellSize;
    const gridX = Math.floor((screenX - gridOriginX) / config.cellSize);
    const gridY = Math.floor((screenY - gridOriginY) / config.cellSize);
    return { x: gridX, y: gridY };
  } catch (error) {
    console.error("Error in screenToGrid:", error);
    return { x: -1, y: -1 };
  }
}

export function animateBackground() {
  try {
    function loop() {
      try {
        // Define constants for brightness range
        const BRIGHTNESS_MIN = 0.5;  // Minimum brightness (night)
        const BRIGHTNESS_MAX = 1.3;  // Maximum brightness (day)
        const BRIGHTNESS_RANGE = BRIGHTNESS_MAX - BRIGHTNESS_MIN;
        
        let brightness = BRIGHTNESS_MIN; // Default to minimum if cycle not active
        
        if (isCycleActive) {
          // Calculate how far we are into the cycle (0.0 to 1.0)
          const now = Date.now();
          const elapsedMs = now - brightnessCycleStartTime;
          const cycleMs = config.cronJobInterval * 1000; // Convert seconds to milliseconds
          const cycleProgress = Math.min(elapsedMs / cycleMs, 1.0); // Cap at 1.0
          
          if (cycleProgress >= 1.0) {
            // We've completed a cycle, stay at minimum brightness
            isCycleActive = false;
            brightness = BRIGHTNESS_MIN;
          } else if (cycleProgress < 0.5) {
            // First half: increase from min to max (dawn to noon)
            brightness = BRIGHTNESS_MIN + (cycleProgress * 2 * BRIGHTNESS_RANGE);
          } else {
            // Second half: decrease from max to min (noon to dusk)
            brightness = BRIGHTNESS_MAX - ((cycleProgress - 0.5) * 2 * BRIGHTNESS_RANGE);
          }
        }
        
        config.colors.background.brightness = brightness;
        renderBackground();
        requestAnimationFrame(loop);
      } catch (innerError) {
        console.error("Error in animateBackground loop:", innerError);
      }
    }
    loop();
  } catch (error) {
    console.error("Error starting animateBackground:", error);
  }
}

// New function to update canvas dimensions and re-render the scene.
export function resizeCanvas(gameCanvas) {
  try {
    // Define descriptive constants for canvas dimensions.
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    gameCanvas.width = newWidth;
    gameCanvas.height = newHeight;
    // Update Two.js instances dimensions.
    backgroundTwo.width = newWidth;
    backgroundTwo.height = newHeight;
    gameTwo.width = newWidth;
    gameTwo.height = newHeight;
    // Recalculate grid offsets.
    updateGridOffset(gameTwo);
    // Re-render the background and game.
    renderBackground();
    
    // Get the local game state but check if it has rooms data before rendering
    const gameState = getLocalGameState();
    if (gameState && gameState.rooms) {
      renderGame(gameState.rooms);
    } else {
      console.log("Game state or rooms not available yet, skipping initial render");
    }
  } catch (error) {
    console.error("Error in resizeCanvas:", error);
  }
}
