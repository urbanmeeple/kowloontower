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

try {
    // Get player ID from request parameters (if provided)
    $playerID = isset($_GET['playerID']) ? $_GET['playerID'] : null;
    
    // Get the most recent tower state
    $stmt = $pdo->query("SELECT state, updated_at FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    
    // Get the last update time from game_state table
    $lastUpdateTime = getLastUpdateTime();
    
    if ($row) {
        // Parse the state and add the timestamp
        $state = json_decode($row['state'], true);
        $state['timestamp'] = strtotime($row['updated_at']);
        
        // Add last update time if available
        if ($lastUpdateTime) {
            $state['lastUpdateTime'] = $lastUpdateTime;
            $state['lastUpdateTimestamp'] = strtotime($lastUpdateTime);
        }
        
        // Add player data if playerID is provided
        if ($playerID) {
            $playerData = getPlayerData($playerID);
            if ($playerData) {
                $state['player'] = $playerData;
            }
        }
        
        echo json_encode($state);
    } else {
        // If no state exists yet, initialize with empty grid
        $gridHeight = 30;
        $gridWidth = 20;
        
        $grid = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        $selected = array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0));
        
        $initialState = [
            'grid' => $grid,
            'selected' => $selected,
            'timestamp' => time()
        ];
        
        // Add last update time if available
        if ($lastUpdateTime) {
            $initialState['lastUpdateTime'] = $lastUpdateTime;
            $initialState['lastUpdateTimestamp'] = strtotime($lastUpdateTime);
        }
        
        // Add player data if playerID is provided
        if ($playerID) {
            $playerData = getPlayerData($playerID);
            if ($playerData) {
                $initialState['player'] = $playerData;
            }
        }
        
        echo json_encode($initialState);
    }
} catch (Exception $e) {
    writeLog("Error in gameState.php: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
}
?>
