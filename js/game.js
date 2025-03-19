document.addEventListener('DOMContentLoaded', () => {
  // Game configuration
  const config = {
    gridWidth: 20, // Number of cells horizontally
    gridHeight: 30, // Number of cells vertically
    cellSize: 20,   // Size of each cell in pixels
    colors: {
      background: {
        top: '#FFEB3B',    // Yellow for top
        bottom: '#4CAF50', // Green for bottom
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
      minZoom: 0.5,      // Minimum zoom level
      maxZoom: 3,        // Maximum zoom level
      zoomStep: 0.1,     // Zoom step size
      panX: 0,           // Initial pan X offset
      panY: 0,           // Initial pan Y offset
      isPanning: false,  // Flag to track panning state
      lastX: 0,          // Last mouse/touch X position
      lastY: 0           // Last mouse/touch Y position
    },
    // Auto-update settings
    updateInterval: 10000, // Check for updates every 10 seconds
    lastStateTimestamp: null // Track when we last received a state update
  };

  // Game state with selected cells and rooms
  let gameState = {
    grid: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(0)),
    selected: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(0)),
    lastUpdate: null
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
    
    // Get the current brightness factor
    const brightness = config.colors.background.brightness;
    
    // Apply brightness to base colors
    const topColor = adjustBrightness(config.colors.background.top, brightness);
    const bottomColor = adjustBrightness(config.colors.background.bottom, brightness);

    // Using a different approach with rectangle shape for more reliable gradient rendering
    const bgHeight = backgroundTwo.height;
    const bgWidth = backgroundTwo.width;
    
    // Create a full-screen rectangle with the gradient
    // This approach is more direct and should ensure the gradient is fully visible
    const bgRect = backgroundTwo.makeRectangle(
      bgWidth / 2, 
      bgHeight / 2, 
      bgWidth, 
      bgHeight
    );
    
    // Create a vertical gradient from bottom to top
    const gradient = backgroundTwo.makeLinearGradient(
      bgWidth / 2, 0,          // x1, y1 (top center)
      bgWidth / 2, bgHeight,   // x2, y2 (bottom center)
      new Two.Stop(0.0, topColor),        // Yellow at top
      new Two.Stop(0.6, topColor),        // Yellow through 60% of the gradient
      new Two.Stop(0.8, bottomColor),     // Start transition to green
      new Two.Stop(1.0, bottomColor)      // Full green at bottom
    );
    
    bgRect.fill = gradient;
    bgRect.noStroke();
    
    backgroundTwo.update();
  }
  
  // Helper function to mix colors for smoother gradient
  function mixColors(color1, color2, ratio) {
    // Convert hex to RGB
    let r1 = parseInt(color1.slice(1, 3), 16);
    let g1 = parseInt(color1.slice(3, 5), 16);
    let b1 = parseInt(color1.slice(5, 7), 16);
    
    let r2 = parseInt(color2.slice(1, 3), 16);
    let g2 = parseInt(color2.slice(3, 5), 16);
    let b2 = parseInt(color2.slice(5, 7), 16);
    
    // Mix colors
    let r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    let g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    let b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
    
    // Draw ground line - thicker line at the bottom of the grid
    const groundLine = new Two.Line(
      -20, // Extend beyond grid left
      config.gridHeight * config.cellSize + 5, // 5px below grid bottom
      config.gridWidth * config.cellSize + 20, // Extend beyond grid right
      config.gridHeight * config.cellSize + 5
    );
    groundLine.stroke = config.colors.ground;
    groundLine.linewidth = 5; // Thicker line
    gameGroup.add(groundLine);
    
    // Draw selected spaces (transparent) and rooms (solid)
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        // Draw room (solid color) if there's a constructed room
        if (gameState.grid[y][x] === 1) {
          const room = new Two.Rectangle(
            x * config.cellSize + config.cellSize / 2, 
            y * config.cellSize + config.cellSize / 2,
            config.cellSize - 2, 
            config.cellSize - 2
          );
          room.fill = config.colors.room;
          room.noStroke();
          gameGroup.add(room);
        } 
        // Draw selected space (transparent color) if the space is selected
        else if (gameState.selected[y][x] === 1) {
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
      if (gameState.grid[gridPos.y][gridPos.x] === 0 && 
          gameState.selected[gridPos.y][gridPos.x] === 0) {
        // Mark as selected instead of creating a room immediately
        gameState.selected[gridPos.y][gridPos.x] = 1;
        renderGame();
        saveGameState();
      }
    }
  }
  
  // Pan start handler
  function handlePanStart(event) {
    // Get the coordinates (mouse or touch)
    let clientX, clientY;
    if (event.type.includes('mouse')) {
      clientX = event.clientX;
      clientY = event.clientY;
      
      // Only start panning on middle mouse or right mouse button
      if (event.button !== 1 && event.button !== 2) return;
      
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
    
    const minPanX = -gridWidthPixels + gameCanvas.width - gridOffsetX;
    const maxPanX = -gridOffsetX;
    const minPanY = -gridHeightPixels + gameCanvas.height - gridOffsetY;
    const maxPanY = -gridOffsetY;
    
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
    
    // Calculate new zoom level (with min/max limits)
    const newZoom = Math.max(
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
    
    // Redraw
    renderGame();
  }
  
  // Handle pinch-to-zoom on mobile
  let initialDistance = 0;
  let initialZoom = 1;
  
  function handleTouchStart(event) {
    if (event.touches.length === 2) {
      // Two fingers - pinch-to-zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate the initial distance between touches
      initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      initialZoom = config.view.zoom;
      
      // Prevent default to avoid browser zooming
      event.preventDefault();
    } else if (event.touches.length === 1) {
      // Single touch - handle as potential pan
      handlePanStart(event);
    }
  }
  
  function handleTouchMove(event) {
    if (event.touches.length === 2) {
      // Pinch-to-zoom in progress
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate current distance
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Calculate zoom ratio
      const zoomRatio = currentDistance / initialDistance;
      
      // Get center point of the two touches
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      // Calculate coordinates relative to canvas
      const rect = gameCanvas.getBoundingClientRect();
      const mouseX = centerX - rect.left;
      const mouseY = centerY - rect.top;
      
      // Calculate new zoom level (with min/max limits)
      const newZoom = Math.max(
        config.view.minZoom, 
        Math.min(config.view.maxZoom, initialZoom * zoomRatio)
      );
      
      // Calculate the zoom point in world coordinates before zoom
      const worldX = (mouseX - gridOffsetX - config.view.panX) / config.view.zoom;
      const worldY = (mouseY - gridOffsetY - config.view.panY) / config.view.zoom;
      
      // Apply new zoom
      config.view.zoom = newZoom;
      
      // Calculate the new pan values to keep the zoom centered on pinch center
      config.view.panX = mouseX - gridOffsetX - (worldX * newZoom);
      config.view.panY = mouseY - gridOffsetY - (worldY * newZoom);
      
      // Redraw
      renderGame();
      
      // Prevent default to avoid browser zooming/scrolling
      event.preventDefault();
    } else if (config.view.isPanning) {
      // Single touch - handle as pan
      handlePanMove(event);
    }
  }
  
  function handleTouchEnd(event) {
    // If there are fewer than 2 touches left and we were pinching
    if (event.touches.length < 2) {
      initialDistance = 0;
    }
    
    // If no more touches, end any panning
    if (event.touches.length === 0) {
      handlePanEnd(event);
    }
  }
  
  // Handle double tap to reset view
  let lastTapTime = 0;
  function handleDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    
    if (tapLength < 500 && tapLength > 0) {
      // Double tap detected - reset view
      config.view.zoom = 1;
      config.view.panX = 0;
      config.view.panY = 0;
      renderGame();
      
      event.preventDefault();
    }
    
    lastTapTime = currentTime;
  }
  
  // Fetch the current game state from the server
  async function fetchGameState() {
    try {
      const response = await fetch('api/gameState.php');
      const data = await response.json();
      
      if (data.grid) {
        // Check if the grid or selected spaces have changed
        let hasChanged = false;
        
        // Compare with existing grid and selected spaces
        if (gameState.grid && gameState.grid.length > 0) {
          // Check if grid has changed
          const gridChanged = JSON.stringify(data.grid) !== JSON.stringify(gameState.grid);
          
          // Check if selected spaces have changed (if present in data)
          const selectedChanged = data.selected && 
            JSON.stringify(data.selected) !== JSON.stringify(gameState.selected);
          
          hasChanged = gridChanged || selectedChanged;
        } else {
          // First load or empty grid
          hasChanged = true;
        }
        
        // Only update the UI if something has changed
        if (hasChanged) {
          console.log("Game state updated from server");
          gameState.grid = data.grid;
          
          // Update selected spaces if present in data
          if (data.selected) {
            gameState.selected = data.selected;
          }
          
          gameState.lastUpdate = new Date();
          renderGame();
        }
        
        // Store last update timestamp
        config.lastStateTimestamp = data.timestamp || new Date().getTime();
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  }
  
  // Save the game state to the server
  async function saveGameState() {
    try {
      const response = await fetch('api/saveState.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grid: gameState.grid,
          selected: gameState.selected
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        console.error('Error saving game state:', data.error);
      }
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }
  
  // Periodically check for updates
  function startAutoUpdates() {
    // Initial fetch
    fetchGameState();
    
    // Set up interval for periodic updates
    setInterval(() => {
      fetchGameState();
    }, config.updateInterval);
  }
  
  // Initialize the game
  function initGame() {
    resizeCanvas();
    startAutoUpdates();
    
    // Set up event listeners
    window.addEventListener('resize', resizeCanvas);
    
    // Mouse event listeners
    gameCanvas.addEventListener('click', handleCanvasClick);
    gameCanvas.addEventListener('mousedown', handlePanStart);
    gameCanvas.addEventListener('wheel', handleZoom, { passive: false });
    
    // Prevent context menu on right click
    gameCanvas.addEventListener('contextmenu', event => event.preventDefault());
    
    // Touch event listeners for mobile
    gameCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameCanvas.addEventListener('touchend', handleTouchEnd);
    gameCanvas.addEventListener('touchstart', handleDoubleTap);
    
    // Start the animation loop
    animateBackground();
  }
  
  // Start the game
  initGame();
});
