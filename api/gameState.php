<?php
// api/gameState.php
header('Content-Type: application/json');
require_once('../config.php'); // Adjust the path if needed

try {
    // Get the most recent tower state
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        echo $row['state'];
    } else {
        // If no state exists yet, initialize with an empty tower
        $initialState = json_encode(['blocks' => []]);
        echo $initialState;
    }
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
