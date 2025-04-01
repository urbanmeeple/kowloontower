import { getPlayerState, placeBid, getAvailableMoney, removeBid } from './player.js';
import { renderGame } from './render.js';
import { getLocalGameState } from './state.js';
import { isTimerAtZero } from './playerHUD.js'; // Import isTimerAtZero function

class RoomPopup {
    constructor() {
        this.popupContainer = document.createElement('div');
        this.popupContainer.id = 'room-popup';
        this.popupContainer.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.popupContainer);

        this.setupStyles();
        this.currentRoom = null;
    }

    setupStyles() {
        // Basic styling for the popup
        Object.assign(this.popupContainer.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '12px',
            borderRadius: '5px',
            zIndex: '1001',
            boxShadow: '0 3px 6px rgba(0, 0, 0, 0.5)',
            overflow: 'visible', // Changed from 'auto' to prevent scrollbars
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            border: '1px solid #444',
            width: 'auto', // Allow dynamic width
            maxWidth: '100%', // Ensure it doesn't exceed the screen width
            boxSizing: 'border-box', // Ensure padding is included in width calculation
        });

        // Adjust width dynamically based on the tower grid
        const towerGrid = document.getElementById('gameCanvas');
        if (towerGrid) {
            const towerGridWidth = towerGrid.offsetWidth;
            this.popupContainer.style.maxWidth = `${Math.min(towerGridWidth - 20, 600)}px`;
        }

        // Create close button
        this.closeButton = document.createElement('button');
        this.closeButton.textContent = 'Close';
        this.closeButton.id = 'close-button'; // Add ID for close button
        Object.assign(this.closeButton.style, {
            position: 'absolute',
            top: '8px', // Reduced spacing
            right: '8px', // Reduced spacing
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            padding: '4px 8px', // Reduced padding
            borderRadius: '4px', // Reduced border radius
            cursor: 'pointer',
            fontSize: '10px' // Reduced font size
        });
        this.closeButton.addEventListener('click', () => this.hide());
        this.popupContainer.appendChild(this.closeButton);
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
     * Check if player has an active bid on a room
     * @param {number} roomID - The room ID to check
     * @returns {Object|null} The bid object or null if no bid exists
     */
    getExistingBid(roomID, type) {
        const playerState = getPlayerState();
        return playerState.activeBids.find(
            bid => bid.roomID == roomID && bid.type === type
        );
    }

    /**
     * Disable all bid buttons except the close button when the timer is at 0
     */
    disableBidButtons() {
        const bidButtons = this.popupContainer.querySelectorAll('button:not([id="close-button"])');
        bidButtons.forEach(button => {
            // Store the original text and color if not already stored
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            if (!button.dataset.originalColor) {
                button.dataset.originalColor = button.style.backgroundColor;
            }

            // Disable the button and set it to grey
            button.disabled = true;
            button.style.backgroundColor = '#9E9E9E'; // Grey color
            button.textContent = 'Bidding Disabled';
        });

        // Disable renovate button if it exists
        if (this.renovateButton) {
            this.renovateButton.disabled = true;
            this.renovateButton.style.backgroundColor = '#9E9E9E'; // Grey color
            this.renovateButton.textContent = 'Renovation Disabled';
        }
    }

    /**
     * Enable all bid buttons except the close button after the timer resets
     */
    enableBidButtons() {
        const bidButtons = this.popupContainer.querySelectorAll('button:not([id="close-button"])');
        bidButtons.forEach(button => {
            // Enable the button and restore its original color and text
            button.disabled = false;
            button.style.backgroundColor = button.dataset.originalColor || ''; // Restore original color

            // Restore the correct text based on the button's context
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
            } else if (button.textContent.includes('Change bid')) {
                button.textContent = 'Change bid';
            } else {
                button.textContent = 'Place Bid';
            }
        });

        // Enable renovate button if it exists
        if (this.renovateButton) {
            this.renovateButton.disabled = false;
            this.renovateButton.style.backgroundColor = this.renovateButton.dataset.originalColor || ''; // Restore original color
            this.renovateButton.textContent = this.renovateButton.dataset.originalText || 'Renovate'; // Restore original text
        }
    }

    /**
     * Update the popup buttons dynamically based on the timer state
     */
    updatePopupButtons() {
        if (isTimerAtZero()) {
            this.disableBidButtons();
        } else {
            this.enableBidButtons();
        }
    }

    /**
     * Create a bidding interface with a slider for entering bid amount
     * @param {string} type - Type of bid ('construct' or 'buy')
     * @param {Object} roomData - Data about the room being bid on
     * @returns {HTMLElement} The container with the bidding interface
     */
    createBidInterface(type, roomData) {
        // Check if player has an existing bid for this room
        const existingBid = this.getExistingBid(roomData.roomID, type);
        const isChangingBid = !!existingBid;
        
        // Create container for bid interface
        const bidContainer = document.createElement('div');
        bidContainer.className = 'bid-interface';
        Object.assign(bidContainer.style, {
            marginTop: '15px',
            padding: '15px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '5px',
            width: 'auto', // Changed from 100% to auto
            boxSizing: 'border-box', // Include padding in width calculation
        });

        // Title for the bid interface
        const bidTitle = document.createElement('h3');
        bidTitle.textContent = isChangingBid 
            ? `Your Current ${type === 'construct' ? 'Construction' : 'Buy'} Bid` 
            : type === 'construct' ? 'Place Construction Bid' : 'Place Buy Bid';
        bidTitle.style.marginTop = '0';
        bidContainer.appendChild(bidTitle);

        // If there's an existing bid, show it
        if (isChangingBid) {
            const currentBidInfo = document.createElement('p');
            currentBidInfo.textContent = `Your current bid: ${this.formatMoney(existingBid.amount)}`;
            currentBidInfo.style.fontWeight = 'bold';
            currentBidInfo.style.color = '#4CAF50'; // Green text for current bid
            bidContainer.appendChild(currentBidInfo);
        }

        // Get available money
        const availableMoney = getAvailableMoney();
        
        // If changing bid, add the existing bid amount to available money
        const totalAvailableMoney = isChangingBid 
            ? availableMoney + existingBid.amount 
            : availableMoney;
        
        // Show available money
        const availableMoneyElement = document.createElement('p');
        availableMoneyElement.textContent = `Available Money: ${this.formatMoney(totalAvailableMoney)}`;
        bidContainer.appendChild(availableMoneyElement);

        // Minimum bid amount is always 1
        const minBidAmount = 1;
        
        // Maximum bid amount (available money)
        const maxBidAmount = totalAvailableMoney;
        
        // Set initial bid amount to existing bid or minimum bid amount
        let bidAmount = isChangingBid ? existingBid.amount : minBidAmount;

        // Slider container
        const sliderContainer = document.createElement('div');
        sliderContainer.style.margin = '20px 0';
        bidContainer.appendChild(sliderContainer);

        // Create slider for bid amount
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = minBidAmount; // Set minimum value to 1
        slider.max = maxBidAmount;
        slider.value = bidAmount;
        slider.step = 1; // Increment by 1
        Object.assign(slider.style, {
            width: '80%', 
            margin: '10px 0'
        });
        sliderContainer.appendChild(slider);

        // Display for current bid amount (smaller font)
        const bidAmountDisplay = document.createElement('div');
        bidAmountDisplay.textContent = this.formatMoney(bidAmount);
        bidAmountDisplay.style.fontWeight = 'bold';
        bidAmountDisplay.style.fontSize = '16px'; // Smaller font (was 18px)
        bidAmountDisplay.style.margin = '10px 0';
        sliderContainer.appendChild(bidAmountDisplay);

        // Update bid amount when slider changes
        slider.addEventListener('input', () => {
            bidAmount = parseInt(slider.value, 10);
            bidAmountDisplay.textContent = this.formatMoney(bidAmount);
        });

        // Create button container for side-by-side buttons when there's an existing bid
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '15px';
        
        // Create bid button
        
        // Use different text formatting for "Bid" and "to construct/buy"
        const buttonText = isChangingBid ? 'Change bid' : (type === 'construct' ? 'Bid' : 'Bid');
        const secondaryText = type === 'construct' ? ' to construct' : ' to buy';
        
        const bidButton = document.createElement('button');
        bidButton.dataset.originalText = bidButton.textContent;
        bidButton.dataset.originalColor = '#4CAF50'; // green
        bidButton.innerHTML = isChangingBid 
            ? 'Change bid' 
            : `<span style="font-size: 1.2em; font-weight: bold;">${buttonText}</span><span style="font-size: 0.8em">${secondaryText}</span>`;
        
        Object.assign(bidButton.style, {
            backgroundColor: type === 'construct' ? '#2196F3' : '#9C27B0',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
        });

        // Handle bid button click
        bidButton.addEventListener('click', async () => {
            // Check if bid amount meets minimum requirements
            if (bidAmount < minBidAmount) {
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Bid must be at least ${this.formatMoney(minBidAmount)}`;
                errorMsg.style.color = '#F44336'; // Red
                
                // Remove any existing error messages
                const existingError = bidContainer.querySelector('.error-message');
                if (existingError) bidContainer.removeChild(existingError);
                
                errorMsg.className = 'error-message';
                bidContainer.appendChild(errorMsg);
                return;
            }
            
            // Disable button to prevent multiple clicks
            bidButton.disabled = true;
            bidButton.textContent = 'Processing...';
            
            const success = await placeBid(type, roomData.roomID, bidAmount);
            
            if (success) {
                // Show success message
                bidButton.textContent = isChangingBid ? 'Bid Updated!' : 'Bid Placed!';
                bidButton.style.backgroundColor = '#4CAF50'; // Green
                
                // Immediately update the game UI to show the bid indicator
                const gameState = getLocalGameState();
                if (gameState && gameState.rooms) {
                    renderGame(gameState.rooms);
                }
                
                // Close popup after a delay
                setTimeout(() => {
                    this.hide();
                }, 1500);
            } else {
                // Reset button if failed
                if (isChangingBid) {
                    bidButton.textContent = 'Change bid';
                } else {
                    bidButton.innerHTML = `<span style="font-size: 1.2em; font-weight: bold;">${buttonText}</span><span style="font-size: 0.8em">${secondaryText}</span>`;
                }
                bidButton.disabled = false;
                
                // Show error message
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Failed to place bid. Please try again.';
                errorMsg.style.color = '#F44336'; // Red
                
                // Remove any existing error messages
                const existingError = bidContainer.querySelector('.error-message');
                if (existingError) bidContainer.removeChild(existingError);
                
                errorMsg.className = 'error-message';
                bidContainer.appendChild(errorMsg);
            }
        });

        // Add remove bid button if there's an existing bid
        if (isChangingBid) {
            const removeBidButton = document.createElement('button');
            removeBidButton.textContent = 'Remove Bid';
            removeBidButton.dataset.originalText = removeBidButton.textContent;
            removeBidButton.dataset.originalColor = '#F44336'; // red
            Object.assign(removeBidButton.style, {
                backgroundColor: '#F44336', // Red color for removal
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
            });

            // Handle remove bid click
            removeBidButton.addEventListener('click', async () => {
                // Disable button to prevent multiple clicks
                removeBidButton.disabled = true;
                removeBidButton.textContent = 'Removing...';
                
                const success = await removeBid(existingBid.bidID);
                
                if (success) {
                    // Show success message
                    removeBidButton.textContent = 'Bid Removed!';
                    
                    // Immediately update the game UI to remove the bid indicator
                    const gameState = getLocalGameState();
                    if (gameState && gameState.rooms) {
                        renderGame(gameState.rooms);
                    }
                    
                    // Close popup after a delay
                    setTimeout(() => {
                        this.hide();
                    }, 1500);
                } else {
                    // Reset button if failed
                    removeBidButton.textContent = 'Remove Bid';
                    removeBidButton.disabled = false;
                    
                    // Show error message
                    const errorMsg = document.createElement('p');
                    errorMsg.textContent = 'Failed to remove bid. Please try again.';
                    errorMsg.style.color = '#F44336'; // Red
                    bidContainer.appendChild(errorMsg);
                }
            });
            
            // Add both buttons to container
            buttonContainer.appendChild(bidButton);
            buttonContainer.appendChild(removeBidButton);
            bidContainer.appendChild(buttonContainer);
        } else {
            // Just add the bid button if there's no existing bid
            bidButton.style.marginTop = '10px'; // Add margin when button is alone
            bidContainer.appendChild(bidButton);
        }

        // Disable bid button if not enough money
        if (totalAvailableMoney <= 0) {
            bidButton.disabled = true;
            bidButton.textContent = 'Insufficient Funds';
            bidButton.style.backgroundColor = '#9E9E9E'; // Gray
            
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'You do not have enough available money to place a bid.';
            errorMsg.style.color = '#F44336'; // Red
            bidContainer.appendChild(errorMsg);
        }

        return bidContainer;
    }

    /**
     * Add a renovation section to the popup
     * @param {Object} roomData - Data about the room being renovated
     */
    addRenovationSection(roomData) {
        const renovationSection = document.createElement('div');
        renovationSection.style.marginTop = '20px';

        const title = document.createElement('h3');
        title.textContent = 'Renovate';
        renovationSection.appendChild(title);

        const createButton = (label, type) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.style.margin = '5px';
            button.style.padding = '10px';
            button.style.backgroundColor = '#4CAF50';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';

            button.addEventListener('click', async () => {
                button.disabled = true;
                button.textContent = 'Processing...';

                const success = await this.sendRenovationRequest(roomData.roomID, type);
                if (success) {
                    button.textContent = `${label} Renovation Done!`;
                } else {
                    button.textContent = 'Failed. Try Again.';
                    button.disabled = false;
                }
            });

            return button;
        };

        renovationSection.appendChild(createButton('Small', 'small'));
        renovationSection.appendChild(createButton('Big', 'big'));
        renovationSection.appendChild(createButton('Amazing', 'amazing'));

        this.popupContainer.appendChild(renovationSection);
    }

    /**
     * Send a renovation request to the server
     * @param {number} roomID - The room ID to renovate
     * @param {string} type - The type of renovation ('small', 'big', 'amazing')
     * @returns {Promise<boolean>} - Whether the request was successful
     */
    async sendRenovationRequest(roomID, type) {
        try {
            const response = await fetch('/api/renovateRoom.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomID, type })
            });
            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Renovation request failed:', error);
            return false;
        }
    }

    show(roomData) {
        // Store the current room data for reference
        this.currentRoom = roomData;
        
        // Clear previous content
        this.popupContainer.innerHTML = '';
        this.setupStyles(); // Re-add styles and close button

        // Room type and sector
        const roomType = (roomData.status === 'new_constructed' || roomData.status === 'old_constructed') 
            ? 'Constructed Room' 
            : roomData.status === 'destroyed' 
              ? 'Destroyed Room'
              : 'Planned Room';
        const sectorType = roomData.sector_type || 'Unknown Sector';

        // Create elements
        const title = document.createElement('h2');
        title.textContent = roomType;
        title.style.marginBottom = '10px';
        this.popupContainer.appendChild(title);

        // Room information
        const roomInfo = document.createElement('div');
        
        // Sector information
        const sector = document.createElement('p');
        sector.textContent = `Sector: ${sectorType}`;
        sector.style.marginBottom = '10px';
        roomInfo.appendChild(sector);

        this.popupContainer.appendChild(roomInfo);

        if (roomData.status === 'destroyed') {
            // Special handling for destroyed rooms
            // Owner information with "Neglecting owner" prefix
            const gameState = getLocalGameState();
            const ownerEntry = gameState.players_rooms.find(pr => pr.roomID === roomData.roomID);
            if (ownerEntry && ownerEntry.username) {
                const ownerInfo = document.createElement('p');
                ownerInfo.textContent = `Neglecting Owner: ${ownerEntry.username}`;
                ownerInfo.style.marginBottom = '10px';
                this.popupContainer.appendChild(ownerInfo);
            }
            
            // No bid interfaces or renovate buttons for destroyed rooms
        } else if (roomData.status === 'new_constructed' || roomData.status === 'old_constructed') {
            // Owner information
            const gameState = getLocalGameState();
            const ownerEntry = gameState.players_rooms.find(pr => pr.roomID === roomData.roomID);
            if (ownerEntry && ownerEntry.username) {
                const ownerInfo = document.createElement('p');
                ownerInfo.textContent = `Owner: ${ownerEntry.username}`;
                ownerInfo.style.marginBottom = '10px';
                this.popupContainer.appendChild(ownerInfo);
            }

            // Wear level with formatting and color coding
            const wear = document.createElement('p');
            const wearValue = parseFloat(roomData.wear).toFixed(2); // Format to 2 decimal places
            wear.innerHTML = `Wear Level: <span>${wearValue}</span>`;
            wear.style.marginBottom = '10px';
            
            // Set color based on wear value thresholds
            const wearSpan = wear.querySelector('span');
            if (roomData.wear < 0.4) {
                wearSpan.style.color = '#4CAF50'; // Green for low wear
            } else if (roomData.wear < 0.6) {
                wearSpan.style.color = '#FFEB3B'; // Yellow for medium wear
            } else if (roomData.wear < 0.9) {
                wearSpan.style.color = '#FF9800'; // Orange for high wear
            } else {
                wearSpan.style.color = '#F44336'; // Red for critical wear
            }
            
            this.popupContainer.appendChild(wear);

            // Room rent
            const roomRent = document.createElement('p');
            roomRent.textContent = `Room Rent: ${this.formatMoney(roomData.room_rent)}`;
            roomRent.style.marginBottom = '10px';
            this.popupContainer.appendChild(roomRent);

            // Add renovation section
            this.addRenovationSection(roomData);
            
            // Add bid to buy interface
            const buyBidInterface = this.createBidInterface('buy', roomData);
            this.popupContainer.appendChild(buyBidInterface);
            
        } else if (roomData.status === 'planned') {
            // Add bid to construct interface
            const constructBidInterface = this.createBidInterface('construct', roomData);
            this.popupContainer.appendChild(constructBidInterface);
        }

        // Update popup buttons based on the timer state
        this.updatePopupButtons();

        this.popupContainer.style.display = 'block';
    }

    hide() {
        this.popupContainer.style.display = 'none';
        this.currentRoom = null;
    }
}

export const roomPopup = new RoomPopup();
