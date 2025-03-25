<?php
header('Content-Type: application/javascript');
require_once('../config.php');
require_once('../api/gameState.php');

// Fetch cached game data
$cachedGameData = getCachedGameData();
if (!$cachedGameData) {
    cacheGameDataInMemory();
    $cachedGameData = getCachedGameData();
}

// Expose the cached game data as a read-only variable
?>
export const cachedGameData = <?php echo json_encode($cachedGameData, JSON_PRETTY_PRINT); ?>;
export const config = <?php echo json_encode(getClientConfig(), JSON_PRETTY_PRINT); ?>;
