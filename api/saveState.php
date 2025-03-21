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

// Get the POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['selected']) || !isset($data['playerID'])) {
    $error = "Missing required data (selections or playerID)";
    writeLog($error);
    echo json_encode(['success' => false, 'error' => $error]);
    exit;
}

try {
    // Validate player exists
    $playerID = $data['playerID'];
    $stmt = $pdo->prepare("SELECT playerID FROM players WHERE playerID = :playerID");
    $stmt->execute(['playerID' => $playerID]);
    $player = $stmt->fetch();
    
    if (!$player) {
        $error = "Player not found with ID: $playerID";
        writeLog($error);
        echo json_encode(['success' => false, 'error' => $error]);
        exit;
    }
    
    // Track new selections by this player
    $selectionCount = 0;
    $currentUtcDateTime = gmdate('Y-m-d H:i:s');
    
    // Begin transaction for database consistency
    $pdo->beginTransaction();
    
    // First, clean up any unprocessed selections by this player
    $cleanupStmt = $pdo->prepare("DELETE FROM selected_spaces WHERE playerID = :playerID AND processed = 0");
    $cleanupStmt->execute(['playerID' => $playerID]);
    
    // Now add the new selections
    $insertStmt = $pdo->prepare("
        INSERT INTO selected_spaces 
        (playerID, location_x, location_y, selection_datetime, processed) 
        VALUES 
        (:playerID, :x, :y, :datetime, 0)
    ");
    
    for ($y = 0; $y < count($data['selected']); $y++) {
        for ($x = 0; $x < count($data['selected'][$y]); $x++) {
            if ($data['selected'][$y][$x] === 1) {
                // Check if a room or existing selection already exists at this location
                $checkStmt = $pdo->prepare("
                    SELECT 
                        (SELECT COUNT(*) FROM rooms WHERE location_x = :x AND location_y = :y) as room_count,
                        (SELECT COUNT(*) FROM selected_spaces WHERE location_x = :x AND location_y = :y AND processed = 0) as selection_count
                ");
                $checkStmt->execute(['x' => $x, 'y' => $y]);
                $result = $checkStmt->fetch();
                
                if ($result['room_count'] == 0 && $result['selection_count'] == 0) {
                    // Location is free, add the selection
                    $insertStmt->execute([
                        'playerID' => $playerID,
                        'x' => $x,
                        'y' => $y,
                        'datetime' => $currentUtcDateTime
                    ]);
                    $selectionCount++;
                }
            }
        }
    }
    
    // Commit the transaction
    $pdo->commit();
    
    writeLog("Player $playerID saved $selectionCount new selections");
    echo json_encode([
        'success' => true, 
        'selectionCount' => $selectionCount,
        'timestamp' => time()
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    writeLog("Database error in saveState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    writeLog("Error in saveState.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An unexpected error occurred.']);
}
?>
