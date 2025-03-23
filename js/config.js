// This file defines configuration constants, initial game state, and helper constants.
export const config = {
  gridWidth: 20, // Number of cells horizontally
  gridHeight: 30, // Number of cells vertically
  cellSize: 20, // Size of each cell in pixels
  colors: {
    background: { top: '#FFEB3B', brightness: 1.0 },
    grid: '#333333',
    room: '#000000',
    selected: '#00000066',
    ground: '#8B4513'
  },
  // All view numbers are defined as constants below to avoid magic numbers.
  view: {
    zoom: 1,
    minZoom: 0.2,
    maxZoom: 3,
    zoomStep: 0.1,
    panX: 0,
    panY: 0,
    isPanning: false,
    lastX: 0,
    lastY: 0,
    keyPanAmount: 15, // pixels per key press
    keysPressed: {}
  },
  updateInterval: 10000, // 10 seconds
  lastStateTimestamp: null,
  nextUpdateTime: null,
  player: {
    welcomeMessageDuration: 5000, // milliseconds
    storageKey: 'kowloonTowerPlayerID'
  }
};

export const gameState = {
  grid: Array(config.gridHeight).fill().map(() => Array(config.gridWidth).fill(null)),
  lastUpdate: null,
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

export const sectorIcons = {
  housing: '🏠',
  entertainment: '🎭',
  weapons: '🔫',
  food: '🍔',
  technical: '⚙️',
  default: '🏢'
};
