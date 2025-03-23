// This file contains functions to manage the player including fetching, creation, and initialization.
import { config, gameState } from './config.js';
import { playerHUD } from './playerHUD.js'; // Assumes playerHUD.js exports an instance

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
            gameState.player = {
                ...gameState.player,
                ...data.player,
                isNewPlayer: false
            };
            playerHUD.update(gameState.player);
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
            gameState.player = {
                ...gameState.player,
                ...data.player,
                roomCount: 0,
                isNewPlayer: true
            };
            playerHUD.update(gameState.player);
            savePlayerIDToStorage(data.player.playerID);
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
        ? `Welcome to Kowloon Tower, ${gameState.player.username}!`
        : `Welcome back, ${gameState.player.username}!`;
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
    console.log('Player initialized:', gameState.player);
}
