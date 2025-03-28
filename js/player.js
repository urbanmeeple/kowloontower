// This file contains functions to manage the player including fetching, creation, and initialization.
import { config } from './config.js.php';
import { playerHUD } from './playerHUD.js'; // Assumes playerHUD.js exports an instance

// Local player state to replace gameState.player usage
let playerState = {
    playerID: null,
    username: '',
    money: 0,
    roomCount: 0,
    isNewPlayer: false,
    stock_housing: 0,
    stock_entertainment: 0,
    stock_weapons: 0, 
    stock_food: 0,
    stock_technical: 0,
    activeBids: [] // Track active bids placed by the player
};

/**
 * Get current player state
 * @returns {Object} The current player state
 */
export function getPlayerState() {
    return playerState;
}

/**
 * Calculate the total amount of money in active bids
 * @returns {number} Total money currently in active bids
 */
export function getTotalActiveBidsAmount() {
    return playerState.activeBids.reduce((total, bid) => total + bid.amount, 0);
}

/**
 * Calculate the player's available money (total minus active bids)
 * @returns {number} Available money to spend
 */
export function getAvailableMoney() {
    return playerState.money - getTotalActiveBidsAmount();
}

/**
 * Place a new bid for a room
 * @param {string} type - Type of bid ('construct' or 'buy')
 * @param {number} roomID - ID of the room being bid on
 * @param {number} amount - Amount of money to bid
 * @returns {Promise<boolean>} True if bid was successfully placed
 */
export async function placeBid(type, roomID, amount) {
    try {
        // Check if player has sufficient available money
        if (amount > getAvailableMoney()) {
            console.error("Not enough available money for this bid");
            return false;
        }

        // Send bid to server
        const response = await fetch('api/bid.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type,
                roomID: roomID,
                amount: amount,
                playerID: playerState.playerID
            })
        });

        if (!response.ok) {
            console.error('Server error when placing bid:', await response.text());
            return false;
        }

        const data = await response.json();
        
        if (data.success && data.bid) {
            // Add the new bid to player's active bids list
            playerState.activeBids.push({
                bidID: data.bid.bidID,
                type: type,
                roomID: roomID,
                amount: amount,
                status: 'new',
                placed_datetime: data.bid.placed_datetime
            });

            // Update HUD to show new bid info
            playerHUD.update(playerState);
            console.log(`Bid placed: ${type} bid for room ${roomID}, amount: ${amount}`);
            return true;
        } else {
            console.error('Failed to place bid:', data.error);
            return false;
        }
    } catch (error) {
        console.error("Error placing bid:", error);
        return false;
    }
}

/**
 * Remove a bid by its ID
 * @param {number} bidID - The ID of the bid to remove
 * @returns {Promise<boolean>} True if bid was successfully removed
 */
