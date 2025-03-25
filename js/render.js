import { config, gameState, sectorIcons } from './config.js.php';

// Constants to replace magic numbers
const GRID_LEFT_PADDING_CELLS = 100;  // Extra cells on left/right for horizontal centering
const GRID_TOP_PADDING_CELLS = 20;    // Top padding cells for grid
const GRID_BOTTOM_EXTRA_CELLS = 100;  // Extra bottom cells for gameView height

// Two.js instances and rendering offsets
export let gameTwo, backgroundTwo;
export let verticalPan = -400; // starting vertical offset

// NEW: Export getter and setter for verticalPan.
export function getVerticalPan() {
    return verticalPan;
}
export function setVerticalPan(newPan) {
    verticalPan = newPan;
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

export function renderGame(rooms) {
  try {
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

      if (room.status === 'constructed') {
        const roomRect = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
        roomRect.fill = config.colors.room;
        roomRect.stroke = '#000000';
        roomRect.linewidth = 2;
        gridGroup.add(roomRect);

        const sectorType = room.sector_type || 'default';
        const icon = sectorIcons[sectorType] || sectorIcons.default;
        const iconText = new Two.Text(icon, roomX, roomY, {
          size: config.cellSize * 0.8,
          alignment: 'center',
          baseline: 'middle',
          style: 'normal',
          family: 'Arial'
        });
        iconText.fill = '#FFFFFF';
        gridGroup.add(iconText);
      } else if (room.status === 'planned') {
        const plannedRoom = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
        plannedRoom.fill = 'rgba(255, 0, 0, 0.2)';
        plannedRoom.stroke = '#808080';
        plannedRoom.linewidth = 2;
        gridGroup.add(plannedRoom);

        const sectorType = room.sector_type || 'default';
        const icon = sectorIcons[sectorType] || sectorIcons.default;
        const iconText = new Two.Text(icon, roomX, roomY, {
          size: config.cellSize * 0.8,
          alignment: 'center',
          baseline: 'middle',
          style: 'normal',
          family: 'Arial'
        });
        iconText.fill = 'rgba(255, 255, 255, 0.5)';
        gridGroup.add(iconText);
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
    let animationPhase = 0;
    function loop() {
      try {
        animationPhase += 0.0005;
        // Define constants for brightness range.
        const BRIGHTNESS_MIN = 0.7;
        const BRIGHTNESS_CHANGE_FACTOR = 0.15; // determines the amplitude
        config.colors.background.brightness = BRIGHTNESS_MIN + (Math.sin(animationPhase) + 1) * (BRIGHTNESS_CHANGE_FACTOR);
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
    renderGame();
  } catch (error) {
    console.error("Error in resizeCanvas:", error);
  }
}
