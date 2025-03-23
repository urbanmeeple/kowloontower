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

  // Initialize the room popup
  const roomPopup = new RoomPopup();

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
  
  // NEW CONFIG: remove zoom and horizontal pan. Define game view boundaries.
  const cellSize = config.cellSize;
  // Increase bottom padding to 100 grid cell sizes.
  const gameView = {
    left: -100 * cellSize,
    top: -20 * cellSize,
    width: config.gridWidth * cellSize + 200 * cellSize,    // Extra 100 cells each side
    height: config.gridHeight * cellSize + (20 + 100) * cellSize  // Extra 20 top, 100 bottom
  };
  // Set initial verticalPan so that the tower grid center (at y = 20*cellSize + gridHeight/2*cellSize) 
  // is centered on screen. For example, if gameCanvas height is 600, tower grid center = 20*20 + 30*20/2 = 400+300 = 700,
  // then verticalPan = 600/2 - 700 = -400.
  let verticalPan = -400; 
  // Compute horizontal translation to center tower grid on screen:
  function fixedHorizontal() {
    return gameCanvas.width/2 - (100 * cellSize + (config.gridWidth * cellSize)/2);
  }
  // Adjusted clampVerticalPan with updated gameView:
  function clampVerticalPan(vPan) {
    const minPan = gameCanvas.height - (gameView.top + gameView.height); // lowest: game view bottom touches screen bottom.
    const maxPan = -gameView.top; // highest: game view top touches screen top.
    return Math.max(minPan, Math.min(maxPan, vPan));
  }
  
  // REMAKE renderGame: remove old pan/zoom logic.
  // Now create a parent group with fixed horizontal translation and verticalPan.
  function renderGame() {
    gameTwo.clear();
    
    // Parent group: translates the entire game view.
    const parentGroup = new Two.Group();
    parentGroup.translation.set(fixedHorizontal(), verticalPan);
    
    // Create the ground rectangle.
    const towerBottom = 20 * cellSize + config.gridHeight * cellSize; // tower grid bottom (in game view)
    const groundTop = towerBottom;  // Immediately below the tower grid.
    const groundBottom = gameView.top + gameView.height; // Bottom of the game view.
    const groundHeight = groundBottom - groundTop;
    const groundCenterX = gameView.left + gameView.width / 2;
    const groundCenterY = groundTop + groundHeight / 2;
    const groundRect = new Two.Rectangle(groundCenterX, groundCenterY, gameView.width, groundHeight);
    groundRect.fill = config.colors.ground;
    groundRect.noStroke();
    // Add ground rectangle first so it appears behind the tower grid.
    parentGroup.add(groundRect);
    
    // Child group for the tower grid.
    const gridGroup = new Two.Group();
    gridGroup.translation.set(100 * cellSize, 20 * cellSize);
    
    // Draw grid lines for tower grid.
    for (let x = 0; x <= config.gridWidth; x++) {
      const line = new Two.Line(
        x * cellSize, 0, 
        x * cellSize, config.gridHeight * cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gridGroup.add(line);
    }
    for (let y = 0; y <= config.gridHeight; y++) {
      const line = new Two.Line(
        0, y * cellSize, 
        config.gridWidth * cellSize, y * cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
      gridGroup.add(line);
    }
    
    // Draw rooms and selections on the tower grid (positions relative to gridGroup).
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        const roomData = gameState.grid[y][x];
        if (roomData) {
          const roomX = x * cellSize + cellSize/2;
          const roomY = y * cellSize + cellSize/2;
          const roomSize = cellSize - 2;
          if (roomData.status === 'constructed') {
            const room = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
            room.fill = config.colors.room;
            room.noStroke();
            gridGroup.add(room);
            // Add sector icon...
            const sectorType = roomData.type || 'default';
            const icon = sectorIcons[sectorType] || sectorIcons.default;
            const iconText = new Two.Text(icon, roomX, roomY, {
              size: cellSize * 0.8, // fixed size (no zoom)
              alignment: 'center',
              baseline: 'middle',
              style: 'normal',
              family: 'Arial'
            });
            iconText.fill = '#FFFFFF';
            gridGroup.add(iconText);
          } else if (roomData.status === 'planned') {
            const plannedRoom = new Two.Rectangle(roomX, roomY, roomSize, roomSize);
            plannedRoom.fill = 'rgba(255, 0, 0, 0.2)';
            plannedRoom.stroke = '#FF0000';
            plannedRoom.linewidth = 2;
            gridGroup.add(plannedRoom);
            const sectorType = roomData.type || 'default';
            const icon = sectorIcons[sectorType] || sectorIcons.default;
            const iconText = new Two.Text(icon, roomX, roomY, {
              size: cellSize * 0.8,
              alignment: 'center',
              baseline: 'middle',
              style: 'normal',
              family: 'Arial'
            });
            iconText.fill = 'rgba(255, 255, 255, 0.5)';
            gridGroup.add(iconText);
          }
        }
      }
    }
    
    parentGroup.add(gridGroup);
    gameTwo.add(parentGroup);
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
  
  // NEW key handler: Only arrow up/down move verticalPan.
  function handleArrowKeys(event) {
    const panStep = 15; // pixels
    if (event.key === 'ArrowUp') {
      verticalPan += panStep;
      verticalPan = clampVerticalPan(verticalPan);
      renderGame();
    } else if (event.key === 'ArrowDown') {
      verticalPan -= panStep;
      verticalPan = clampVerticalPan(verticalPan);
      renderGame();
    }
  }
  
  // NEW touch handlers for vertical panning.
  let touchStartY = 0;
  let initialVerticalPan = 0;
  function handleTouchStart(event) {
    if (event.touches.length === 1) {
      touchStartY = event.touches[0].clientY;
      initialVerticalPan = verticalPan;
    }
  }
  function handleTouchMove(event) {
    if (event.touches.length === 1) {
      const deltaY = event.touches[0].clientY - touchStartY;
      verticalPan = clampVerticalPan(initialVerticalPan + deltaY);
      renderGame();
    }
    event.preventDefault();
  }
  function handleTouchEnd(event) {
    // Nothing additional needed.
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

        if (data.grid) {
          // Store next update time if provided
          if (data.nextUpdateTime) {
            config.nextUpdateTime = new Date(data.nextUpdateTime);
            
            // Calculate time until next update
            const timeUntilUpdate = config.nextUpdateTime - new Date();
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
    
    // NEW key listener for vertical panning:
    window.addEventListener('keydown', handleArrowKeys);
    
    // NEW touch listeners for vertical panning:
    gameCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameCanvas.addEventListener('touchend', handleTouchEnd);
    
    // Add right click / long press handler
    addRoomClickHandler();
    
    // Start the animation loop
    animateBackground();
  }
  
  // Add a handler for right click (desktop) or long touch (mobile) to show room details
  function addRoomClickHandler() {
    let touchTimer;
    const longPressDelay = 500; // milliseconds

    // Function to handle showing the room popup
    async function showRoomDetails(gridX, gridY) {
      const roomData = gameState.grid[gridY][gridX];
      if (roomData) {
        let owner = null;
        if (roomData.status === 'constructed') {
          // Fetch owner information (replace with actual API endpoint)
          owner = await fetchRoomOwner(roomData.roomID);
        }
        roomPopup.show(roomData, owner);
      }
    }

    // Function to fetch room owner (dummy implementation)
    async function fetchRoomOwner(roomID) {
      // Replace with actual API call to fetch owner details
      // Example: const response = await fetch(`api/roomOwner.php?roomID=${roomID}`);
      // and return the player object
      return { username: 'PlayerName' }; // Dummy data
    }

    // Desktop right click handler
    gameCanvas.addEventListener('contextmenu', function(event) {
      event.preventDefault(); // Prevent default context menu
      const rect = gameCanvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const gridPos = screenToGrid(mouseX, mouseY);

      if (gridPos.x >= 0 && gridPos.x < config.gridWidth &&
          gridPos.y >= 0 && gridPos.y < config.gridHeight) {
        showRoomDetails(gridPos.x, gridPos.y);
      }
    });

    // Mobile touch handlers
    gameCanvas.addEventListener('touchstart', function(event) {
      if (event.touches.length === 1) {
        // Start timer for long press
        touchTimer = setTimeout(function() {
          const rect = gameCanvas.getBoundingClientRect();
          const touchX = event.touches[0].clientX - rect.left;
          const touchY = event.touches[0].clientY - rect.top;
          const gridPos = screenToGrid(touchX, touchY);

          if (gridPos.x >= 0 && gridPos.x < config.gridWidth &&
              gridPos.y >= 0 && gridPos.y < config.gridHeight) {
            showRoomDetails(gridPos.x, gridPos.y);
          }
        }, longPressDelay);
      }
    });

    gameCanvas.addEventListener('touchend', function(event) {
      clearTimeout(touchTimer); // Cancel timer if touch ends before the delay
    });

    gameCanvas.addEventListener('touchcancel', function(event) {
      clearTimeout(touchTimer); // Also clear timer on touch cancel
    });
  }
  
  // Start the game
  initGame();
});
