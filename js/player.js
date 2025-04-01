// This file contains functions to manage the player including fetching, creation, and initialization.
import { config } from './config.js.php';
import { playerHUD } from './playerHUD.js';
import { getLocalGameState } from './state.js';

// Local variables for tracking player-specific data
let activeBids = [];
let activeRenovations = [];
let isNewPlayer = false;

/**
 * Get the current player ID from localStorage.
 * @returns {string|null} The playerID or null if not found.
 */
export function getPlayerIDFromStorage() {
    return localStorage.getItem(config.player.storageKey);
}

/**
 * Get the current player's data from the local game state.
 * @returns {Object|null} The player's data or null if not found.
 */
export function getPlayerData() {
    const playerID = getPlayerIDFromStorage();
    const gameState = getLocalGameState();
    const player = gameState.players?.find(player => player.playerID === playerID) || null;
    console.log("getPlayerData:", { playerID, player });
    return player;
}

/**
 * Get the player's username.
 * @returns {string} The player's username.
 */
export function getPlayerUsername() {
    const player = getPlayerData();
    return player?.username || '';
}

/**
 * Get the player's money.
 * @returns {number} The player's money.
 */
export function getPlayerMoney() {
    const player = getPlayerData();
    return player?.money || 0;
}

/**
 * Get the player's rent income.
 * @returns {number} The player's rent income.
 */
export function getPlayerRent() {
    const player = getPlayerData();
    return player?.rent || 0;
}

/**
 * Get the player's dividends income.
 * @returns {number} The player's dividends income.
 */
export function getPlayerDividends() {
    const player = getPlayerData();
    return player?.dividends || 0;
}

/**
 * Get the player's stock holdings.
 * @returns {Object} An object containing the player's stock holdings.
 */
export function getPlayerStocks() {
    const player = getPlayerData();
    return {
        housing: player?.stock_housing || 0,
        entertainment: player?.stock_entertainment || 0,
        weapons: player?.stock_weapons || 0,
        food: player?.stock_food || 0,
        technical: player?.stock_technical || 0
    };
}

/**
 * Get the player's active bids.
 * @returns {Array} The player's active bids.
 */
export function getActiveBids() {
    return activeBids;
}

/**
 * Set the player's active bids.
 * @param {Array} bids - The new active bids.
 */
export function setActiveBids(bids) {
    activeBids = bids;
}

/**
 * Get the player's active renovations.
 * @returns {Array} The player's active renovations.
 */
export function getActiveRenovations() {
    return activeRenovations;
}

/**
 * Set the player's active renovations.
 * @param {Array} renovations - The new active renovations.
 */
export function setActiveRenovations(renovations) {
    activeRenovations = renovations;
}

/**
 * Check if the player is new.
 * @returns {boolean} True if the player is new, false otherwise.
 */
export function getIsNewPlayer() {
    return isNewPlayer;
}

/**
 * Set whether the player is new.
 * @param {boolean} value - True if the player is new, false otherwise.
 */
export function setIsNewPlayer(value) {
    isNewPlayer = value;
}

/**
 * Get the player's available money after accounting for reserved money (bids + renovations).
 * @returns {number} The available money.
 */
export function getAvailableMoney() {
    const reservedMoney = activeBids.reduce((sum, bid) => sum + bid.amount, 0) +
                          activeRenovations.reduce((sum, renovation) => sum + renovation.cost, 0);
    return getPlayerMoney() - reservedMoney;
}

/**
 * Place a new bid or update an existing bid for a room
 * @param {string} type - Type of bid ('construct' or 'buy')
 * @param {number} roomID - ID of the room being bid on
 * @param {number} amount - Amount of money to bid
 * @returns {Promise<boolean>} True if bid was successfully placed or updated
 */
