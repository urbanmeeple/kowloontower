/**
 * Display rent and dividend income as large green numbers in the center of the screen.
 * @param {number} rent - The rent income to display.
 * @param {number} dividends - The dividend income to display.
 */
export function showIncomeOverlay(rent, dividends) {
  const overlayContainer = document.createElement('div');
  overlayContainer.style.position = 'fixed';
  overlayContainer.style.top = '50%';
  overlayContainer.style.left = '50%';
  overlayContainer.style.transform = 'translate(-50%, -50%)';
  overlayContainer.style.textAlign = 'center';
  overlayContainer.style.zIndex = '1000';
  overlayContainer.style.pointerEvents = 'none';

  // Rent income element
  const rentElement = document.createElement('div');
  rentElement.textContent = `+${rent}`;
  rentElement.style.color = '#4CAF50'; // Green color
  rentElement.style.fontSize = '48px';
  rentElement.style.fontWeight = 'bold';
  rentElement.style.marginBottom = '10px';

  // Dividend income element
  const dividendsElement = document.createElement('div');
  dividendsElement.textContent = `+${dividends}`;
  dividendsElement.style.color = '#4CAF50'; // Green color
  dividendsElement.style.fontSize = '48px';
  dividendsElement.style.fontWeight = 'bold';

  overlayContainer.appendChild(rentElement);
  overlayContainer.appendChild(dividendsElement);
  document.body.appendChild(overlayContainer);

  // Show for 2 seconds, then fade out over 2 seconds
  setTimeout(() => {
    overlayContainer.style.transition = 'opacity 2s';
    overlayContainer.style.opacity = '0';
    setTimeout(() => {
      if (overlayContainer.parentNode) {
        overlayContainer.parentNode.removeChild(overlayContainer);
      }
    }, 2000);
  }, 2000);
}
