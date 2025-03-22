document.addEventListener('DOMContentLoaded', () => {
  // Game configuration
  const config = {
    gridWidth: 20, // Number of cells horizontally
    gridHeight: 30, // Number of cells vertically
    cellSize: 20,   // Size of each cell in pixels
    colors: {
      background: {
        top: '#FFEB3B',    // Yellow for top
        brightness: 1.0    // Initial brightness (1.0 = 100%)
      },
      grid: '#333333',     // Grid line color
      room: '#000000',     // Room color (solid black)
      selected: '#00000066', // Selected space color (transparent black)
      ground: '#8B4513'    // Brown color for ground line
    },
    // Zoom and pan settings
    view: {
      zoom: 1,           // Initial zoom level
      minZoom: 0.2,      // Minimum zoom level
      maxZoom: 3,        // Maximum zoom level
      zoomStep: 0.1,     // Zoom step size
      panX: 0,           // Initial pan X offset
      panY: 0,           // Initial pan Y offset
      isPanning: false,  // Flag to track panning state
      lastX: 0,          // Last mouse/touch X position
      lastY: 0,          // Last mouse/touch Y position
      keyPanAmount: 15,  // Amount to pan with each key press (in pixels)
      keysPressed: {}    // Track which keys are currently pressed
    },
    // Auto-update settings
    updateInterval: 10000, // Check for updates every 10 seconds
    lastStateTimestamp: null, // Track when we last received a state update
    nextUpdateTime: null, // When the next server update will occur
    // Player settings
    player: {
      welcomeMessageDuration: 5000, // Duration to show welcome message in milliseconds
      storageKey: 'kowloonTowerPlayerID' // Key used in localStorage
    }
  };

  // Game state with selected cells and rooms
  let gameState = {
    grid: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(null)),
    selected: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(0)),
    pendingSelections: [], // Store coordinates of selections not yet sent to server
    lastUpdate: null,
    // Player state
    player: {
      playerID: null,
      username: null,
      money: 0,
      stock_housing: 0,
      stock_entertainment: 0,
      stock_weapons: 0,
      stock_food: 0,
      stock_technical: 0,
      roomCount: 0,
      isNewPlayer: false
    }
  };

  // Define sector icons mapping (matching the HUD icons)
  const sectorIcons = {
    'housing': '🏠',
    'entertainment': '🎭',
    'weapons': '🔫',
    'food': '🍔',
    'technical': '⚙️',
    'default': '🏢' // Default icon if sector type is unknown
  };

  // Set up the canvas and Two.js instances
  const gameCanvas = document.getElementById('gameCanvas');
  const backgroundContainer = document.getElementById('background-container');
  
  // Create separate Two.js instances for background and game
  const backgroundTwo = new Two({
    type: Two.Types.svg,
    fullscreen: true
  }).appendTo(backgroundContainer);
  
  const gameTwo = new Two({
    domElement: gameCanvas,
    fullscreen: true
  });

  // Initialize the player HUD
  const playerHUD = new PlayerHUD(document.body);

  // Resize handler
  function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update canvas size
    gameCanvas.width = width;
    gameCanvas.height = height;
    
    // Update Two.js instances
    backgroundTwo.width = width;
    backgroundTwo.height = height;
    gameTwo.width = width;
    gameTwo.height = height;
    
    // Re-center the grid
    updateGridOffset();
    
    // Redraw the scene
    renderBackground();
    renderGame();
  }

  // Calculate the offset to center the grid in the canvas
  let gridOffsetX = 0;
  let gridOffsetY = 0;
  
  function updateGridOffset() {
    // Center horizontally
    gridOffsetX = (gameTwo.width - (config.gridWidth * config.cellSize)) / 2;
    
    // Position vertically so the bottom of the grid is at the bottom of the screen
    // with a small margin
    const bottomMargin = 50; // pixels from bottom of screen
    gridOffsetY = gameTwo.height - (config.gridHeight * config.cellSize) - bottomMargin;
    
    // Ensure gridOffsetY is never negative (which would push the grid off-screen)
    gridOffsetY = Math.max(10, gridOffsetY);
  }

  // Initialize the grid offset
  updateGridOffset();
  
  // Rendering functions
  function renderBackground() {
    backgroundTwo.clear();
  
    const brightness = config.colors.background.brightness;
    const bgColor = adjustBrightness(config.colors.background.top, brightness);
  
    const bgRect = backgroundTwo.makeRectangle(
      backgroundTwo.width / 2,
      backgroundTwo.height / 2,
      backgroundTwo.width,
      backgroundTwo.height
    );
  
    bgRect.fill = bgColor;
    bgRect.noStroke();
  
    backgroundTwo.update();
  }
  
  // Helper function to adjust color brightness
  function adjustBrightness(hexColor, factor) {
    // Convert hex to RGB
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);
    
    // Adjust brightness (clamp values between 0-255)
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  function renderGame() {
    gameTwo.clear();
    
    // Create a group for all game elements to apply transformations
    const gameGroup = new Two.Group();
    
    // Apply zoom and pan transformations
    gameGroup.translation.set(gridOffsetX + config.view.panX, gridOffsetY + config.view.panY);
    gameGroup.scale = config.view.zoom;
    
    // Draw grid lines
    for (let x = 0; x <= config.gridWidth; x++) {
      const line = new Two.Line(
        x * config.cellSize, 
        0, 
        x * config.cellSize, 
        config.gridHeight * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gameGroup.add(line);
    }
    
    for (let y = 0; y <= config.gridHeight; y++) {
      const line = new Two.Line(
        0, 
        y * config.cellSize, 
        config.gridWidth * config.cellSize, 
        y * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gameGroup.add(line);
    }
    
    // Draw rooms and selections
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        const roomData = gameState.grid[y][x];
        if (roomData) {
          const roomX = x * config.cellSize + config.cellSize / 2;
          const roomY = y * config.cellSize + config.cellSize / 2;
          const roomSize = config.cellSize - 2; // Room rectangle size
          const iconSize = roomSize * 0.8; // Icon size as 80% of the room size

          if (roomData.status === 'constructed') {
            // Draw constructed room
            const room = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
            room.fill = config.colors.room;
            room.noStroke();
            gameGroup.add(room);

            // Add sector icon
            const sectorType = roomData.type || 'default';
            const icon = sectorIcons[sectorType] || sectorIcons.default;
            const iconText = new Two.Text(icon, roomX, roomY, {
              size: iconSize / config.view.zoom, // Scale icon size with zoom
              alignment: 'center',
              baseline: 'middle',
              style: 'normal',
              family: 'Arial'
            });
            iconText.fill = '#FFFFFF'; // White text
            gameGroup.add(iconText);
          } else if (roomData.status === 'planned') {
            // Draw planned room
            const plannedRoom = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
            plannedRoom.fill = 'rgba(255, 0, 0, 0.2)'; // Transparent red fill
            plannedRoom.stroke = '#FF0000'; // Solid red border
            plannedRoom.linewidth = 2;
            gameGroup.add(plannedRoom);

            // Add semi-transparent sector icon
            const sectorType = roomData.type || 'default';
            const icon = sectorIcons[sectorType] || sectorIcons.default;
            const iconText = new Two.Text(icon, roomX, roomY, {
              size: iconSize / config.view.zoom, // Scale icon size with zoom
              alignment: 'center',
              baseline: 'middle',
              style: 'normal',
              family: 'Arial'
            });
            iconText.fill = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent white text
            gameGroup.add(iconText);
          }
        } else if (gameState.selected[y][x] === 1) {
          // Draw selected space
          const selectedSpace = new Two.Rectangle(
            x * config.cellSize + config.cellSize / 2, 
            y * config.cellSize + config.cellSize / 2,
            config.cellSize - 2, 
            config.cellSize - 2
          );
          selectedSpace.fill = config.colors.selected;
          selectedSpace.noStroke();
          gameGroup.add(selectedSpace);
        }
      }
    }
    
    // Add the group to the scene
    gameTwo.add(gameGroup);
    
    // Add the ground rectangle
    const groundY = gridOffsetY + config.gridHeight * config.cellSize;
    const groundHeight = gameTwo.height - groundY;
    const groundRect = new Two.Rectangle(
      gameTwo.width / 2,          // center X: full-width rectangle
      groundY + groundHeight / 2,   // center Y: between grid bottom and screen bottom
      gameTwo.width,              // width: full screen width
      groundHeight                // height: from grid bottom to bottom of screen
    );
    groundRect.fill = config.colors.ground; // brown color
    groundRect.noStroke();
    gameTwo.add(groundRect);
    
    gameTwo.update();
  }
  
  // Animation loop for the background gradient brightness
  let animationPhase = 0;
  function animateBackground() {
    // Very slow oscillation of brightness (full cycle takes ~2 minutes)
    animationPhase += 0.0005;
    
    // Brightness oscillates between 70% and 100%
    const brightness = 0.7 + (Math.sin(animationPhase) + 1) * 0.15;
    config.colors.background.brightness = brightness;
    
    renderBackground();
    requestAnimationFrame(animateBackground);
  }
  
  // Convert screen coordinates to grid coordinates
  function screenToGrid(screenX, screenY) {
    const zoomInverse = 1 / config.view.zoom;
    const x = Math.floor(((screenX - gridOffsetX - config.view.panX) * zoomInverse) / config.cellSize);
    const y = Math.floor(((screenY - gridOffsetY - config.view.panY) * zoomInverse) / config.cellSize);
    return { x, y };
  }
  
  // Handle user interactions
  function handleCanvasClick(event) {
    // Don't process as a click if we're currently panning
    if (config.view.isPanning) return;
    
    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to grid coordinates with zoom and pan consideration
    const gridPos = screenToGrid(mouseX, mouseY);
    
    // Check if click is within grid bounds
    if (gridPos.x >= 0 && gridPos.x < config.gridWidth && 
        gridPos.y >= 0 && gridPos.y < config.gridHeight) {
      
      // Only allow selecting an empty cell that isn't already selected
      if (!gameState.grid[gridPos.y][gridPos.x] && 
          gameState.selected[gridPos.y][gridPos.x] === 0) {
        
        // Mark as selected in local state
        gameState.selected[gridPos.y][gridPos.x] = 1;
        
        // Add to pending selections array for next update
        gameState.pendingSelections.push({x: gridPos.x, y: gridPos.y});
        
        // Redraw the game (but don't send to server)
        renderGame();
        
        console.log(`Added selection at (${gridPos.x},${gridPos.y}) to pending queue. Total pending: ${gameState.pendingSelections.length}`);
      }
    }
  }

  // Global flag to track if the space key is pressed
  let isSpaceDown = false;

  // Pan start handler
  function handlePanStart(event) {
    // Get the coordinates (mouse or touch)
    let clientX, clientY;
    if (event.type.includes('mouse')) {
      clientX = event.clientX;
      clientY = event.clientY;
      
      // Only start panning if the space key is pressed or middle/right mouse button
      if (!isSpaceDown && event.button !== 1 && event.button !== 2) return;
      
      event.preventDefault(); // Prevent default for mouse event
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }
    
    config.view.isPanning = true;
    config.view.lastX = clientX;
    config.view.lastY = clientY;
    
    // Add temporary event listeners for pan move and end
    if (event.type.includes('mouse')) {
      document.addEventListener('mousemove', handlePanMove);
      document.addEventListener('mouseup', handlePanEnd);
    } else {
      document.addEventListener('touchmove', handlePanMove, { passive: false });
      document.addEventListener('touchend', handlePanEnd);
    }
  }
  
  // Pan move handler
  function handlePanMove(event) {
    if (!config.view.isPanning) return;
    
    let clientX, clientY;
    if (event.type.includes('mouse')) {
      clientX = event.clientX;
      clientY = event.clientY;
      event.preventDefault();
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault(); // Prevent scrolling while panning
    }
    
    // Calculate the delta
    const deltaX = clientX - config.view.lastX;
    const deltaY = clientY - config.view.lastY;
    
    // Update the last position
    config.view.lastX = clientX;
    config.view.lastY = clientY;
    
    // Update the pan values
    config.view.panX += deltaX;
    config.view.panY += deltaY;
    
    // Calculate the boundaries for panning
    const zoom = config.view.zoom;
    const gridWidthPixels = config.gridWidth * config.cellSize * zoom;
    const gridHeightPixels = config.gridHeight * config.cellSize * zoom;
    
    // Allow panning 3 grid sizes below the tower
    const belowTowerPadding = 3 * config.cellSize * zoom;
    
    // Allow panning 10 grid sizes above the tower
    const aboveTowerPadding = 10 * config.cellSize * zoom;
    
    // Allow panning 20 grid sizes to the left and right of the tower
    const sidePadding = 20 * config.cellSize * zoom;
    
    const minPanX = -gridWidthPixels + gameCanvas.width - gridOffsetX - sidePadding;
    const maxPanX = -gridOffsetX + sidePadding;
    const minPanY = -gridHeightPixels + gameCanvas.height - gridOffsetY - belowTowerPadding;
    const maxPanY = -gridOffsetY + aboveTowerPadding;
    
    // Clamp pan values to keep the grid within the boundaries
    config.view.panX = Math.max(minPanX, Math.min(maxPanX, config.view.panX));
    config.view.panY = Math.max(minPanY, Math.min(maxPanY, config.view.panY));
    
    // Redraw
    renderGame();
  }
  
  // Pan end handler
  function handlePanEnd(event) {
    config.view.isPanning = false;
    
    // Remove temporary event listeners
    document.removeEventListener('mousemove', handlePanMove);
    document.removeEventListener('mouseup', handlePanEnd);
    document.removeEventListener('touchmove', handlePanMove);
    document.removeEventListener('touchend', handlePanEnd);
  }
  
  // Handle zoom with mouse wheel
  function handleZoom(event) {
    event.preventDefault();
    
    // Get the mouse position
    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate zoom direction
    const delta = -Math.sign(event.deltaY);
    const zoomFactor = 1 + (delta * config.view.zoomStep);
    
    // Calculate new zoom level with min/max limits
    let newZoom = Math.max(
      config.view.minZoom, 
      Math.min(config.view.maxZoom, config.view.zoom * zoomFactor)
    );
    
    // Calculate the zoom point in world coordinates before zoom
    const worldX = (mouseX - gridOffsetX - config.view.panX) / config.view.zoom;
    const worldY = (mouseY - gridOffsetY - config.view.panY) / config.view.zoom;
    
    // Apply new zoom
    config.view.zoom = newZoom;
    
    // Calculate the new pan values to keep the zoom centered on mouse position
    config.view.panX = mouseX - gridOffsetX - (worldX * newZoom);
    config.view.panY = mouseY - gridOffsetY - (worldY * newZoom);
    
    // Apply standard panning boundaries
    const gridWidthPixels = config.gridWidth * config.cellSize * newZoom;
    const gridHeightPixels = config.gridHeight * config.cellSize * newZoom;
    
    // Allow panning 3 grid sizes below the tower
    const belowTowerPadding = 3 * config.cellSize * newZoom;
    
    // Allow panning 10 grid sizes above the tower
    const aboveTowerPadding = 10 * config.cellSize * newZoom;
    
    // Allow panning 20 grid sizes to the left and right of the tower
    const sidePadding = 20 * config.cellSize * newZoom;
    
    const minPanX = -gridWidthPixels + gameCanvas.width - gridOffsetX - sidePadding;
    const maxPanX = -gridOffsetX + sidePadding;
    const minPanY = -gridHeightPixels + gameCanvas.height - gridOffsetY - belowTowerPadding;
    const maxPanY = -gridOffsetY + aboveTowerPadding;
    
    // Clamp pan values to keep the grid within the boundaries
    config.view.panX = Math.max(minPanX, Math.min(maxPanX, config.view.panX));
    config.view.panY = Math.max(minPanY, Math.min(maxPanY, config.view.panY));
    
    // Redraw
    renderGame();
  }
  
  // Remove/replace previous mobile touch implementation with this simplified version:

  let touchInitialDistance = 0;
  let touchInitialZoom = 1;
  let touchInitialPanX = 0;
  let touchInitialPanY = 0;
  let lastTouchCenter = { x: 0, y: 0 };

  function handleTouchStart(event) {
    if (event.touches.length === 2) {
      event.preventDefault();
      // Two-finger gesture: store initial distance and center
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      touchInitialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      touchInitialZoom = config.view.zoom;
      touchInitialPanX = config.view.panX;
      touchInitialPanY = config.view.panY;
      lastTouchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    } else if (event.touches.length === 1) {
      // Single-finger: record starting point for panning/tap
      config.view.lastX = event.touches[0].clientX;
      config.view.lastY = event.touches[0].clientY;
    }
  }

  function handleTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 2) {
      // Two-finger pinch-zoom and pan
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const newZoom = Math.max(config.view.minZoom, 
                        Math.min(config.view.maxZoom,
                          touchInitialZoom * (currentDistance / touchInitialDistance)
                        ));
      config.view.zoom = newZoom;
      const currentCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      // Update pan simply by adding change in center
      config.view.panX += (currentCenter.x - lastTouchCenter.x);
      config.view.panY += (currentCenter.y - lastTouchCenter.y);
      lastTouchCenter = currentCenter;
      renderGame();
    } else if (event.touches.length === 1) {
      // One-finger pan; add delta movement
      const touch = event.touches[0];
      const deltaX = touch.clientX - config.view.lastX;
      const deltaY = touch.clientY - config.view.lastY;
      config.view.panX += deltaX;
      config.view.panY += deltaY;
      config.view.lastX = touch.clientX;
      config.view.lastY = touch.clientY;
      renderGame();
    }
  }

  function handleTouchEnd(event) {
    // If no touches remain, and this was not a tap, do nothing special.
    if (event.touches.length === 0) {
      // Optionally, you could call a tap handler here.
    }
  }
  
  // Handle keydown events for arrow key navigation
  function handleKeyDown(event) {
    // Track the key press
    config.view.keysPressed[event.key] = true;
    // Update the view based on pressed arrow keys
    updateViewWithArrowKeys();
  }
  
  // Handle keyup events for arrow key navigation
  function handleKeyUp(event) {
    // Remove the key from the pressed keys
    delete config.view.keysPressed[event.key];
  }
  
  // Update the view based on which arrow keys are pressed
  function updateViewWithArrowKeys() {
    let deltaX = 0;
    let deltaY = 0;
    const panAmount = config.view.keyPanAmount;
    
    // Check which arrow keys are pressed
    if (config.view.keysPressed['ArrowLeft']) {
      deltaX += panAmount;
    }
    if (config.view.keysPressed['ArrowRight']) {
      deltaX -= panAmount;
    }
    if (config.view.keysPressed['ArrowUp']) {
      deltaY += panAmount;
    }
    if (config.view.keysPressed['ArrowDown']) {
      deltaY -= panAmount;
    }
    
    // Only apply changes if there's actual movement
    if (deltaX !== 0 || deltaY !== 0) {
      // Update pan values
      config.view.panX += deltaX;
      config.view.panY += deltaY;
      
      // Apply standard panning boundaries (reuse the same logic used in other pan functions)
      const zoom = config.view.zoom;
      const gridWidthPixels = config.gridWidth * config.cellSize * zoom;
      const gridHeightPixels = config.gridHeight * config.cellSize * zoom;
      
      // Allow panning 3 grid sizes below the tower
      const belowTowerPadding = 3 * config.cellSize * zoom;
      
      // Allow panning 10 grid sizes above the tower
      const aboveTowerPadding = 10 * config.cellSize * zoom;
      
      // Allow panning 20 grid sizes to the left and right of the tower
      const sidePadding = 20 * config.cellSize * zoom;
      
      const minPanX = -gridWidthPixels + gameCanvas.width - gridOffsetX - sidePadding;
      const maxPanX = -gridOffsetX + sidePadding;
      const minPanY = -gridHeightPixels + gameCanvas.height - gridOffsetY - belowTowerPadding;
      const maxPanY = -gridOffsetY + aboveTowerPadding;
      
      // Clamp pan values to keep the grid within the boundaries
      config.view.panX = Math.max(minPanX, Math.min(maxPanX, config.view.panX));
      config.view.panY = Math.max(minPanY, Math.min(maxPanY, config.view.panY));
      
      // Redraw
      renderGame();
    }
  }
  
  // Fetch the current game state from the server
  async function fetchGameState() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // Timeout after 5 seconds

        const playerID = getPlayerIDFromStorage();
        const response = await fetch(`api/gameState.php?playerID=${encodeURIComponent(playerID)}`, {
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        // Check if the server is signaling that an update is about to occur
        if (data.updateInProgress && gameState.pendingSelections.length > 0) {
          // If update is in progress, send our pending selections
          await sendPendingSelections();
        }
        
        if (data.grid) {
          // Store next update time if provided
          if (data.nextUpdateTime) {
            config.nextUpdateTime = new Date(data.nextUpdateTime);
            
            // Calculate time until next update
            const timeUntilUpdate = config.nextUpdateTime - new Date();
            
            // If update is imminent (within 5 seconds), send pending selections
            if (timeUntilUpdate > 0 && timeUntilUpdate < 5000 && gameState.pendingSelections.length > 0) {
              console.log("Update is imminent, sending pending selections");
              await sendPendingSelections();
            }
          }
          
          // Check if the grid has changed
          let hasChanged = false;
          
          // Compare with existing grid
          if (gameState.grid && gameState.grid.length > 0) {
            // Simple check - compare JSON strings
            const gridChanged = JSON.stringify(data.grid) !== JSON.stringify(gameState.grid);
            hasChanged = gridChanged;
          } else {
            // First load or empty grid
            hasChanged = true;
          }
          
          // Always update the timer when we get a response from the server
          // This ensures clients stay in sync with server updates
          // Use ISO date string from server (includes timezone info) as the priority source
          // Fall back to timestamp if ISO string not available
          if (data.lastUpdateTime) {
            playerHUD.setTimerFromServer(data.lastUpdateTime);
            console.log("Timer updated from server ISO timestamp:", data.lastUpdateTime);
          } else if (data.lastUpdateTimestamp) {
            playerHUD.setTimerFromServer(data.lastUpdateTimestamp);
            console.log("Timer updated from server Unix timestamp:", data.lastUpdateTimestamp);
          } else {
            playerHUD.resetUpdateTimer();
          }
          
          // Only update the UI if something has changed
          if (hasChanged) {
            console.log("Game state updated from server");
            
            // Update the grid with server data
            gameState.grid = data.grid;
            
            // Clear any selections that are now rooms
            // This prevents selecting spots that became rooms in the last update
            for (let y = 0; y < config.gridHeight; y++) {
              for (let x = 0; x < config.gridWidth; x++) {
                if (gameState.grid[y][x]) {
                  // Remove from selected grid
                  gameState.selected[y][x] = 0;
                  
                  // Remove from pending selections if present
                  gameState.pendingSelections = gameState.pendingSelections.filter(
                    sel => !(sel.x === x && sel.y === y)
                  );
                }
              }
            }
            
            gameState.lastUpdate = new Date();
            renderGame();
          }
          
          // If player data is included in the response, update the player state and HUD
          if (data.player) {
            // Update player state
            gameState.player = {
              ...gameState.player,
              ...data.player
            };
            
            // Update the HUD
            playerHUD.update(gameState.player);
            
            console.log("Updated player data from server");
          }
          
          // Store last update timestamp
          config.lastStateTimestamp = data.timestamp || new Date().getTime();
        }
    } catch (error) {
        console.error('Error fetching game state:', error);
        if (error.name === 'AbortError') {
            console.error('Request timed out.');
        }
    }
}
  
  // Send pending selections to the server during an update
  async function sendPendingSelections() {
    if (gameState.pendingSelections.length === 0) {
      return; // Nothing to send
    }
    
    try {
      console.log(`Sending ${gameState.pendingSelections.length} pending selections to server`);
      
      const response = await fetch('api/sendSelections.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selections: gameState.pendingSelections,
          playerID: gameState.player.playerID
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`Sent ${gameState.pendingSelections.length} selections to server successfully`);
        // Clear pending selections as they're now on the server
        gameState.pendingSelections = [];
      } else {
        console.error('Failed to send selections:', data.error);
      }
    } catch (error) {
      console.error('Error sending selections:', error);
    }
  }
  
  // Periodically check for updates
  function startAutoUpdates() {
    let retryCount = 0;
    const maxRetries = 3;

    async function updateLoop() {
        if (retryCount >= maxRetries) {
            console.error('Max retries reached. Stopping updates.');
            return;
        }

        try {
            await fetchGameState();
            retryCount = 0; // Reset retry count on success
        } catch (error) {
            retryCount++;
            console.error(`Retrying (${retryCount}/${maxRetries})...`);
        } finally {
            setTimeout(updateLoop, config.updateInterval);
        }
    }

    updateLoop();
}
  
  // Player Management Functions
  /**
   * Check if a player ID exists in local storage
   * @returns {string|null} The player ID or null if not found
   */
  function getPlayerIDFromStorage() {
    return localStorage.getItem(config.player.storageKey);
  }

  /**
   * Save player ID to local storage
   * @param {string} playerID - The player ID to save
   */
  function savePlayerIDToStorage(playerID) {
    localStorage.setItem(config.player.storageKey, playerID);
  }

  /**
   * Fetch existing player data from server
   * @param {string} playerID - The player ID to fetch
   * @returns {Promise<boolean>} Whether player was successfully fetched
   */
  async function fetchPlayerData(playerID) {
    try {
      const response = await fetch(`api/player.php?id=${encodeURIComponent(playerID)}`);
      
      // Check if response is ok (status in the range 200-299)
      if (!response.ok) {
        return false; // Player not found or other error
      }
      
      const data = await response.json();
      if (data.success && data.player) {
        // Update player state with fetched data
        gameState.player = {
          ...gameState.player,
          ...data.player,
          isNewPlayer: false
        };
        
        // Update the HUD with player data
        playerHUD.update(gameState.player);
        
        // Show welcome back message
        showWelcomeMessage(false);
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      return false;
    }
  }

  /**
   * Create a new player on the server
   * @returns {Promise<boolean>} Whether player was successfully created
   */
  async function createNewPlayer() {
    try {
      const response = await fetch('api/player.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body as server generates all values
      });
      
      if (!response.ok) {
        console.error('Server error when creating player:', await response.text());
        return false;
      }
      
      const data = await response.json();
      
      if (data.success && data.player) {
        // Update player state with new player data
        gameState.player = {
          ...gameState.player,
          ...data.player,
          roomCount: 0, // New players have no rooms
          isNewPlayer: true
        };
        
        // Update the HUD with player data
        playerHUD.update(gameState.player);
        
        // Save new player ID to localStorage
        savePlayerIDToStorage(data.player.playerID);
        
        // Show welcome message for new player
        showWelcomeMessage(true);
        
        return true;
      } else {
        console.error('Failed to create new player:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating new player:', error);
      return false;
    }
  }

  /**
   * Show welcome message to the player
   * @param {boolean} isNewPlayer - Whether this is a new player
   */
  function showWelcomeMessage(isNewPlayer) {
    // Create welcome message element
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'welcome-message';
    
    // Style the message element
    Object.assign(welcomeMsg.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px 20px',
      borderRadius: '8px',
      zIndex: '1000',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      fontSize: '16px',
      transition: 'opacity 0.5s ease-out',
      opacity: '1',
      textAlign: 'center'
    });
    
    // Set message content based on whether player is new or returning
    if (isNewPlayer) {
      welcomeMsg.textContent = `Welcome to Kowloon Tower, ${gameState.player.username}!`;
    } else {
      welcomeMsg.textContent = `Welcome back, ${gameState.player.username}!`;
    }
    
    // Add to document
    document.body.appendChild(welcomeMsg);
    
    // Remove after specified duration
    setTimeout(() => {
      welcomeMsg.style.opacity = '0';
      
      // Remove element after transition completes
      setTimeout(() => {
        if (welcomeMsg.parentNode) {
          document.body.removeChild(welcomeMsg);
        }
      }, 500);
    }, config.player.welcomeMessageDuration);
  }

  /**
   * Initialize player - checks localStorage and fetches or creates player as needed
   * @returns {Promise<void>}
   */
  async function initializePlayer() {
    // Check if player ID exists in localStorage
    const storedPlayerID = getPlayerIDFromStorage();
    if (storedPlayerID) {
      console.log('Found stored player ID:', storedPlayerID);
      
      // Try to fetch player data
      const playerFetched = await fetchPlayerData(storedPlayerID);
      
      if (!playerFetched) {
        console.log('Stored player not found in database, creating new player');
        // If player not found in database, create a new one
        await createNewPlayer();
      }
    } else {
      console.log('No player ID in storage, creating new player');
      // No stored player ID, create a new player
      await createNewPlayer();
    }
    
    // Log player state for debugging
    console.log('Player initialized:', gameState.player);
  }

  // Initialize the game
  function initGame() {
    resizeCanvas();
    
    // Initialize player first (async operation)
    initializePlayer().then(() => {
      // Once player is initialized, start game updates
      startAutoUpdates();
    });
    
    // Set up event listeners
    window.addEventListener('resize', resizeCanvas);
    
    // Mouse event listeners
    gameCanvas.addEventListener('click', handleCanvasClick);
    gameCanvas.addEventListener('mousedown', handlePanStart);
    gameCanvas.addEventListener('wheel', handleZoom, { passive: false });
    
    // Keyboard event listeners for arrow key navigation
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Add event listeners for space key
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        isSpaceDown = true;
        event.preventDefault();
      }
    }, true);
    
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        isSpaceDown = false;
        event.preventDefault();
      }
    }, true);
    
    // Prevent context menu on right click
    gameCanvas.addEventListener('contextmenu', event => event.preventDefault());
    
    // Touch event listeners for mobile
    gameCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameCanvas.addEventListener('touchend', handleTouchEnd);
    
    // Disable page scrolling when interacting with the canvas
    document.body.addEventListener('touchmove', function(e) {
      if (e.target === gameCanvas) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Update the CSS touch-action property programmatically
    document.body.style.touchAction = 'none';
    gameCanvas.style.touchAction = 'none';
    
    // Start the animation loop
    animateBackground();
  }
  
  // Start the game
  initGame();
});
