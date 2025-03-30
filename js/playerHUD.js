import { renderGame } from './render.js';
import { getLocalGameState } from './state.js';
import { roomPopup } from './roomPopup.js'; // Import roomPopup to update buttons

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
    this.timerInterval = null;
    this.remainingTime = 0; // Remaining time in seconds
    this.cronJobInterval = 60; // Default value, will be updated in resetTimer

    // Create HUD layout
    this.createHUDLayout();

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

    // Create countdown timer section
    const timerSection = document.createElement('div');
    timerSection.className = 'hud-section timer-section';

    // Create active bids section
    const bidsSection = document.createElement('div');
    bidsSection.className = 'hud-section bids-section';

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

    // Active bids display
    bidsSection.innerHTML = '<span class="label">Active Bids:</span> <span id="active-bids-count">0</span> (<span id="active-bids-amount">$0</span>)';

    // Timer display
    timerSection.innerHTML = '<span class="label">Next Day In:</span> <span id="countdown-timer" class="timer-normal">00</span>';

    // Add sections to HUD
    this.element.appendChild(usernameSection);
    this.element.appendChild(moneySection);
    this.element.appendChild(stocksSection);
    this.element.appendChild(roomsSection);
    this.element.appendChild(bidsSection);
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
    // Update DOM elements with new data
    document.getElementById('player-username').textContent = playerData.username;
    document.getElementById('player-money').textContent = this.formatMoney(playerData.money);

    // Update stock values
    const housingStock = document.querySelector('#stock-housing span');
    const entertainmentStock = document.querySelector('#stock-entertainment span');
    const weaponsStock = document.querySelector('#stock-weapons span');
    const foodStock = document.querySelector('#stock-food span');
    const technicalStock = document.querySelector('#stock-technical span');

    housingStock.textContent = playerData.stock_housing;
    entertainmentStock.textContent = playerData.stock_entertainment;
    weaponsStock.textContent = playerData.stock_weapons;
    foodStock.textContent = playerData.stock_food;
    technicalStock.textContent = playerData.stock_technical;

    // Update room count
    document.getElementById('player-rooms').textContent = playerData.roomCount || 0;

    // Update active bids information
    if (playerData.activeBids) {
      // Filter out bids with status "old_winner" or "old_loser"
      const activeBids = playerData.activeBids.filter(
        bid => bid.status !== 'old_winner' && bid.status !== 'old_loser'
      );

      const activeBidsCount = activeBids.length;
      const activeBidsAmount = activeBids.reduce((total, bid) => total + bid.amount, 0);

      document.getElementById('active-bids-count').textContent = activeBidsCount;
      document.getElementById('active-bids-amount').textContent = this.formatMoney(activeBidsAmount);

      // Add visual indicator if there are active bids
      const bidsSection = document.querySelector('.bids-section');
      if (activeBidsCount > 0) {
        bidsSection.style.color = '#4CAF50'; // Green color when bids are active
      } else {
        bidsSection.style.color = ''; // Reset to default color
      }
    }

    console.log('HUD updated with new player data');
  }

  /**
   * Reset the countdown timer based on the last server update and cron job interval
   * @param {number} lastCacheTimestamp - The timestamp of the last server cache creation
   * @param {number} cronJobInterval - The interval between cron job runs in seconds
   */
  resetTimer(lastCacheTimestamp, cronJobInterval) {
    const TIMER_OFFSET = 5; // Offset in seconds to start the timer earlier
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const elapsedTime = now - lastCacheTimestamp; // Time elapsed since last cache creation
    this.remainingTime = Math.max(cronJobInterval - elapsedTime - TIMER_OFFSET, 0); // Adjusted remaining time
    this.cronJobInterval = cronJobInterval; // Store interval for percentage calculations

    console.log(`Timer reset: Cache timestamp=${lastCacheTimestamp}, Now=${now}, Elapsed=${elapsedTime}, Remaining=${this.remainingTime}`);

    // Update the timer display immediately
    this.updateTimerDisplay();

    // Clear any existing interval
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Start the countdown timer
    this.timerInterval = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.updateTimerDisplay();
      } else {
        clearInterval(this.timerInterval); // Stop the timer when it reaches 0
        renderGame(getLocalGameState().rooms); // Re-render the game
        roomPopup.updatePopupButtons(); // Update popup buttons when timer reaches 0
      }
    }, 1000);
  }

  /**
   * Update the timer display and apply styling based on the remaining time
   */
  updateTimerDisplay() {
    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return;

    // Update the timer text
    timerElement.textContent = this.remainingTime;

    // If timer has reached zero, apply blinking animation
    if (this.remainingTime <= 0) {
      timerElement.className = 'timer-zero'; // Apply blinking animation
      return; // Exit early as we don't need to calculate percentages
    }

    // Calculate percentage of time remaining (as a decimal)
    const percentageRemaining = this.remainingTime / this.cronJobInterval;
    
    // Define thresholds as percentages
    const HALFWAY_THRESHOLD = 0.5;  // 50% of cronJobInterval
    const CRITICAL_THRESHOLD = 0.25; // 25% of cronJobInterval

    // Apply styling based on percentage thresholds
    if (percentageRemaining > HALFWAY_THRESHOLD) {
      timerElement.className = 'timer-fresh'; // White color (more than 50% left)
    } else if (percentageRemaining > CRITICAL_THRESHOLD) {
      timerElement.className = 'timer-warning'; // Orange color (49-25% left)
    } else {
      timerElement.className = 'timer-critical'; // Red color and larger (less than 25% left)
    }
    
    // Log only at specific intervals to avoid console spam
    if (this.remainingTime % 5 === 0 || this.remainingTime <= 10) {
      console.log(`Timer update: ${this.remainingTime}s remaining (${Math.round(percentageRemaining * 100)}% of interval)`);
    }
  }

  /**
   * Check if the timer is at 0
   * @returns {boolean} True if the timer is at 0, false otherwise
   */
  isTimerAtZero() {
    return this.remainingTime === 0;
  }
}

// Export the PlayerHUD class and isTimerAtZero function for global access
export const playerHUD = new PlayerHUD(document.body);
export const isTimerAtZero = () => playerHUD.isTimerAtZero();
