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
$gridWidth = isset($config['gridWidth']) ? $config['gridWidth'] : 20;
$gridHeight = isset($config['gridHeight']) ? $config['gridHeight'] : 30;

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
    
    // Fetch all constructed rooms
    $constructedRooms = $pdo->query("
        SELECT location_x, location_y 
        FROM rooms 
        WHERE status = 'constructed'
    ")->fetchAll();

    // If no constructed rooms exist, only allow placement in the lowest row
    $constructedCoords = array_map(function($room) {
        return ['x' => $room['location_x'], 'y' => $room['location_y']];
    }, $constructedRooms);

    // Define possible sector types
    $sectorTypes = ['housing', 'entertainment', 'weapons', 'food', 'technical'];

    // Ensure no infinite loops in planned room generation
    $maxAttempts = 100; // Limit attempts to prevent infinite loops
    $attempts = 0;
    while ($addedRooms < $numPlannedRooms && $attempts < $maxAttempts) {
        $attempts++;
        // Randomly select a location using centralized grid dimensions
        $x = rand(0, $gridWidth - 1);
        $y = rand(0, $gridHeight - 1);

        $isAdjacent = false;

        // Check adjacency to constructed rooms
        foreach ($constructedCoords as $coord) {
            if (abs($coord['x'] - $x) <= 1 && abs($coord['y'] - $y) <= 1) {
                $isAdjacent = true;
                break;
            }
        }

        // Allow placement in the lowest row based on centralized grid height
        if ($y === ($gridHeight - 1) || $isAdjacent) {
            // Check if the location is already occupied
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM rooms 
                WHERE location_x = :x AND location_y = :y
            ");
            $stmt->execute(['x' => $x, 'y' => $y]);
            $isOccupied = $stmt->fetch()['count'] > 0;

            if (!$isOccupied) {
                // Assign a random sector type
                $sectorType = $sectorTypes[array_rand($sectorTypes)];

                // Insert the planned room
                $insertStmt = $pdo->prepare("
                    INSERT INTO rooms 
                    (sector_type, location_x, location_y, maintenance_level, status, created_datetime) 
                    VALUES 
                    (:sector_type, :location_x, :location_y, 1.0, 'planned', :created_datetime)
                ");
                $insertStmt->execute([
                    'sector_type' => $sectorType,
                    'location_x' => $x,
                    'location_y' => $y,
                    'created_datetime' => $currentUtcDateTime
                ]);

                $addedRooms++;
            }
        }
    }

    if ($attempts >= $maxAttempts) {
        writeLog("Reached maximum attempts while adding planned rooms.");
    }

    return $addedRooms;
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

    // Log the number of planned rooms added
    writeLog("Added {$plannedRoomsAdded} planned rooms.");

    // Count all rooms for logging
    $roomCountStmt = $pdo->query("SELECT COUNT(*) as total_rooms FROM rooms");
    $totalRooms = $roomCountStmt->fetch()['total_rooms'];

    // Log success.
    writeLog("Game state updated successfully. {$roomsCreated} new rooms created. Total room count: {$totalRooms}");
    writeLog("Last update time set to: {$currentUtcDateTime} UTC");
    echo json_encode([
        'success' => true, 
        'roomsCreated' => $roomsCreated,
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
