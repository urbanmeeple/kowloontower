<?php
// api/updateState.php
header('Content-Type: application/json');
require_once('../config.php');

// Define the log file path (make sure the logs directory exists and is writable)
$logFile = dirname(__FILE__) . '/../logs/cron.log';

// Logging function: Append timestamped messages to the log file.
function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// Log the start of the cron job
writeLog("Cron job started.");

// Verify that the request includes the correct secret key.
if (!isset($_GET['key']) || $_GET['key'] !== $secret_key) {
    $msg = "Unauthorized access attempt.";
    writeLog($msg);
    http_response_code(403);
    echo json_encode(['error' => $msg]);
    exit;
}

/**
 * Converts selected spaces into constructed rooms
 * 
 * @param array $currentState Current state array with 'grid' and 'selected' keys.
 * @return array Updated state array with selected spaces converted to rooms.
 */
function processSelectedToRooms($currentState) {
    $grid = $currentState['grid'];
    $selected = $currentState['selected'] ?? array_fill(0, count($grid), array_fill(0, count($grid[0]), 0));
    
    $gridHeight = count($grid);
    $gridWidth = count($grid[0]);
    $changesCount = 0;
    
    // Convert selected spaces to rooms
    for ($y = 0; $y < $gridHeight; $y++) {
        for ($x = 0; $x < $gridWidth; $x++) {
            // If space is selected and not already a room
            if ($selected[$y][$x] === 1 && $grid[$y][$x] === 0) {
                $grid[$y][$x] = 1;       // Convert to a room
                $selected[$y][$x] = 0;    // Clear selection
                $changesCount++;
            }
        }
    }
    
    writeLog("Converted {$changesCount} selected spaces to rooms.");
    
    return [
        'grid' => $grid,
        'selected' => $selected 
    ];
}

try {
    // Retrieve the current tower state.
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        $currentState = json_decode($row['state'], true);
    } else {
        // If no state exists yet, initialize with empty grid and selected arrays
        $gridHeight = 30;
        $gridWidth = 20;
        
        $grid = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        $selected = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        
        $currentState = [
            'grid' => $grid,
            'selected' => $selected
        ];
    }

    // Process selected spaces and convert them to rooms
    $newState = processSelectedToRooms($currentState);
    
    // Add timestamp
    $newState['timestamp'] = time();
    
    $newStateJson = json_encode($newState);

    // Insert the updated state into the database.
    $stmt = $pdo->prepare("INSERT INTO tower_state (state) VALUES (:state)");
    $stmt->execute(['state' => $newStateJson]);

    // Count occupied cells for logging
    $roomCount = 0;
    foreach ($newState['grid'] as $row) {
        $roomCount += array_sum($row);
    }

    // Log success.
    writeLog("Game state updated successfully. Total room count: " . $roomCount);
    echo json_encode(['success' => true, 'state' => $newState]);
} catch (Exception $e) {
    $msg = "Error updating game state: " . $e->getMessage();
    writeLog($msg);
    echo json_encode(['error' => $msg]);
}
?>
