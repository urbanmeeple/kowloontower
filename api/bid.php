<?php
header('Content-Type: application/json');
require_once('../config.php');
require_once('../utils/logger.php'); // Include centralized logger

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
        unset($stmt);

        writeLog("Found " . count($bids) . " active bids for player $playerID");
        
        echo json_encode([
            'success' => true,
            'bids' => $bids
        ]);
        unset($bids);
    } catch (Exception $e) {
        writeLog("Database error when fetching bids: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error'
        ]);
    }
}
// Handle POST request - Create or update a bid
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
    
    writeLog("Processing {$type} bid for room {$roomID} by player {$playerID} for {$amount}");
    
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
        
        // Check if the player already has a bid for this room
        $existingBidStmt = $pdo->prepare("SELECT * FROM bids WHERE playerID = :playerID AND roomID = :roomID");
        $existingBidStmt->execute(['playerID' => $playerID, 'roomID' => $roomID]);
        $existingBid = $existingBidStmt->fetch();
        
        if ($existingBid) {
            // Update the existing bid
            $updateStmt = $pdo->prepare("UPDATE bids SET amount = :amount, placed_datetime = :placed_datetime WHERE bidID = :bidID");
            $updateStmt->execute([
                'amount' => $amount,
                'placed_datetime' => gmdate('Y-m-d H:i:s'),
                'bidID' => $existingBid['bidID']
            ]);
            writeLog("Updated bid ID {$existingBid['bidID']} for room {$roomID} by player {$playerID}");
            echo json_encode([
                'success' => true,
                'bid' => [
                    'bidID' => $existingBid['bidID'],
                    'type' => $type,
                    'roomID' => $roomID,
                    'amount' => $amount,
                    'placed_datetime' => gmdate('Y-m-d H:i:s'),
                    'status' => 'new'
                ]
            ]);
        } else {
            // Insert a new bid
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
                'placed_datetime' => gmdate('Y-m-d H:i:s')
            ]);
            $bidID = $pdo->lastInsertId();
            writeLog("Created new bid ID {$bidID} for room {$roomID} by player {$playerID}");
            echo json_encode([
                'success' => true,
                'bid' => [
                    'bidID' => $bidID,
                    'type' => $type,
                    'roomID' => $roomID,
                    'amount' => $amount,
                    'placed_datetime' => gmdate('Y-m-d H:i:s'),
                    'status' => 'new'
                ]
            ]);
        }
    } catch (Exception $e) {
        writeLog("Database error when processing bid: " . $e->getMessage());
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
