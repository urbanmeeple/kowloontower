document.addEventListener('DOMContentLoaded', () => {
  // Game configuration
  const config = {
    gridWidth: 20, // Number of cells horizontally
    gridHeight: 30, // Number of cells vertically
    cellSize: 20,   // Size of each cell in pixels
    colors: {
      background: {
        from: '#FF5555', // Red
        to: '#5555FF'    // Blue
      },
      grid: '#333333',   // Grid line color
      room: '#FFCC00'    // Room color
    }
  };

  // Game state
  let gameState = {
    grid: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(0)),
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
    gridOffsetX = (gameTwo.width - (config.gridWidth * config.cellSize)) / 2;
    gridOffsetY = (gameTwo.height - (config.gridHeight * config.cellSize)) / 2;
  }

  // Initialize the grid offset
  updateGridOffset();
  
  // Rendering functions
  function renderBackground() {
    backgroundTwo.clear();
    
    // Create animated gradient background
    const gradient = backgroundTwo.makeLinearGradient(
      0, 0,                        // x1, y1
      backgroundTwo.width, backgroundTwo.height,  // x2, y2
      new Two.Stop(0, config.colors.background.from),
      new Two.Stop(1, config.colors.background.to)
    );
    
    const background = backgroundTwo.makeRectangle(
      backgroundTwo.width / 2,
      backgroundTwo.height / 2,
      backgroundTwo.width,
      backgroundTwo.height
    );
    
    background.fill = gradient;
    background.noStroke();
    
    backgroundTwo.update();
  }
  
  function renderGame() {
    gameTwo.clear();
    
    // Draw grid lines
    for (let x = 0; x <= config.gridWidth; x++) {
      const line = gameTwo.makeLine(
        gridOffsetX + x * config.cellSize, 
        gridOffsetY, 
        gridOffsetX + x * config.cellSize, 
        gridOffsetY + config.gridHeight * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
    }
    
    for (let y = 0; y <= config.gridHeight; y++) {
      const line = gameTwo.makeLine(
        gridOffsetX, 
        gridOffsetY + y * config.cellSize, 
        gridOffsetX + config.gridWidth * config.cellSize, 
        gridOffsetY + y * config.cellSize
      );
      line.stroke = config.colors.grid;
      line.linewidth = 1;
    }
    
    // Draw rooms
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        if (gameState.grid[y][x] === 1) {
          const room = gameTwo.makeRectangle(
            gridOffsetX + x * config.cellSize + config.cellSize / 2, 
            gridOffsetY + y * config.cellSize + config.cellSize / 2,
            config.cellSize - 2, 
            config.cellSize - 2
          );
          room.fill = config.colors.room;
          room.noStroke();
        }
      }
    }
    
    gameTwo.update();
  }
  
  // Animation loop for the background gradient
  let animationPhase = 0;
  function animateBackground() {
    animationPhase += 0.005;
    
    // Shift the gradient colors over time
    const from = `hsl(${(Math.sin(animationPhase) * 60 + 0) % 360}, 80%, 60%)`;
    const to = `hsl(${(Math.sin(animationPhase + 2) * 60 + 240) % 360}, 80%, 60%)`;
    
    config.colors.background.from = from;
    config.colors.background.to = to;
    
    renderBackground();
    requestAnimationFrame(animateBackground);
  }
  
  // Handle user interactions
  function handleCanvasClick(event) {
    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to grid coordinates
    const gridX = Math.floor((mouseX - gridOffsetX) / config.cellSize);
    const gridY = Math.floor((mouseY - gridOffsetY) / config.cellSize);
    
    // Check if click is within grid bounds
    if (gridX >= 0 && gridX < config.gridWidth && 
        gridY >= 0 && gridY < config.gridHeight) {
      // Only allow adding a room to an empty cell
      if (gameState.grid[gridY][gridX] === 0) {
        gameState.grid[gridY][gridX] = 1;
        renderGame();
        saveGameState();
      }
    }
  }
  
  // Fetch the current game state from the server
  async function fetchGameState() {
    try {
      const response = await fetch('api/gameState.php');
      const data = await response.json();
      
      if (data.grid) {
        gameState.grid = data.grid;
        gameState.lastUpdate = new Date();
        renderGame();
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
          grid: gameState.grid
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
  
  // Initialize the game
  fetchGameState();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  gameCanvas.addEventListener('click', handleCanvasClick);
  
  // Start the animation loop
  animateBackground();
});
