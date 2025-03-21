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

if (!isset($data['grid']) || !isset($data['playerID'])) {
    $error = "Missing required data (grid or playerID)";
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
    
    // Get the previous state to compare with
    $prevStmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $prevRow = $prevStmt->fetch();
    
    if ($prevRow) {
        $prevState = json_decode($prevRow['state'], true);
    } else {
        // Initial empty state if no previous state exists
        $gridHeight = 30;
        $gridWidth = 20;
        $prevState = [
            'grid' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0)),
            'selected' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, 0)),
            'selectionOwners' => array_fill(0, $gridHeight, array_fill(0, $gridWidth, null))
        ];
    }
    
    // Initialize or get selection owners tracking
    if (!isset($prevState['selectionOwners'])) {
        $gridHeight = count($data['grid']);
        $gridWidth = count($data['grid'][0]);
        $prevState['selectionOwners'] = array_fill(0, $gridHeight, array_fill(0, $gridWidth, null));
    }
    
    // Track new selections by this player
    $selectionCount = 0;
    $selectionOwners = $prevState['selectionOwners'];
    
    for ($y = 0; $y < count($data['selected']); $y++) {
        for ($x = 0; $x < count($data['selected'][$y]); $x++) {
            // If this is a newly selected cell
            if ($data['selected'][$y][$x] === 1 && 
                (!isset($prevState['selected'][$y][$x]) || $prevState['selected'][$y][$x] === 0)) {
                $selectionOwners[$y][$x] = $playerID;
                $selectionCount++;
            }
        }
    }
    
    // Add owner information to the data
    $data['selectionOwners'] = $selectionOwners;
    
    // Add a timestamp to track when this state was created
    $data['timestamp'] = time();
    
    // Save the updated state to the database
    $state = json_encode($data);
    $stmt = $pdo->prepare("INSERT INTO tower_state (state) VALUES (:state)");
    $stmt->execute(['state' => $state]);
    
    writeLog("Player $playerID saved state with $selectionCount new selections");
    echo json_encode(['success' => true, 'timestamp' => $data['timestamp']]);
} catch (Exception $e) {
    $error = "Error saving game state: " . $e->getMessage();
    writeLog($error);
    echo json_encode(['success' => false, 'error' => $error]);
}
?>
