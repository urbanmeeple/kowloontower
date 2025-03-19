<?php
// api/gameState.php
header('Content-Type: application/json');
require_once('../config.php');

try {
    // Get the most recent tower state
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        echo $row['state'];
    } else {
        // If no state exists yet, initialize with an empty grid
        // Create a 20x30 grid filled with zeros
        $grid = array_fill(0, 30, array_fill(0, 20, 0));
        $initialState = json_encode(['grid' => $grid]);
        echo $initialState;
    }
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