export async function removeBid(bidID) {
    try {
        // Send request to server to remove the bid
        const response = await fetch(`api/bid.php?bidID=${encodeURIComponent(bidID)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Server error when removing bid:', await response.text());
            return false;
        }

        const data = await response.json();
        
        if (data.success) {
            // Remove bid from player's active bids array
            const bidIndex = playerState.activeBids.findIndex(bid => bid.bidID == bidID);
            if (bidIndex !== -1) {
                playerState.activeBids.splice(bidIndex, 1);
                
                // Update HUD to reflect removed bid
                playerHUD.update(playerState);
                console.log(`Bid ${bidID} removed successfully`);
            }
            return true;
        } else {
            console.error('Failed to remove bid:', data.error);
            return false;
        }
    } catch (error) {
        console.error("Error removing bid:", error);
        return false;
    }
}

/**
 * Fetch player's active bids from the server
 * @returns {Promise<boolean>} True if successful
 */
export async function fetchPlayerBids() {
    try {
        if (!playerState.playerID) return false;

        const response = await fetch(`api/bid.php?playerID=${encodeURIComponent(playerState.playerID)}`);
        
        if (!response.ok) {
            console.error('Server error when fetching bids:', await response.text());
            return false;
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update player's active bids array
            playerState.activeBids = data.bids || [];
            console.log(`Loaded ${playerState.activeBids.length} active bids for player`);
            
            // Update HUD to show current bids
            playerHUD.update(playerState);
            return true;
        } else {
            console.error('Failed to fetch player bids:', data.error);
            return false;
        }
    } catch (error) {
        console.error("Error fetching player bids:", error);
        return false;
    }
}

/**
 * Check if a player ID exists in localStorage.
 * @returns {string|null} The playerID or null if not found.
 */
export function getPlayerIDFromStorage() {
    return localStorage.getItem(config.player.storageKey);
}

/**
 * Save playerID to localStorage.
 * @param {string} playerID - The playerID to save.
 */
export function savePlayerIDToStorage(playerID) {
    localStorage.setItem(config.player.storageKey, playerID); // Ensure playerID is treated as a string
}

/**
 * Fetch existing player data from the server.
 * @param {string} playerID - The player ID to fetch.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function fetchPlayerData(playerID) {
    try {
        const response = await fetch(`api/player.php?id=${encodeURIComponent(playerID)}`);
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        if (data.success && data.player) {
            playerState = {
                ...playerState,
                ...data.player,
                isNewPlayer: false,
                activeBids: playerState.activeBids || [] // Preserve active bids if they exist
            };
            savePlayerUsernameToStorage(data.player.username); // Save username to localStorage
            
            // After loading player data, fetch their active bids
            await fetchPlayerBids();
            
            playerHUD.update(playerState);
            showWelcomeMessage(false);
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error fetching player data:", error);
        return false;
    }
}

/**
 * Create a new player on the server.
 * @returns {Promise<boolean>} True if the player was created successfully.
 */
export async function createNewPlayer() {
    try {
        const response = await fetch('api/player.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) {
            console.error('Server error when creating player:', await response.text());
            return false;
        }
        const data = await response.json();
        if (data.success && data.player) {
            playerState = {
                ...playerState,
                ...data.player,
                roomCount: 0,
                isNewPlayer: true
            };
            savePlayerIDToStorage(data.player.playerID);
            savePlayerUsernameToStorage(data.player.username); // Save username to localStorage
            playerHUD.update(playerState);
            showWelcomeMessage(true);
            return true;
        } else {
            console.error('Failed to create new player:', data.error);
            return false;
        }
    } catch (error) {
        console.error("Error creating new player:", error);
        return false;
    }
}

/**
 * Save player's username to localStorage.
 * @param {string} username - The username to save.
 */
function savePlayerUsernameToStorage(username) {
    localStorage.setItem(config.player.usernameKey, username);
}

/**
 * Display a welcome message to the player.
 * @param {boolean} isNewPlayer - True if this is a new player.
 */
function showWelcomeMessage(isNewPlayer) {
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'welcome-message';
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
    welcomeMsg.textContent = isNewPlayer 
        ? `Welcome to Kowloon Tower, ${playerState.username}!`
        : `Welcome back, ${playerState.username}!`;
    document.body.appendChild(welcomeMsg);
    setTimeout(() => {
        welcomeMsg.style.opacity = '0';
        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                document.body.removeChild(welcomeMsg);
            }
        }, 500);
    }, config.player.welcomeMessageDuration);
}

/**
 * Initialize the player by checking localStorage and fetching or creating a player as needed.
 * @returns {Promise<void>}
 */
export async function initializePlayer() {
    const storedPlayerID = getPlayerIDFromStorage();
    if (storedPlayerID) {
        console.log('Found stored player ID:', storedPlayerID);
        const playerFetched = await fetchPlayerData(storedPlayerID); //including bids
        if (!playerFetched) {
            console.log('Stored player not found in database, creating new player');
            await createNewPlayer();
        }
    } else {
        console.log('No player ID in storage, creating new player');
        await createNewPlayer();
    }
    console.log('Player initialized:', playerState);
}
