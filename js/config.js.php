<?php
header('Content-Type: application/javascript');
require_once('../config.php');
$clientConfig = getClientConfig();
?>
export const config = <?php echo json_encode($clientConfig, JSON_PRETTY_PRINT); ?>;
// Export additional properties for module consumers
export const gameState = config.gameState;
export const sectorIcons = config.sectorIcons;
