class RoomPopup {
    constructor() {
        this.popupContainer = document.createElement('div');
        this.popupContainer.id = 'room-popup';
        this.popupContainer.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.popupContainer);

        this.setupStyles();
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

    show(roomData, owner = null) {
        // Clear previous content
        this.popupContainer.innerHTML = '';
        this.setupStyles(); // Re-add styles and close button

        // Room type and sector
        const roomType = roomData.status === 'constructed' ? 'Constructed Room' : 'Planned Room';
        const sectorType = roomData.type || 'Unknown Sector';

        // Create elements
        const title = document.createElement('h2');
        title.textContent = roomType;
        title.style.marginBottom = '10px';
        this.popupContainer.appendChild(title);

        const sector = document.createElement('p');
        sector.textContent = `Sector: ${sectorType}`;
        sector.style.marginBottom = '10px';
        this.popupContainer.appendChild(sector);

        if (roomData.status === 'constructed') {
            // Owner information
            if (owner) {
                const ownerInfo = document.createElement('p');
                ownerInfo.textContent = `Owner: ${owner.username}`;
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
        } else if (roomData.status === 'planned') {
            // Bid to construct button
            const bidButton = document.createElement('button');
            bidButton.textContent = 'Bid to Construct';
            bidButton.style.backgroundColor = '#2196F3';
            bidButton.style.color = 'white';
            bidButton.style.border = 'none';
            bidButton.style.padding = '8px 16px';
            bidButton.style.borderRadius = '5px';
            bidButton.style.cursor = 'pointer';
            bidButton.style.fontSize = '14px';
            bidButton.style.marginTop = '10px';
            this.popupContainer.appendChild(bidButton);
        }

        // Bid to buy button (for constructed rooms)
        if (roomData.status === 'constructed') {
            const buyButton = document.createElement('button');
            buyButton.textContent = 'Bid to Buy';
            buyButton.style.backgroundColor = '#9C27B0';
            buyButton.style.color = 'white';
            buyButton.style.border = 'none';
            buyButton.style.padding = '8px 16px';
            buyButton.style.borderRadius = '5px';
            buyButton.style.cursor = 'pointer';
            buyButton.style.fontSize = '14px';
            buyButton.style.marginTop = '10px';
            this.popupContainer.appendChild(buyButton);
        }

        this.popupContainer.style.display = 'block';
    }

    hide() {
        this.popupContainer.style.display = 'none';
    }
}

export const roomPopup = new RoomPopup();
