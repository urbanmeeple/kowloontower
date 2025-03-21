<?php
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

// Enforce that this script can only be run from the command line (cronjob) or with the correct secret key
$isCommandLine = (php_sapi_name() === 'cli');
$hasValidKey = isset($_GET['key']) && $_GET['key'] === $secret_key;

if (!$isCommandLine && !$hasValidKey) {
    $msg = "Unauthorized access attempt. This script can only be run from a cronjob or with proper authorization.";
    writeLog($msg);
    http_response_code(403);
    echo json_encode(['error' => $msg]);
    exit;
}

/**
 * Converts selected spaces into constructed rooms
 * and creates corresponding database entries
 * 
 * @param array $currentState Current state array with grid, selected, and selectionOwners
 * @return array Updated state array with selections converted to rooms
 */
function processSelectedToRooms($currentState) {
    global $pdo;
    
    $grid = $currentState['grid'];
    $selected = $currentState['selected'] ?? array_fill(0, count($grid), array_fill(0, count($grid[0]), 0));
    $selectionOwners = $currentState['selectionOwners'] ?? array_fill(0, count($grid), array_fill(0, count($grid[0]), null));
    
    $gridHeight = count($grid);
    $gridWidth = count($grid[0]);
    $changesCount = 0;
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
    // Convert selected spaces to rooms
    for ($y = 0; $y < $gridHeight; $y++) {
        for ($x = 0; $x < $gridWidth; $x++) {
            // If space is selected and not already a room
            if ($selected[$y][$x] === 1 && $grid[$y][$x] === 0) {
                // Convert to a room in the grid
                $grid[$y][$x] = 1;
                
                // Clear selection
                $selected[$y][$x] = 0;
                
                // Get player who selected this space
                $playerID = $selectionOwners[$y][$x];
                if ($playerID) {
                    try {
                        // Determine sector type (for simplicity, use 'residential' as default)
                        $sectorType = 'residential';
                        
                        // Insert room into database
                        $stmt = $pdo->prepare("
                            INSERT INTO rooms 
                            (sector_type, location_x, location_y, maintenance_level, status, created_datetime) 
                            VALUES 
                            (:sector_type, :location_x, :location_y, 1.0, 'active', :created_datetime)
                        ");
                        
                        $stmt->execute([
                            'sector_type' => $sectorType,
                            'location_x' => $x,
                            'location_y' => $y,
                            'created_datetime' => $currentUtcDateTime
                        ]);
                        
                        // Get the new room ID
                        $roomID = $pdo->lastInsertId();
                        
                        // Associate room with player
                        $stmt = $pdo->prepare("
                            INSERT INTO players_rooms 
                            (playerID, roomID) 
                            VALUES 
                            (:playerID, :roomID)
                        ");
                        
                        $stmt->execute([
                            'playerID' => $playerID,
                            'roomID' => $roomID
                        ]);
                        
                        writeLog("Created room at ($x,$y) for player $playerID (roomID: $roomID)");
                    } catch (Exception $e) {
                        writeLog("Error creating room in database: " . $e->getMessage());
                    }
                } else {
                    writeLog("Warning: Room at ($x,$y) has no owner");
                }
                
                $changesCount++;
            }
        }
    }
    
    writeLog("Converted $changesCount selected spaces to rooms");
    
    return [
        'grid' => $grid,
        'selected' => $selected,
        'selectionOwners' => $selectionOwners
    ];
}

try {
    // Get current UTC datetime for updating the game state
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
    // Retrieve the current tower state.
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    if ($row) {
        $currentState = json_decode($row['state'], true);
    } else {
        // If no state exists yet, initialize with empty grid and selected arrays
        $gridHeight = 30;
        $gridWidth = 20;
        
        $currentState = [
            'grid' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0)),
            'selected' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0)),
            'selectionOwners' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, null))
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

    // Update the last_update_datetime in the game_state table
    $updateStateStmt = $pdo->prepare("
        UPDATE game_state SET last_update_datetime = :last_update_datetime
        WHERE 1
    ");
    
    // If no rows were affected, it means we need to insert a new row
    if ($updateStateStmt->execute(['last_update_datetime' => $currentUtcDateTime]) && $updateStateStmt->rowCount() === 0) {
        $insertStateStmt = $pdo->prepare("
            INSERT INTO game_state (game_time, last_update_datetime) 
            VALUES (0, :last_update_datetime)
        ");
        $insertStateStmt->execute(['last_update_datetime' => $currentUtcDateTime]);
        writeLog("Initialized game_state table with first record");
    }

    // Count occupied cells for logging
    $roomCount = 0;
    foreach ($newState['grid'] as $row) {
        $roomCount += array_sum($row);
    }

    // Log success.
    writeLog("Game state updated successfully. Total room count: $roomCount");
    writeLog("Last update time set to: $currentUtcDateTime UTC");
    echo json_encode(['success' => true, 'state' => $newState]);
} catch (Exception $e) {
    $msg = "Error updating game state: " . $e->getMessage();
    writeLog($msg);
    echo json_encode(['error' => $msg]);
}
?>
