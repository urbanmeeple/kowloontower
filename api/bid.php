<?php
header('Content-Type: application/json');
require_once('../config.php');

// Define log file path
$logFile = dirname(__FILE__) . '/../logs/game.log';

// Logging function
function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// Function to sanitize input to prevent XSS attacks
function sanitizeInput($data) {
    return htmlspecialchars(strip_tags(trim($data)));
}

// Handle DELETE request - Remove a bid by ID
if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && isset($_GET['bidID'])) {
    $bidID = intval($_GET['bidID']);
    writeLog("Attempting to remove bid with ID: $bidID");
    
    try {
        // First check if the bid exists
        $checkStmt = $pdo->prepare("SELECT * FROM bids WHERE bidID = :bidID");
        $checkStmt->execute(['bidID' => $bidID]);
        $bid = $checkStmt->fetch();
        
        if (!$bid) {
            writeLog("Bid not found: $bidID");
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Bid not found'
            ]);
            exit;
        }
        
        // Delete the bid
        $deleteStmt = $pdo->prepare("DELETE FROM bids WHERE bidID = :bidID");
        $deleteStmt->execute(['bidID' => $bidID]);
        
        writeLog("Bid {$bidID} successfully removed");
        echo json_encode([
            'success' => true,
            'message' => 'Bid removed successfully'
        ]);
    } catch (Exception $e) {
        writeLog("Database error when removing bid: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage()
        ]);
    }
}
// Handle GET request - Fetch bids by player ID
else if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['playerID'])) {
    $playerID = sanitizeInput($_GET['playerID']);
    writeLog("Fetching bids for player ID: $playerID");
    
    try {
        // Query active bids for the player (status is either 'new' or 'active')
        $stmt = $pdo->prepare("SELECT * FROM bids WHERE playerID = :playerID AND status IN ('new', 'active')");
        $stmt->execute(['playerID' => $playerID]);
        $bids = $stmt->fetchAll();
        
        writeLog("Found " . count($bids) . " active bids for player $playerID");
        
        echo json_encode([
            'success' => true,
            'bids' => $bids
        ]);
    } catch (Exception $e) {
        writeLog("Database error when fetching bids: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error'
        ]);
    }
}
// Handle POST request - Create a new bid
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get JSON data from request body
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($data['type']) || !isset($data['roomID']) || !isset($data['amount']) || !isset($data['playerID'])) {
        writeLog("Missing required fields for bid creation");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing required fields'
        ]);
        exit;
    }
    
    $type = sanitizeInput($data['type']);
    $roomID = intval($data['roomID']);
    $amount = intval($data['amount']);
    $playerID = sanitizeInput($data['playerID']);
    
    writeLog("Creating new {$type} bid for room {$roomID} by player {$playerID} for {$amount}");
    
    try {
        // Verify player exists
        $playerStmt = $pdo->prepare("SELECT * FROM players WHERE playerID = :playerID");
        $playerStmt->execute(['playerID' => $playerID]);
        $player = $playerStmt->fetch();
        
        if (!$player) {
            writeLog("Player not found: $playerID");
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Player not found'
            ]);
            exit;
        }
        
        // Verify player has enough money available
        // First get total of active bids
        $activeStmt = $pdo->prepare("SELECT SUM(amount) AS total FROM bids WHERE playerID = :playerID AND status IN ('new', 'active')");
        $activeStmt->execute(['playerID' => $playerID]);
        $activeBids = $activeStmt->fetch();
        $activeBidsTotal = $activeBids['total'] ?: 0;
        
        // Check if player has enough available money
        $availableMoney = $player['money'] - $activeBidsTotal;
        
        if ($amount > $availableMoney) {
            writeLog("Insufficient funds: player has {$availableMoney} available, bid is {$amount}");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Insufficient funds'
            ]);
            exit;
        }
        
        // Verify room exists
        $roomStmt = $pdo->prepare("SELECT * FROM rooms WHERE roomID = :roomID");
        $roomStmt->execute(['roomID' => $roomID]);
        $room = $roomStmt->fetch();
        
        if (!$room) {
            writeLog("Room not found: $roomID");
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Room not found'
            ]);
            exit;
        }
        
        // Check if bid type matches room status
        if ($type === 'construct' && $room['status'] !== 'planned') {
            writeLog("Invalid bid type: cannot construct non-planned room");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Cannot place construction bid on a constructed room'
            ]);
            exit;
        }
        
        if ($type === 'buy' && $room['status'] !== 'constructed') {
            writeLog("Invalid bid type: cannot buy planned room");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Cannot place buy bid on a planned room'
            ]);
            exit;
        }
        
        // Get current UTC datetime
        $currentUtcDateTime = gmdate('Y-m-d H:i:s');
        
        // Insert the new bid with status 'new'
        $insertStmt = $pdo->prepare("
            INSERT INTO bids 
            (type, roomID, amount, playerID, placed_datetime, status) 
            VALUES 
            (:type, :roomID, :amount, :playerID, :placed_datetime, 'new')
        ");
        
        $insertStmt->execute([
            'type' => $type,
            'roomID' => $roomID,
            'amount' => $amount,
            'playerID' => $playerID,
            'placed_datetime' => $currentUtcDateTime
        ]);
        
        $bidID = $pdo->lastInsertId();
        writeLog("Bid created with ID: $bidID");
        
        echo json_encode([
            'success' => true,
            'bid' => [
                'bidID' => $bidID,
                'type' => $type,
                'roomID' => $roomID,
                'amount' => $amount,
                'placed_datetime' => $currentUtcDateTime,
                'status' => 'new'
            ]
        ]);
    } catch (Exception $e) {
        writeLog("Database error when creating bid: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage()
        ]);
    }
} else {
    // Method not allowed
    writeLog("Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}
?>
