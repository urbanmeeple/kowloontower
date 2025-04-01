<?php
header('Content-Type: application/json');
require_once('../config.php');
require_once('../utils/logger.php');

$logFile = dirname(__FILE__) . '/../logs/game.log';
writeLog("Renovation request received.", $logFile);

$data = json_decode(file_get_contents('php://input'), true);
$roomID = $data['roomID'] ?? null;
$type = $data['type'] ?? null;

if (!$roomID || !$type) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Fetch room and player data
    $stmt = $pdo->prepare("SELECT r.wear, r.status, pr.playerID, p.money FROM rooms r
                           JOIN players_rooms pr ON r.roomID = pr.roomID
                           JOIN players p ON pr.playerID = p.playerID
                           WHERE r.roomID = :roomID");
    $stmt->execute(['roomID' => $roomID]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$room || $room['status'] !== 'old_constructed') {
        throw new Exception('Room not eligible for renovation.');
    }

    $playerID = $room['playerID'];
    $currentMoney = $room['money'];

    // Define renovation costs
    $renovationCosts = ['small' => 100, 'big' => 500, 'amazing' => 1000];

    if (!isset($renovationCosts[$type])) {
        throw new Exception('Invalid renovation type.');
    }

    $cost = $renovationCosts[$type];

    // Check if a "pending" renovation already exists for this room and player
    $existingPendingRenovationStmt = $pdo->prepare("SELECT COUNT(*) FROM renovation_queue WHERE roomID = :roomID AND playerID = :playerID AND status = 'pending'");
    $existingPendingRenovationStmt->execute(['roomID' => $roomID, 'playerID' => $playerID]);
    if ($existingPendingRenovationStmt->fetchColumn() > 0) {
        throw new Exception('A pending renovation already exists for this room.');
    }

    // Check if the player has enough money
    if ($currentMoney < $cost) {
        throw new Exception('Insufficient funds.');
    }

    // Add renovation request to the queue
    $queueStmt = $pdo->prepare("INSERT INTO renovation_queue (roomID, playerID, type, status) VALUES (:roomID, :playerID, :type, 'pending')");
    $queueStmt->execute(['roomID' => $roomID, 'playerID' => $playerID, 'type' => $type]);

    // Log the renovation request
    writeLog("Renovation request queued: player {$playerID}, room {$roomID}, type {$type}.", $logFile);

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    $pdo->rollBack();
    if ($e->getCode() === '23000') { // Handle duplicate entry error
        writeLog("Duplicate renovation request detected: " . $e->getMessage(), $logFile);
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Duplicate renovation request.']);
    } else {
        writeLog("Database error: " . $e->getMessage(), $logFile);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
    }
} catch (Exception $e) {
    $pdo->rollBack();
    writeLog("Renovation failed: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
