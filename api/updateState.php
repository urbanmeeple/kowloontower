<?php
header('Content-Type: application/json');
require_once('../config.php');
require_once('../utils/logger.php'); // Include centralized logger

// Define the cron job log file path
$logFile = dirname(__FILE__) . '/../logs/cron.log';

// Log the start of the cron job
writeLog("Cron job started.", $logFile);

// Enforce that this script can only be run from the command line (cronjob) or with the correct secret key
$isCommandLine = (php_sapi_name() === 'cli');
$hasValidKey = isset($_GET['key']) && $_GET['key'] === $secret_key;

if (!$isCommandLine && !$hasValidKey) {
    $msg = "Unauthorized access attempt. This script can only be run from a cronjob or with proper authorization.";
    writeLog($msg, $logFile);
    http_response_code(403);
    echo json_encode(['error' => $msg]);
    exit;
}

// Define grid dimensions from centralized config - FIX: use clientConfig instead of config
$gridWidth = $clientConfig['gridWidth'];
$gridHeight = $clientConfig['gridHeight'];
writeLog("Using grid dimensions: width={$gridWidth}, height={$gridHeight}", $logFile);

/**
 * Add new planned rooms to the game
 * 
 * @param int $numPlannedRooms Number of planned rooms to add
 * @return int Number of planned rooms successfully added
 */
