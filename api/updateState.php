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

// Define grid dimensions from centralized config
$gridWidth = $config['gridWidth'];
$gridHeight = $config['gridHeight'];

/**
 * Add new planned rooms to the game
 * 
 * @param int $numPlannedRooms Number of planned rooms to add
 * @return int Number of planned rooms successfully added
 */
function addPlannedRooms($numPlannedRooms) {
    global $pdo, $gridWidth, $gridHeight;
    
    $addedRooms = 0;
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
    // Fetch all occupied locations (constructed or planned rooms)
    $occupiedRooms = $pdo->query("SELECT location_x, location_y FROM rooms")->fetchAll();
    $occupiedCoords = array_map(function($room) {
        return ['x' => $room['location_x'], 'y' => $room['location_y']];
    }, $occupiedRooms);

    // Fetch all constructed rooms
    $constructedRooms = $pdo->query("SELECT location_x, location_y FROM rooms WHERE status = 'constructed'")->fetchAll();
    $constructedCoords = array_map(function($room) {
        return ['x' => $room['location_x'], 'y' => $room['location_y']];
    }, $constructedRooms);

    // Precompute valid locations for planned rooms
    $validLocations = [];
    for ($x = 0; $x < $gridWidth; $x++) {
        for ($y = 0; $y < $gridHeight; $y++) {
            // Skip if the location is already occupied
            $isOccupied = false;
            foreach ($occupiedCoords as $coord) {
                if ($coord['x'] === $x && $coord['y'] === $y) {
                    $isOccupied = true;
                    break;
                }
            }
            if ($isOccupied) {
                continue;
            }

            // Allow placement in the bottom row
            if ($y === $gridHeight - 1) {
                $validLocations[] = ['x' => $x, 'y' => $y];
                continue;
            }

            // Allow placement adjacent to any constructed room
            $isAdjacent = false;
            foreach ($constructedCoords as $coord) {
                if (abs($coord['x'] - $x) <= 1 && abs($coord['y'] - $y) <= 1) {
                    $isAdjacent = true;
                    break;
                }
            }
            if ($isAdjacent) {
                $validLocations[] = ['x' => $x, 'y' => $y];
            }
        }
    }

    // Randomly select valid locations for planned rooms
    shuffle($validLocations);
    $sectorTypes = ['housing', 'entertainment', 'weapons', 'food', 'technical'];
    foreach (array_slice($validLocations, 0, $numPlannedRooms) as $location) {
        $sectorType = $sectorTypes[array_rand($sectorTypes)];
        $insertStmt = $pdo->prepare("
            INSERT INTO rooms 
            (sector_type, location_x, location_y, maintenance_level, status, created_datetime) 
            VALUES 
            (:sector_type, :location_x, :location_y, 1.0, 'planned', :created_datetime)
        ");
        $insertStmt->execute([
            'sector_type' => $sectorType,
            'location_x' => $location['x'],
            'location_y' => $location['y'],
            'created_datetime' => $currentUtcDateTime
        ]);
        $addedRooms++;
    }

    return $addedRooms;
}

function cacheGameData() {
    global $pdo, $appCacheFile;
    // This function caches relevant tables into a JSON file
    $data = [];

    // Fetch all rooms
    $stmtRooms = $pdo->query("SELECT * FROM rooms");
    $data['rooms'] = $stmtRooms->fetchAll(PDO::FETCH_ASSOC);

    // Fetch all players
    $stmtPlayers = $pdo->query("SELECT * FROM players");
    $data['players'] = $stmtPlayers->fetchAll(PDO::FETCH_ASSOC);

    // Fetch all bids
    $stmtBids = $pdo->query("SELECT * FROM bids");
    $data['bids'] = $stmtBids->fetchAll(PDO::FETCH_ASSOC);

    // Fetch join table
    $stmtPlayersRooms = $pdo->query("SELECT * FROM players_rooms");
    $data['players_rooms'] = $stmtPlayersRooms->fetchAll(PDO::FETCH_ASSOC);

    // Fetch game state
    $stmtGameState = $pdo->query("SELECT * FROM game_state");
    $data['game_state'] = $stmtGameState->fetchAll(PDO::FETCH_ASSOC);

    // Build a mapping from playerID to username
    $playerIDToUsername = [];
    foreach ($data['players'] as &$p) {
        $playerIDToUsername[$p['playerID']] = $p['username'];
        unset($p['playerID']); // Remove playerID from the players array
    }
    unset($p);

    // Replace playerID with username in 'bids'
    foreach ($data['bids'] as &$bid) {
        $bid['username'] = $playerIDToUsername[$bid['playerID']] ?? 'Unknown';
        unset($bid['playerID']);
    }
    unset($bid);

    // Replace playerID with username in 'players_rooms'
    foreach ($data['players_rooms'] as &$pr) {
        $pr['username'] = $playerIDToUsername[$pr['playerID']] ?? 'Unknown';
        unset($pr['playerID']);
    }
    unset($pr);

    file_put_contents($appCacheFile, json_encode($data));
    writeLog("Cached game data to {$appCacheFile}");
}

try {
    // Prevent overlapping cron jobs using a lock file
    $lockFile = dirname(__FILE__) . '/../temp/updateState.lock';
    if (file_exists($lockFile)) {
        $lockAge = time() - filemtime($lockFile);
        if ($lockAge < 60) { // If lock file is less than 60 seconds old, exit
            writeLog("Cron job already running. Exiting.");
            exit;
        }
    }
    touch($lockFile); // Create or update lock file

    // Get current UTC datetime for updating the game state
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
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

    // Add new planned rooms
    $numPlannedRooms = 5; // Configurable number of planned rooms
    $plannedRoomsAdded = addPlannedRooms($numPlannedRooms);

    // Log the number of planned rooms added (fixed variable name)
    writeLog("Game state updated successfully. {$plannedRoomsAdded} new rooms added. Total room count: {$totalRooms}");

    // Cache game data
    cacheGameData();

    // Count all rooms for logging
    $roomCountStmt = $pdo->query("SELECT COUNT(*) as total_rooms FROM rooms");
    $totalRooms = $roomCountStmt->fetch()['total_rooms'];

    // Log success.
    writeLog("Game state updated successfully. {$plannedRoomsAdded} new rooms added. Total room count: {$totalRooms}");
    writeLog("Last update time set to: {$currentUtcDateTime} UTC");
    echo json_encode([
        'success' => true, 
        'roomsCreated' => $plannedRoomsAdded,
        'totalRooms' => $totalRooms,
        'lastUpdateTime' => $currentUtcDateTime
    ]);
    unlink($lockFile); // Remove lock file after successful execution
} catch (PDOException $e) {
    writeLog("Database error in updateState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'A database error occurred.']);
} catch (Exception $e) {
    writeLog("Error in updateState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected error occurred.']);
} finally {
    if (file_exists($lockFile)) {
        unlink($lockFile); // Ensure lock file is removed in case of errors
    }
}
?>
