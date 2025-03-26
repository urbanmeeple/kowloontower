import { getPlayerState, placeBid, getAvailableMoney } from './player.js';

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
            padding: '20px',
            borderRadius: '8px',
            zIndex: '1001',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
            maxWidth: '80%',
            maxHeight: '80%',
            overflow: 'auto',
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            border: '1px solid #444',
        });

        // Create close button
        this.closeButton = document.createElement('button');
        this.closeButton.textContent = 'Close';
        Object.assign(this.closeButton.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
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
     * Create a bidding interface with a slider for entering bid amount
     * @param {string} type - Type of bid ('construct' or 'buy')
     * @param {Object} roomData - Data about the room being bid on
     * @returns {HTMLElement} The container with the bidding interface
     */
    createBidInterface(type, roomData) {
        // Create container for bid interface
        const bidContainer = document.createElement('div');
        bidContainer.className = 'bid-interface';
        Object.assign(bidContainer.style, {
            marginTop: '15px',
            padding: '15px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '5px',
            width: '100%'
        });

        // Title for the bid interface
        const bidTitle = document.createElement('h3');
        bidTitle.textContent = type === 'construct' ? 'Place Construction Bid' : 'Place Buy Bid';
        bidTitle.style.marginTop = '0';
        bidContainer.appendChild(bidTitle);

        // Get available money
        const availableMoney = getAvailableMoney();
        
        // Show available money
        const availableMoneyElement = document.createElement('p');
        availableMoneyElement.textContent = `Available Money: ${this.formatMoney(availableMoney)}`;
        bidContainer.appendChild(availableMoneyElement);

        // Minimum bid amount (10% of available money or $10,000, whichever is more)
        const minBidAmount = Math.max(10000, Math.floor(availableMoney * 0.1));
        
        // Maximum bid amount (available money)
        const maxBidAmount = availableMoney;
        
        // Set initial bid amount to minimum
        let bidAmount = minBidAmount;

        // Slider container
        const sliderContainer = document.createElement('div');
        sliderContainer.style.margin = '20px 0';
        bidContainer.appendChild(sliderContainer);

        // Create slider for bid amount
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = minBidAmount;
        slider.max = maxBidAmount;
        slider.value = bidAmount;
        slider.step = 1000; // Increment in thousands
        Object.assign(slider.style, {
            width: '100%',
            margin: '10px 0'
        });
        sliderContainer.appendChild(slider);

        // Display for current bid amount
        const bidAmountDisplay = document.createElement('div');
        bidAmountDisplay.textContent = this.formatMoney(bidAmount);
        bidAmountDisplay.style.fontWeight = 'bold';
        bidAmountDisplay.style.fontSize = '18px';
        bidAmountDisplay.style.margin = '10px 0';
        sliderContainer.appendChild(bidAmountDisplay);

        // Update bid amount when slider changes
        slider.addEventListener('input', () => {
            bidAmount = parseInt(slider.value, 10);
            bidAmountDisplay.textContent = this.formatMoney(bidAmount);
        });

        // Create bid button
        const bidButton = document.createElement('button');
        bidButton.textContent = type === 'construct' ? 'Place Construction Bid' : 'Place Buy Bid';
        Object.assign(bidButton.style, {
            backgroundColor: type === 'construct' ? '#2196F3' : '#9C27B0',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginTop: '10px'
        });

        // Handle bid button click
        bidButton.addEventListener('click', async () => {
            // Disable button to prevent multiple clicks
            bidButton.disabled = true;
            bidButton.textContent = 'Processing...';
            
            const success = await placeBid(type, roomData.roomID, bidAmount);
            
            if (success) {
                // Show success message
                bidButton.textContent = 'Bid Placed!';
                bidButton.style.backgroundColor = '#4CAF50'; // Green
                
                // Close popup after a delay
                setTimeout(() => {
                    this.hide();
                }, 1500);
            } else {
                // Reset button if failed
                bidButton.textContent = type === 'construct' ? 'Place Construction Bid' : 'Place Buy Bid';
                bidButton.disabled = false;
                
                // Show error message
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Failed to place bid. Please try again.';
                errorMsg.style.color = '#F44336'; // Red
                bidContainer.appendChild(errorMsg);
            }
        });

        // Disable bid button if not enough money
        if (availableMoney <= 0) {
            bidButton.disabled = true;
            bidButton.textContent = 'Insufficient Funds';
            bidButton.style.backgroundColor = '#9E9E9E'; // Gray
            
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'You do not have enough available money to place a bid.';
            errorMsg.style.color = '#F44336'; // Red
            bidContainer.appendChild(errorMsg);
        }

        bidContainer.appendChild(bidButton);
        return bidContainer;
    }

    show(roomData) {
        // Store the current room data for reference
        this.currentRoom = roomData;
        
        // Clear previous content
        this.popupContainer.innerHTML = '';
        this.setupStyles(); // Re-add styles and close button

        // Room type and sector
        const roomType = roomData.status === 'constructed' ? 'Constructed Room' : 'Planned Room';
        const sectorType = roomData.sector_type || 'Unknown Sector';

        // Create elements
        const title = document.createElement('h2');
        title.textContent = roomType;
        title.style.marginBottom = '10px';
        this.popupContainer.appendChild(title);

        // Room information
        const roomInfo = document.createElement('div');
        
        // Room ID (useful for debugging)
        const roomId = document.createElement('p');
        roomId.textContent = `Room ID: ${roomData.roomID}`;
        roomId.style.fontSize = '12px';
        roomId.style.color = '#aaa';
        roomInfo.appendChild(roomId);

        // Sector information
        const sector = document.createElement('p');
        sector.textContent = `Sector: ${sectorType}`;
        sector.style.marginBottom = '10px';
        roomInfo.appendChild(sector);

        // Location information
        const location = document.createElement('p');
        location.textContent = `Location: (${roomData.location_x}, ${roomData.location_y})`;
        location.style.marginBottom = '10px';
        roomInfo.appendChild(location);

        this.popupContainer.appendChild(roomInfo);

        if (roomData.status === 'constructed') {
            // Owner information
            if (roomData.username) {
                const ownerInfo = document.createElement('p');
                ownerInfo.textContent = `Owner: ${roomData.username}`;
                ownerInfo.style.marginBottom = '10px';
                this.popupContainer.appendChild(ownerInfo);
            }

            // Maintenance level
            const maintenance = document.createElement('p');
            maintenance.textContent = `Maintenance Level: ${roomData.maintenance_level}`;
            maintenance.style.marginBottom = '10px';
            this.popupContainer.appendChild(maintenance);

            // Pay maintenance button
            const payMaintenanceButton = document.createElement('button');
            payMaintenanceButton.textContent = 'Pay Maintenance';
            payMaintenanceButton.style.backgroundColor = '#4CAF50';
            payMaintenanceButton.style.color = 'white';
            payMaintenanceButton.style.border = 'none';
            payMaintenanceButton.style.padding = '8px 16px';
            payMaintenanceButton.style.borderRadius = '5px';
            payMaintenanceButton.style.cursor = 'pointer';
            payMaintenanceButton.style.fontSize = '14px';
            payMaintenanceButton.style.marginTop = '10px';
            this.popupContainer.appendChild(payMaintenanceButton);

            // Add bid to buy interface
            const buyBidInterface = this.createBidInterface('buy', roomData);
            this.popupContainer.appendChild(buyBidInterface);
            
        } else if (roomData.status === 'planned') {
            // Add bid to construct interface
            const constructBidInterface = this.createBidInterface('construct', roomData);
            this.popupContainer.appendChild(constructBidInterface);
        }

        this.popupContainer.style.display = 'block';
    }

    hide() {
        this.popupContainer.style.display = 'none';
        this.currentRoom = null;
    }
}

export const roomPopup = new RoomPopup();