function addPlannedRooms($numPlannedRooms) {
    global $pdo, $gridWidth, $gridHeight, $logFile;
    
    $addedRooms = 0;
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
    // Fetch all occupied locations (constructed or planned rooms)
    $occupiedRooms = $pdo->query("SELECT location_x, location_y FROM rooms")->fetchAll();
    $occupiedCount = count($occupiedRooms);
    writeLog("Found {$occupiedCount} occupied room locations", $logFile);
    
    $occupiedCoords = array_map(function($room) {
        return ['x' => $room['location_x'], 'y' => $room['location_y']];
    }, $occupiedRooms);

    // Precompute valid locations for planned rooms
    $validLocations = [];
    
    // First priority: All unoccupied cells in the bottom row are valid
    $bottomRowY = $gridHeight - 1;
    for ($x = 0; $x < $gridWidth; $x++) {
        $isOccupied = false;
        foreach ($occupiedCoords as $coord) {
            if ($coord['x'] === $x && $coord['y'] === $bottomRowY) {
                $isOccupied = true;
                break;
            }
        }
        if (!$isOccupied) {
            $validLocations[] = ['x' => $x, 'y' => $bottomRowY];
        }
    }
    
    // Second priority: locations adjacent to constructed rooms
    if (!empty($occupiedCoords)) {
        $constructedRooms = $pdo->query("SELECT location_x, location_y FROM rooms WHERE status IN ('new_constructed', 'old_constructed')")->fetchAll();
        $constructedCoords = array_map(function($room) {
            return ['x' => $room['location_x'], 'y' => $room['location_y']];
        }, $constructedRooms);
        
        // Check all grid positions
        for ($x = 0; $x < $gridWidth; $x++) {
            for ($y = 0; $y < $gridHeight; $y++) {
                // Skip bottom row (already processed) and occupied cells
                if ($y === $bottomRowY || isLocationOccupied($x, $y, $occupiedCoords)) {
                    continue;
                }
                
                // Check if adjacent to any constructed room
                if (isAdjacentToConstructed($x, $y, $constructedCoords)) {
                    $validLocations[] = ['x' => $x, 'y' => $y];
                }
            }
        }
    }
    
    $validCount = count($validLocations);
    writeLog("Found {$validCount} valid locations for planned rooms", $logFile);
    
    // Randomly select valid locations for planned rooms
    shuffle($validLocations);
    $sectorTypes = ['housing', 'entertainment', 'weapons', 'food', 'technical'];
    
    foreach (array_slice($validLocations, 0, $numPlannedRooms) as $location) {
        $sectorType = $sectorTypes[array_rand($sectorTypes)];
        $insertStmt = $pdo->prepare("
            INSERT INTO rooms 
            (sector_type, location_x, location_y, wear, status, created_datetime) 
            VALUES 
            (:sector_type, :location_x, :location_y, 0, 'planned', :created_datetime)
        ");
        try {
            $insertStmt->execute([
                'sector_type' => $sectorType,
                'location_x' => $location['x'],
                'location_y' => $location['y'],
                'created_datetime' => $currentUtcDateTime
            ]);
            $addedRooms++;
            writeLog("Added planned {$sectorType} room at x={$location['x']}, y={$location['y']}", $logFile);
        } catch (PDOException $e) {
            writeLog("Error adding planned room: " . $e->getMessage(), $logFile);
        }
    }

    return $addedRooms;
}

/**
 * Check if a location is already occupied
 * 
 * @param int $x X coordinate
 * @param int $y Y coordinate
 * @param array $occupiedCoords Array of occupied coordinates
 * @return bool True if occupied, false otherwise
 */
function isLocationOccupied($x, $y, $occupiedCoords) {
    foreach ($occupiedCoords as $coord) {
        if ($coord['x'] === $x && $coord['y'] === $y) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a location is adjacent to a constructed room
 * 
 * @param int $x X coordinate
 * @param int $y Y coordinate
 * @param array $constructedCoords Array of constructed room coordinates
 * @return bool True if adjacent, false otherwise
 */
function isAdjacentToConstructed($x, $y, $constructedCoords) {
    foreach ($constructedCoords as $coord) {
        // Only consider direct neighbors (no diagonals)
        if (
            ($coord['x'] === $x && abs($coord['y'] - $y) === 1) || // Above or below
            ($coord['y'] === $y && abs($coord['x'] - $x) === 1)    // Left or right
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Update room statuses before processing bids.
 */
function updateRoomStatuses() {
    global $pdo, $logFile;

    // Change all rooms with status "new_constructed" to "old_constructed"
    $updateRoomStatusStmt = $pdo->prepare("UPDATE rooms SET status = 'old_constructed' WHERE status = 'new_constructed'");
    $updateRoomStatusStmt->execute();
    writeLog("Updated all 'new_constructed' rooms to 'old_constructed'", $logFile);
}

/**
 * Remove unconstructed planned rooms after processing bids.
 */
function removeUnconstructedPlannedRooms() {
    global $pdo, $logFile;

    // Delete all planned rooms that were not constructed
    $deletePlannedRoomsStmt = $pdo->prepare("DELETE FROM rooms WHERE status = 'planned'");
    $deletedCount = $deletePlannedRoomsStmt->execute();
    writeLog("Removed {$deletedCount} unconstructed planned rooms", $logFile);
}

/**
 * Process bids and convert planned rooms to constructed rooms.
 */
function processBids() {
    global $pdo, $logFile;

    $currentUtcDateTime = gmdate('Y-m-d H:i:s');

    // Remove bids with status "old_winner" or "old_loser"
    $deleteStmt = $pdo->prepare("DELETE FROM bids WHERE status IN ('old_winner', 'old_loser')");
    $deleteStmt->execute();
    writeLog("Removed processed bids with status 'old_winner' or 'old_loser'", $logFile);

    // Fetch all planned rooms
    $plannedRoomsStmt = $pdo->query("SELECT roomID FROM rooms WHERE status = 'planned'");
    $plannedRooms = $plannedRoomsStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($plannedRooms as $roomID) {
        // Fetch all "new" bids for the room
        $bidsStmt = $pdo->prepare("SELECT b.bidID, b.amount, b.playerID, p.money 
            FROM bids b 
            JOIN players p ON b.playerID = p.playerID 
            WHERE b.roomID = :roomID AND b.status = 'new' 
            ORDER BY b.amount DESC, b.placed_datetime ASC");
        $bidsStmt->execute(['roomID' => $roomID]);
        $bids = $bidsStmt->fetchAll();

        if (empty($bids)) {
            continue; // No bids for this room
        }

        $winningBid = null;
        $losingBids = [];

        // Determine the winning bid
        foreach ($bids as $bid) {
            if ($bid['money'] >= $bid['amount']) {
                $winningBid = $bid;
                break;
            } else {
                $losingBids[] = $bid;
            }
        }

        if ($winningBid) {
            // Deduct money from the winning player
            $updateMoneyStmt = $pdo->prepare("UPDATE players SET money = money - :amount WHERE playerID = :playerID");
            $updateMoneyStmt->execute([
                'amount' => $winningBid['amount'],
                'playerID' => $winningBid['playerID']
            ]);

            // Update room status to "new_constructed" and assign ownership
            $updateRoomStmt = $pdo->prepare("UPDATE rooms 
                SET status = 'new_constructed', created_datetime = :created_datetime, wear = 0 
                WHERE roomID = :roomID");
            $updateRoomStmt->execute([
                'created_datetime' => $currentUtcDateTime,
                'roomID' => $roomID
            ]);

            // Add ownership to players_rooms table
            $insertOwnershipStmt = $pdo->prepare("INSERT INTO players_rooms (playerID, roomID) 
                VALUES (:playerID, :roomID)");
            $insertOwnershipStmt->execute([
                'playerID' => $winningBid['playerID'],
                'roomID' => $roomID
            ]);

            // Mark the winning bid as "old_winner"
            $updateWinningBidStmt = $pdo->prepare("UPDATE bids SET status = 'old_winner' WHERE bidID = :bidID");
            $updateWinningBidStmt->execute(['bidID' => $winningBid['bidID']]);

            writeLog("Room {$roomID} constructed by player {$winningBid['playerID']} with bid {$winningBid['amount']}", $logFile);
        }

        // Process losing bids
        foreach ($bids as $bid) {
            if ($winningBid && $bid['bidID'] === $winningBid['bidID']) {
                continue; // Skip the winning bid
            }

            // Refund money to losing bidders
            $refundStmt = $pdo->prepare("UPDATE players SET money = money + :amount WHERE playerID = :playerID");
            $refundStmt->execute([
                'amount' => $bid['amount'],
                'playerID' => $bid['playerID']
            ]);

            // Mark the bid as "old_loser"
            $updateLosingBidStmt = $pdo->prepare("UPDATE bids SET status = 'old_loser' WHERE bidID = :bidID");
            $updateLosingBidStmt->execute(['bidID' => $bid['bidID']]);

            $losingBids[] = $bid;
        }

        writeLog("Processed bids for room {$roomID}: winner=" . (isset($winningBid['bidID']) ? $winningBid['bidID'] : 'none') . ", losers=" . count($losingBids), $logFile);
    }
}

function cacheGameData() {
    global $pdo, $appCacheFile, $logFile;
    $data = [];
    $playerIDToUsername = [];

    // Fetch players incrementally
    $stmtPlayers = $pdo->query("SELECT playerID, username FROM players");
    while ($player = $stmtPlayers->fetch(PDO::FETCH_ASSOC)) {
        $playerIDToUsername[$player['playerID']] = $player['username'];
    }
    unset($stmtPlayers);

    // Write JSON incrementally for large datasets
    $cacheHandle = fopen($appCacheFile, 'w');
    fwrite($cacheHandle, '{');

    // Fetch rooms incrementally
    fwrite($cacheHandle, '"rooms":[');
    $stmtRooms = $pdo->query("SELECT * FROM rooms");
    $first = true;
    while ($room = $stmtRooms->fetch(PDO::FETCH_ASSOC)) {
        if (!$first) fwrite($cacheHandle, ',');
        fwrite($cacheHandle, json_encode($room));
        $first = false;
    }
    fwrite($cacheHandle, '],');
    unset($stmtRooms);

    // Fetch bids incrementally
    fwrite($cacheHandle, '"bids":[');
    $stmtBids = $pdo->query("SELECT * FROM bids");
    $first = true;
    while ($bid = $stmtBids->fetch(PDO::FETCH_ASSOC)) {
        $bid['username'] = $playerIDToUsername[$bid['playerID']] ?? 'Unknown';
        unset($bid['playerID']);
        if (!$first) fwrite($cacheHandle, ',');
        fwrite($cacheHandle, json_encode($bid));
        $first = false;
    }
    fwrite($cacheHandle, '],');
    unset($stmtBids);

    // Fetch players_rooms incrementally
    fwrite($cacheHandle, '"players_rooms":[');
    $stmtPlayersRooms = $pdo->query("SELECT * FROM players_rooms");
    $first = true;
    while ($pr = $stmtPlayersRooms->fetch(PDO::FETCH_ASSOC)) {
        $pr['username'] = $playerIDToUsername[$pr['playerID']] ?? 'Unknown';
        unset($pr['playerID']);
        if (!$first) fwrite($cacheHandle, ',');
        fwrite($cacheHandle, json_encode($pr));
        $first = false;
    }
    fwrite($cacheHandle, '],');
    unset($stmtPlayersRooms);

    // Fetch game_state incrementally
    fwrite($cacheHandle, '"game_state":[');
    $stmtGameState = $pdo->query("SELECT * FROM game_state");
    $first = true;
    while ($state = $stmtGameState->fetch(PDO::FETCH_ASSOC)) {
        if (!$first) fwrite($cacheHandle, ',');
        fwrite($cacheHandle, json_encode($state));
        $first = false;
    }
    fwrite($cacheHandle, ']');
    unset($stmtGameState);

    fwrite($cacheHandle, '}');
    fclose($cacheHandle);

    writeLog("Cached game data to {$appCacheFile}", $logFile);
}

try {
    // Use flock() for robust locking
    $lockFile = dirname(__FILE__) . '/../temp/updateState.lock';
    $lockHandle = fopen($lockFile, 'w');
    if (!$lockHandle || !flock($lockHandle, LOCK_EX | LOCK_NB)) {
        writeLog("Cron job already running. Exiting.", $logFile);
        exit;
    }

    // Update room statuses before processing bids
    updateRoomStatuses();

    // Process bids and update room statuses
    processBids();

    // Remove unconstructed planned rooms
    removeUnconstructedPlannedRooms();

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
        writeLog("Initialized game_state table with first record", $logFile);
    }

    // Add new planned rooms
    $numPlannedRooms = 5; // Configurable number of planned rooms
    $plannedRoomsAdded = addPlannedRooms($numPlannedRooms);
    writeLog("Added {$plannedRoomsAdded} planned rooms", $logFile);

    // Cache game data
    cacheGameData();

    // Count all rooms for logging
    $roomCountStmt = $pdo->query("SELECT COUNT(*) as total_rooms FROM rooms");
    $totalRooms = $roomCountStmt->fetch()['total_rooms'];

    // Log success with correct variable order
    writeLog("Game state updated successfully. {$plannedRoomsAdded} new rooms added. Total room count: {$totalRooms}", $logFile);
    writeLog("Last update time set to: {$currentUtcDateTime} UTC", $logFile);
    echo json_encode([
        'success' => true, 
        'roomsCreated' => $plannedRoomsAdded,
        'totalRooms' => $totalRooms,
        'lastUpdateTime' => $currentUtcDateTime
    ]);
} catch (PDOException $e) {
    writeLog("Database error in updateState.php: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['error' => 'A database error occurred.']);
} catch (Exception $e) {
    writeLog("Error in updateState.php: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected error occurred.']);
} finally {
    // Ensure lock file is released
    if ($lockHandle) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        unlink($lockFile);
    }
}
?>
