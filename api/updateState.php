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
 * Generates a new block to add to the current tower state.
 *
 * @param array $currentState Current state array with a 'blocks' key.
 * @return array Updated state array with the new block added.
 */
function generateNewBlock($currentState) {
    $blocks = $currentState['blocks'];
    $blockCount = count($blocks);

    $newBlock = [
        'id'    => $blockCount + 1,
        'x'     => 50, // Fixed x-coordinate (update as needed)
        'y'     => 500 - ($blockCount * 30), // Simple stacking logic
        'color' => sprintf('#%06X', mt_rand(0, 0xFFFFFF)) // Random color for variety
    ];

    $blocks[] = $newBlock;
    return ['blocks' => $blocks];
}

try {
    // Retrieve the current tower state.
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    $currentState = $row ? json_decode($row['state'], true) : ['blocks' => []];

    // Generate a new state by adding a new block.
    $newState = generateNewBlock($currentState);
    $newStateJson = json_encode($newState);

    // Insert the updated state into the database.
    $stmt = $pdo->prepare("INSERT INTO tower_state (state) VALUES (:state)");
    $stmt->execute(['state' => $newStateJson]);

    // Log success.
    writeLog("Game state updated successfully. New block count: " . count($newState['blocks']));
    echo json_encode(['success' => true, 'state' => $newState]);
} catch (Exception $e) {
    $msg = "Error updating game state: " . $e->getMessage();
    writeLog($msg);
    echo json_encode(['error' => $msg]);
}
?>
