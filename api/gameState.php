<?php
header('Content-Type: application/json');
require_once('../config.php');

// Define log file path
$logFile = dirname(__FILE__) . '/../logs/game.log';

// Logging function: append timestamped messages to the log file
function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// Function to get player data including room count
function getPlayerData($playerID) {
    global $pdo;
    
    try {
        // Get basic player info
        $stmt = $pdo->prepare("
            SELECT * FROM players 
            WHERE playerID = :playerID
        ");
        $stmt->execute(['playerID' => $playerID]);
        $player = $stmt->fetch();
        
        if (!$player) {
            writeLog("Player not found with ID: $playerID");
            return null;
        }
        
        // Count rooms owned by this player
        $roomStmt = $pdo->prepare("
            SELECT COUNT(*) as roomCount 
            FROM players_rooms 
            WHERE playerID = :playerID
        ");
        $roomStmt->execute(['playerID' => $playerID]);
        $roomData = $roomStmt->fetch();
        
        // Add room count to player data
        $player['roomCount'] = (int)$roomData['roomCount'];
        
        writeLog("Retrieved player data for ID: $playerID, room count: {$player['roomCount']}");
        return $player;
    } catch (Exception $e) {
        writeLog("Error getting player data: " . $e->getMessage());
        return null;
    }
}

/**
 * Get all rooms from the database
 * 
 * @return array Associative array of rooms by coordinates
 */
function getRooms() {
    global $pdo;
    
    try {
        $stmt = $pdo->query("
            SELECT location_x, location_y, sector_type, roomID 
            FROM rooms
        ");
        
        $rooms = [];
        while ($room = $stmt->fetch()) {
            $x = (int)$room['location_x'];
            $y = (int)$room['location_y'];
            
            if (!isset($rooms[$y])) {
                $rooms[$y] = [];
            }
            
            $rooms[$y][$x] = [
                'type' => $room['sector_type'],
                'id' => $room['roomID']
            ];
        }
        
        return $rooms;
    } catch (Exception $e) {
        writeLog("Error getting rooms: " . $e->getMessage());
        return [];
    }
}

/**
 * Get current selections from the database
 * 
 * @return array Associative array of selections by coordinates
 */
function getSelections() {
    global $pdo;
    
    try {
        $stmt = $pdo->query("
            SELECT location_x, location_y, playerID
            FROM selected_spaces
            WHERE processed = 0
        ");
        
        $selections = [];
        while ($selection = $stmt->fetch()) {
            $x = (int)$selection['location_x'];
            $y = (int)$selection['location_y'];
            
            if (!isset($selections[$y])) {
                $selections[$y] = [];
            }
            
            $selections[$y][$x] = $selection['playerID'];
        }
        
        return $selections;
    } catch (Exception $e) {
        writeLog("Error getting selections: " . $e->getMessage());
        return [];
    }
}

/**
 * Get the last update time from the game_state table
 * 
 * @return string|null The last_update_datetime as a string or null if not found
 */
function getLastUpdateTime() {
    global $pdo;
    
    try {
        $stmt = $pdo->query("SELECT last_update_datetime FROM game_state LIMIT 1");
        $row = $stmt->fetch();
        
        if ($row) {
            return $row['last_update_datetime'];
        }
        
        return null;
    } catch (Exception $e) {
        writeLog("Error getting last update time: " . $e->getMessage());
        return null;
    }
}

/**
 * Check if an update is currently in progress (near minute boundary)
 * 
 * @return boolean True if an update is imminent or in progress
 */
function isUpdateInProgress() {
    // Consider update in progress if we're within 10 seconds of the minute mark
    $secondsInCurrentMinute = time() % 60;
    return $secondsInCurrentMinute >= 50 || $secondsInCurrentMinute < 10;
}

/**
 * Calculate the next update time
 * 
 * @return string ISO 8601 datetime string for next update
 */
function getNextUpdateTime() {
    // Updates happen at the start of each minute
    $now = time();
    $secondsUntilNextMinute = 60 - ($now % 60);
    $nextUpdateTimestamp = $now + $secondsUntilNextMinute;
    
    return date('c', $nextUpdateTimestamp);
}

try {
    // Get player ID from request parameters (if provided)
    $playerID = isset($_GET['playerID']) ? $_GET['playerID'] : null;
    
    // Grid dimensions
    $gridHeight = 30;
    $gridWidth = 20;
    
    // Initialize empty grid and selections grid
    $grid = array_fill(0, $gridHeight, array_fill(0, $gridWidth, null));
    $selected = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
    
    // Get rooms from the database
    $rooms = getRooms();
    
    // Fill in the grid with room data
    foreach ($rooms as $y => $row) {
        foreach ($row as $x => $room) {
            if ($y < $gridHeight && $x < $gridWidth) {
                $grid[$y][$x] = $room;
            }
        }
    }
    
    // Get selections from the database
    $selections = getSelections();
    
    // Fill in the selections grid
    foreach ($selections as $y => $row) {
        foreach ($row as $x => $playerID) {
            if ($y < $gridHeight && $x < $gridWidth) {
                $selected[$y][$x] = 1;
            }
        }
    }
    
    // Get the last update time
    $lastUpdateTime = getLastUpdateTime();
    $lastUpdateTimestamp = $lastUpdateTime ? strtotime($lastUpdateTime) : time();
    
    // Check if an update is in progress
    $updateInProgress = isUpdateInProgress();
    
    // Calculate next update time
    $nextUpdateTime = getNextUpdateTime();
    
    // Build the state object
    $state = [
        'grid' => $grid,
        'selected' => $selected,
        'timestamp' => time(),
        'lastUpdateTime' => $lastUpdateTime,
        'lastUpdateTimestamp' => $lastUpdateTimestamp,
        'updateInProgress' => $updateInProgress,
        'nextUpdateTime' => $nextUpdateTime
    ];
    
    // Add player data if playerID is provided
    if ($playerID) {
        $playerData = getPlayerData($playerID);
        if ($playerData) {
            $state['player'] = $playerData;
        }
    }
    
    echo json_encode($state);
} catch (Exception $e) {
    writeLog("Error in gameState.php: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
}
?>
