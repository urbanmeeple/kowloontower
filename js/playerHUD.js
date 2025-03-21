/**
 * Player HUD Component
 * Manages the player information display at the top of the screen
 */
class PlayerHUD {
  /**
   * Initialize the Player HUD
   * @param {Object} containerElement - DOM element to append the HUD to
   */
  constructor(containerElement) {
    // Create HUD container
    this.element = document.createElement('div');
    this.element.id = 'player-hud';
    containerElement.appendChild(this.element);
    
    // Initial player data structure
    this.playerData = {
      username: 'Loading...',
      money: 0,
      stock_housing: 0,
      stock_entertainment: 0, 
      stock_weapons: 0,
      stock_food: 0,
      stock_technical: 0,
      roomCount: 0
    };
    
    // Create HUD layout
    this.createHUDLayout();
    
    // Initial render with loading state
    this.update(this.playerData);
    
    // Log HUD initialization
    console.log('Player HUD initialized');
  }
  
  /**
   * Create the basic structure of the HUD
   */
  createHUDLayout() {
    // Create sections for different types of information
    const usernameSection = document.createElement('div');
    usernameSection.className = 'hud-section username-section';
    
    const moneySection = document.createElement('div');
    moneySection.className = 'hud-section money-section';
    
    const stocksSection = document.createElement('div');
    stocksSection.className = 'hud-section stocks-section';
    
    const roomsSection = document.createElement('div');
    roomsSection.className = 'hud-section rooms-section';
    
    // Add elements for each data point
    usernameSection.innerHTML = '<span class="label">Player:</span> <span id="player-username">Loading...</span>';
    
    moneySection.innerHTML = '<span class="label">Money:</span> <span id="player-money">0</span>';
    
    // Create stock displays with individual sectors
    stocksSection.innerHTML = `
      <span class="label">Stocks:</span>
      <span class="stock-item" id="stock-housing" title="Housing">🏠: <span>0</span></span>
      <span class="stock-item" id="stock-entertainment" title="Entertainment">🎭: <span>0</span></span>
      <span class="stock-item" id="stock-weapons" title="Weapons">🔫: <span>0</span></span>
      <span class="stock-item" id="stock-food" title="Food">🍔: <span>0</span></span>
      <span class="stock-item" id="stock-technical" title="Technical">⚙️: <span>0</span></span>
    `;
    
    roomsSection.innerHTML = '<span class="label">Rooms:</span> <span id="player-rooms">0</span>';
    
    // Add sections to HUD
    this.element.appendChild(usernameSection);
    this.element.appendChild(moneySection);
    this.element.appendChild(stocksSection);
    this.element.appendChild(roomsSection);
  }
  
  /**
   * Format currency values for display
   * @param {number} amount - The monetary amount to format
   * @return {string} Formatted currency string
   */
  formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  /**
   * Update the HUD with new player data
   * @param {Object} playerData - Object containing player information
   */
  update(playerData) {
    // Merge new data with existing data (to handle partial updates)
    this.playerData = { ...this.playerData, ...playerData };
    
    // Update DOM elements with new data
    document.getElementById('player-username').textContent = this.playerData.username;
    document.getElementById('player-money').textContent = this.formatMoney(this.playerData.money);
    
    // Update stock values
    const housingStock = document.querySelector('#stock-housing span');
    const entertainmentStock = document.querySelector('#stock-entertainment span');
    const weaponsStock = document.querySelector('#stock-weapons span');
    const foodStock = document.querySelector('#stock-food span');
    const technicalStock = document.querySelector('#stock-technical span');
    
    housingStock.textContent = this.playerData.stock_housing;
    entertainmentStock.textContent = this.playerData.stock_entertainment;
    weaponsStock.textContent = this.playerData.stock_weapons;
    foodStock.textContent = this.playerData.stock_food;
    technicalStock.textContent = this.playerData.stock_technical;
    
    // Update room count
    document.getElementById('player-rooms').textContent = this.playerData.roomCount;
    
    console.log('HUD updated with new player data');
  }
}

// Export the PlayerHUD class for global access
window.PlayerHUD = PlayerHUD;