export async function placeBid(type, roomID, amount) {
    try {
        const existingBid = activeBids.find(
            bid => bid.roomID === roomID && bid.type === type
        );

        const availableMoney = getAvailableMoney() + (existingBid ? existingBid.amount : 0);

        if (amount > availableMoney) {
            console.error("Not enough available money for this bid");
            return false;
        }

        if (existingBid) {
            if (existingBid.amount !== amount) {
                const response = await fetch(`api/bid.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: type,
                        roomID: roomID,
                        amount: amount,
                        playerID: getPlayerIDFromStorage()
                    })
                });

                if (!response.ok) {
                    console.error('Server error when updating bid:', await response.text());
                    return false;
                }

                const data = await response.json();
                if (data.success && data.bid) {
                    existingBid.amount = amount;
                    existingBid.placed_datetime = data.bid.placed_datetime;

                    playerHUD.update(getPlayerData());
                    console.log(`Bid updated: ${type} bid for room ${roomID}, new amount: ${amount}`);
                    return true;
                } else {
                    console.error('Failed to update bid:', data.error);
                    return false;
                }
            } else {
                console.log("Bid amount is unchanged, no update needed");
                return true;
            }
        } else {
            const response = await fetch('api/bid.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    roomID: roomID,
                    amount: amount,
                    playerID: getPlayerIDFromStorage()
                })
            });

            if (!response.ok) {
                console.error('Server error when placing bid:', await response.text());
                return false;
            }

            const data = await response.json();
            if (data.success && data.bid) {
                activeBids.push({
                    bidID: data.bid.bidID,
                    type: type,
                    roomID: roomID,
                    amount: amount,
                    status: 'new',
                    placed_datetime: data.bid.placed_datetime
                });

                playerHUD.update(getPlayerData());
                console.log(`Bid placed: ${type} bid for room ${roomID}, amount: ${amount}`);
                return true;
            } else {
                console.error('Failed to place bid:', data.error);
                return false;
            }
        }
    } catch (error) {
        console.error("Error placing or updating bid:", error);
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
        const response = await fetch(`api/bid.php?bidID=${encodeURIComponent(bidID)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Server error when removing bid:', await response.text());
            return false;
        }

        const data = await response.json();
        
        if (data.success) {
            const bidIndex = activeBids.findIndex(bid => bid.bidID == bidID);
            if (bidIndex !== -1) {
                activeBids.splice(bidIndex, 1);
                
                playerHUD.update(getPlayerData());
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
        const playerID = getPlayerIDFromStorage();
        if (!playerID) return false;

        const response = await fetch(`api/bid.php?playerID=${encodeURIComponent(playerID)}`);
        
        if (!response.ok) {
            console.error('Server error when fetching bids:', await response.text());
            return false;
        }
        
        const data = await response.json();
        
        if (data.success) {
            setActiveBids(data.bids || []);
            console.log(`Loaded ${activeBids.length} active bids for player`);
            
            playerHUD.update(getPlayerData());
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
 * Save playerID to localStorage.
 * @param {string} playerID - The playerID to save.
 */
export function savePlayerIDToStorage(playerID) {
    localStorage.setItem(config.player.storageKey, playerID);
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
            setIsNewPlayer(false);
            savePlayerIDToStorage(data.player.playerID);
            savePlayerUsernameToStorage(data.player.username);
            
            await fetchPlayerBids();
            
            playerHUD.update(getPlayerData());
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
            setIsNewPlayer(true);
            savePlayerIDToStorage(data.player.playerID);
            savePlayerUsernameToStorage(data.player.username);
            playerHUD.update(getPlayerData());
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
        ? `Welcome to Kowloon Tower, ${getPlayerUsername()}!`
        : `Welcome back, ${getPlayerUsername()}!`;
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
        const playerFetched = await fetchPlayerData(storedPlayerID);
        if (!playerFetched) {
            console.log('Stored player not found in database, creating new player');
            await createNewPlayer();
        }
    } else {
        console.log('No player ID in storage, creating new player');
        await createNewPlayer();
    }
    console.log('Player initialized:', getPlayerData());
}
