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

// Load data from appCache.json instead of querying the database
$appCacheFile = dirname(__FILE__) . '/../temp/appCache.json';
$appCacheJson = file_get_contents($appCacheFile);
if ($appCacheJson === false) {
    writeLog("Could not read appCache file.");
    $appCacheJson = '{}';
}
$appCacheData = json_decode($appCacheJson, true);
if (!is_array($appCacheData)) {
    $appCacheData = [];
}

$playersData       = isset($appCacheData['players'])       ? $appCacheData['players']       : [];
$roomsData         = isset($appCacheData['rooms'])         ? $appCacheData['rooms']         : [];
$playersRoomsData  = isset($appCacheData['players_rooms']) ? $appCacheData['players_rooms'] : [];
$gameStateData     = isset($appCacheData['game_state'])    ? $appCacheData['game_state']    : [];

// Function to get player data including room count
function getPlayerData($playerID) {
    global $playersData, $playersRoomsData;
    try {
        $player = null;
        foreach ($playersData as $p) {
            if ($p['playerID'] == $playerID) {
                $player = $p;
                break;
            }
        }
        if (!$player) {
            writeLog("Player not found with ID: $playerID");
            return null;
        }
        $roomCount = 0;
        foreach ($playersRoomsData as $pr) {
            if ($pr['playerID'] == $playerID) {
                $roomCount++;
            }
        }
        $player['roomCount'] = $roomCount;
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
    global $roomsData;
    try {
        $rooms = [];
        foreach ($roomsData as $room) {
            $x = (int)$room['location_x'];
            $y = (int)$room['location_y'];
            if (!isset($rooms[$y])) {
                $rooms[$y] = [];
            }
            $rooms[$y][$x] = [
                'type'   => $room['sector_type'],
                'id'     => $room['roomID'],
                'status' => $room['status']
            ];
        }
        return $rooms;
    } catch (Exception $e) {
        writeLog("Error getting rooms: " . $e->getMessage());
        return [];
    }
}

/**
 * Get the last update time from the game_state table
 * 
 * @return string|null The last_update_datetime as a string or null if not found
 */
function getLastUpdateTime() {
    global $gameStateData;
    try {
        if (isset($gameStateData['last_update_datetime'])) {
            return $gameStateData['last_update_datetime'];
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

    // Get client configuration
    $config = getClientConfig();
    $gridWidth = $config['gridWidth'];
    $gridHeight = $config['gridHeight'];

    // Initialize empty grid and selections grid
    $grid = array_fill(0, $gridHeight, array_fill(0, $gridWidth, null));

    // Get rooms from the database
    $rooms = getRooms();

    // Ensure no infinite loops in grid processing
    foreach ($rooms as $y => $row) {
        if ($y >= $gridHeight) break; // Prevent out-of-bounds processing
        foreach ($row as $x => $room) {
            if ($x >= $gridWidth) break; // Prevent out-of-bounds processing
            $grid[$y][$x] = $room;
        }
    }

    // Get the last update time
    $lastUpdateTime = getLastUpdateTime();

    // Explicitly handle the timestamp as UTC when converting to Unix timestamp
    $lastUpdateTimestamp = $lastUpdateTime ? strtotime($lastUpdateTime . ' UTC') : time();

    // Ensure the timestamp is treated as UTC and includes timezone info
    $lastUpdateTimeIso = $lastUpdateTime ? gmdate('c', strtotime($lastUpdateTime . ' UTC')) : gmdate('c');

    // Check if an update is in progress
    $updateInProgress = isUpdateInProgress();

    // Calculate next update time
    $nextUpdateTime = getNextUpdateTime();

    // Build the state object
    $state = [
        'grid' => $grid,
        'timestamp' => time(),
        'lastUpdateTime' => $lastUpdateTimeIso, // ISO format with UTC timezone marker
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
} catch (PDOException $e) {
    writeLog("Database error in gameState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'A database error occurred. Please try again later.']);
} catch (Exception $e) {
    writeLog("Error in gameState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected error occurred. Please try again later.']);
}
?>
