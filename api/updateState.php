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
 * Randomly adds a new room to the tower grid
 *
 * @param array $currentState Current state array with a 'grid' key.
 * @return array Updated state array with the new room added.
 */
function addRandomRoom($currentState) {
    $grid = $currentState['grid'];
    $gridHeight = count($grid);
    $gridWidth = count($grid[0]);
    
    // Try to find an empty cell adjacent to an existing room
    $emptyCells = [];
    
    for ($y = 0; $y < $gridHeight; $y++) {
        for ($x = 0; $x < $gridWidth; $x++) {
            if ($grid[$y][$x] === 0) {
                // Check if this empty cell has any adjacent occupied cells
                $hasAdjacentRoom = false;
                
                // Check cells above, below, left, and right
                if (
                    ($y > 0 && $grid[$y-1][$x] === 1) ||
                    ($y < $gridHeight - 1 && $grid[$y+1][$x] === 1) ||
                    ($x > 0 && $grid[$y][$x-1] === 1) ||
                    ($x < $gridWidth - 1 && $grid[$y][$x+1] === 1)
                ) {
                    $hasAdjacentRoom = true;
                }
                
                if ($hasAdjacentRoom) {
                    $emptyCells[] = ['x' => $x, 'y' => $y];
                }
            }
        }
    }
    
    // If no empty cells with adjacent rooms, create first room in the bottom center
    if (empty($emptyCells)) {
        $centerX = floor($gridWidth / 2);
        $bottomY = $gridHeight - 1;
        $grid[$bottomY][$centerX] = 1;
    } else {
        // Randomly select one of the candidate cells
        $selectedCell = $emptyCells[array_rand($emptyCells)];
        $grid[$selectedCell['y']][$selectedCell['x']] = 1;
    }
    
    return ['grid' => $grid];
}

try {
    // Retrieve the current tower state.
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        $currentState = json_decode($row['state'], true);
    } else {
        // If no state exists yet, initialize with an empty grid
        // Create a 20x30 grid filled with zeros
        $grid = array_fill(0, 30, array_fill(0, 20, 0));
        $currentState = ['grid' => $grid];
    }

    // Generate a new state by adding a random room
    $newState = addRandomRoom($currentState);
    
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
    writeLog("Game state updated successfully. Room count: " . $roomCount);
    echo json_encode(['success' => true, 'state' => $newState]);
} catch (Exception $e) {
    $msg = "Error updating game state: " . $e->getMessage();
    writeLog($msg);
    echo json_encode(['error' => $msg]);
}
?>
