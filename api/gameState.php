<?php
// api/gameState.php
header('Content-Type: application/json');
require_once('../config.php');

try {
    // Get the most recent tower state
    $stmt = $pdo->query("SELECT state, updated_at FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        // Parse the state and add the timestamp
        $state = json_decode($row['state'], true);
        $state['timestamp'] = strtotime($row['updated_at']);
        echo json_encode($state);
    } else {
        // If no state exists yet, initialize with empty grid and selected arrays
        $gridHeight = 30;
        $gridWidth = 20;
        
        $grid = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        $selected = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        
        $initialState = [
            'grid' => $grid,
            'selected' => $selected,
            'timestamp' => time()
        ];
        echo json_encode($initialState);
    }
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
