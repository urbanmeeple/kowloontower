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

// Check if an update is in progress
function isUpdateInProgress() {
    global $pdo;

    try {
        // Get the last update time
        $stmt = $pdo->query("SELECT last_update_datetime FROM game_state LIMIT 1");
        $row = $stmt->fetch();

        if (!$row) {
            return false;
        }

        $lastUpdateTime = strtotime($row['last_update_datetime']);
        $currentTime = time();

        // Consider an update in progress if we're within 10 seconds of the minute mark
        $secondsInCurrentMinute = $currentTime % 60;

        return $secondsInCurrentMinute >= 50 || $secondsInCurrentMinute < 10;
    } catch (Exception $e) {
        writeLog("Error checking update status: " . $e->getMessage());
        return false;
    }
}

try {
    // Get the POST data
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['selections']) || !isset($data['playerID'])) {
        $error = "Missing required data (selections or playerID)";
        writeLog($error);
        echo json_encode(['success' => false, 'error' => $error]);
        exit;
    }

    // Only accept selections if an update is in progress
    if (!isUpdateInProgress()) {
        $message = "No update in progress. Selections not accepted at this time.";
        writeLog($message);
        echo json_encode(['success' => false, 'message' => $message]);
        exit;
    }

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

    // Store the pending selections in a temporary file for the updateState.php to process
    $selectionsFile = dirname(__FILE__) . '/../temp/selections_' . $playerID . '.json';

    // Make sure the temp directory exists
    $tempDir = dirname(__FILE__) . '/../temp';
    if (!file_exists($tempDir)) {
        mkdir($tempDir, 0755, true);
    }

    // Save selections to temp file
    $selectionCount = count($data['selections']);
    $success = file_put_contents($selectionsFile, json_encode($data['selections']));

    if ($success) {
        writeLog("Player $playerID sent $selectionCount selections for processing");
        echo json_encode([
            'success' => true,
            'selectionCount' => $selectionCount
        ]);
    } else {
        $error = "Failed to save selections for processing";
        writeLog($error);
        echo json_encode(['success' => false, 'error' => $error]);
    }
} catch (PDOException $e) {
    writeLog("Database error in sendSelections.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
} catch (Exception $e) {
    writeLog("Error in sendSelections.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An unexpected error occurred.']);
}
?>
