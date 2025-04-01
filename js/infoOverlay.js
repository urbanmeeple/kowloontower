/**
 * Display rent and dividend income as large green numbers in the center of the screen.
 * @param {number} rent - The rent income to display.
 * @param {number} dividends - The dividend income to display.
 */
export function showIncomeOverlay(rent, dividends) {
  console.log('showIncomeOverlay called with:', { rent, dividends }); // Debug log

  const overlayContainer = document.createElement('div');
  overlayContainer.style.position = 'fixed';
  overlayContainer.style.top = 'calc(var(--player-hud-height, 50px) + 10px)'; // Position below player HUD
  overlayContainer.style.left = '50%';
  overlayContainer.style.transform = 'translateX(-50%)'; // Center horizontally
  overlayContainer.style.textAlign = 'center';
  overlayContainer.style.zIndex = '2000'; // Ensure it is above the background
  overlayContainer.style.pointerEvents = 'none';

  // Rent income element
  const rentElement = document.createElement('div');
  rentElement.textContent = `+${rent}$`; // Add dollar sign
  rentElement.style.color = '#4CAF50'; // Green color
  rentElement.style.fontSize = '48px';
  rentElement.style.fontWeight = 'bold';
  rentElement.style.marginBottom = '10px';

  // Dividend income element
  const dividendsElement = document.createElement('div');
  dividendsElement.textContent = `+${dividends}$`; // Add dollar sign
  dividendsElement.style.color = '#4CAF50'; // Green color
  dividendsElement.style.fontSize = '48px';
  dividendsElement.style.fontWeight = 'bold';

  overlayContainer.appendChild(rentElement);
  overlayContainer.appendChild(dividendsElement);
  document.body.appendChild(overlayContainer);

  console.log('Overlay container appended to document body:', overlayContainer); // Debug log

  // Show for 4 seconds, then fade out over 4 seconds
  setTimeout(() => {
    overlayContainer.style.transition = 'opacity 4s';
    overlayContainer.style.opacity = '0';
    console.log('Overlay fading out'); // Debug log
    setTimeout(() => {
      if (overlayContainer.parentNode) {
        overlayContainer.parentNode.removeChild(overlayContainer);
        console.log('Overlay removed from DOM'); // Debug log
      }
    }, 4000); // Fade-out duration
  }, 4000); // Display duration
}
