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
    
    // Timer variables
    this.lastUpdateTime = Date.now();
    this.timerInterval = null;
    
    // Constants for update timing (in milliseconds)
    this.ESTIMATED_UPDATE_INTERVAL = 60 * 1000; // One minute in milliseconds
    this.WARNING_THRESHOLD_PERCENT = 50; // 50% of the update interval
    this.CRITICAL_THRESHOLD_PERCENT = 75; // 75% of the update interval
    
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
    
    // Start the update timer
    this.startUpdateTimer();
    
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
    
    // Create update timer section
    const timerSection = document.createElement('div');
    timerSection.className = 'hud-section timer-section';
    
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
    
    // Timer display with minutes and seconds
    timerSection.innerHTML = '<span class="label">Since update:</span> <span id="update-timer" class="timer-fresh">00:00</span>';
    
    // Add sections to HUD
    this.element.appendChild(usernameSection);
    this.element.appendChild(moneySection);
    this.element.appendChild(stocksSection);
    this.element.appendChild(roomsSection);
    this.element.appendChild(timerSection);
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

  /**
   * Set the timer based on a server timestamp
   * @param {number|string} serverTimestamp - Unix timestamp or ISO date string from server
   */
  setTimerFromServer(serverTimestamp) {
    if (!serverTimestamp) return;
    
    let timestamp;
    
    // If serverTimestamp is a string (ISO date), convert to timestamp
    if (typeof serverTimestamp === 'string') {
      // Parse ISO date string (with timezone info)
      timestamp = new Date(serverTimestamp).getTime();
      console.log('Parsed ISO date string to timestamp:', timestamp);
    } else {
      // If it's already a Unix timestamp (seconds), convert to milliseconds
      timestamp = serverTimestamp * 1000;
      console.log('Converted Unix timestamp to milliseconds:', timestamp);
    }
    
    // Only update if the timestamp is valid
    if (!isNaN(timestamp) && timestamp > 0) {
      // Add debug info to help diagnose any remaining issues
      const now = Date.now();
      const diff = now - timestamp;
      const diffMinutes = Math.floor(diff / 60000);
      const diffSeconds = Math.floor((diff % 60000) / 1000);
      
      console.log('Current time (client):', new Date(now).toISOString());
      console.log('Server update time:', new Date(timestamp).toISOString());
      console.log(`Time difference: ${diffMinutes} minutes, ${diffSeconds} seconds`);
      
      this.lastUpdateTime = timestamp;
      this.updateTimerDisplay();
      
      // Log timer setting with clear format for debugging
      console.log('Timer set from server timestamp:', 
                  new Date(timestamp).toISOString(), 
                  `(${Math.floor((now - timestamp)/1000)} seconds ago)`);
    } else {
      console.warn('Invalid server timestamp:', serverTimestamp);
    }
  }
  
  /**
   * Start the timer that tracks time since last update
   */
  startUpdateTimer() {
    // Clear any existing timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // Update display immediately
    this.updateTimerDisplay();
    
    // Start interval to update the timer every second
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  }
  
  /**
   * Update the timer display with current elapsed time and apply styling
   */
  updateTimerDisplay() {
    const timerElement = document.getElementById('update-timer');
    if (!timerElement) return;
    
    // Get current timestamp in milliseconds
    const now = Date.now();
    
    // Calculate elapsed time (ensuring we're dealing with UTC consistently)
    const elapsedMilliseconds = now - this.lastUpdateTime;
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    
    // Calculate minutes and seconds for display
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    // Format as MM:SS
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerElement.textContent = timeString;
    
    // Calculate percentage of estimated update interval that has elapsed
    const elapsedPercent = (elapsedMilliseconds / this.ESTIMATED_UPDATE_INTERVAL) * 100;
    
    // Update timer styling based on elapsed percentage
    if (elapsedPercent < this.WARNING_THRESHOLD_PERCENT) {
      // Fresh: Green (below 50% of update interval)
      timerElement.className = 'timer-fresh';
    } else if (elapsedPercent < this.CRITICAL_THRESHOLD_PERCENT) {
      // Warning: Orange (between 50% and 75% of update interval)
      timerElement.className = 'timer-warning';
    } else {
      // Critical: Red with larger font (above 75% of update interval)
      timerElement.className = 'timer-critical';
    }
  }
  
  /**
   * Reset the update timer (called when game state is updated)
   */
  resetUpdateTimer() {
    this.lastUpdateTime = Date.now();
    
    // Update display immediately
    this.updateTimerDisplay();
    
    console.log('Update timer reset');
  }
}

// Export the PlayerHUD class for global access
window.PlayerHUD = PlayerHUD;
