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
    $currentWear = $room['wear'];

    // Define renovation costs and wear reduction
    $renovationCosts = ['small' => 100, 'big' => 500, 'amazing' => 1000];
    $wearReduction = ['small' => 0.2, 'big' => 0.5, 'amazing' => 1.0];

    if (!isset($renovationCosts[$type])) {
        throw new Exception('Invalid renovation type.');
    }

    $cost = $renovationCosts[$type];
    $reduction = $wearReduction[$type];

    if ($currentMoney < $cost) {
        throw new Exception('Insufficient funds.');
    }

    // Deduct money and update wear
    $newWear = max(0, $currentWear - $reduction);
    $pdo->prepare("UPDATE players SET money = money - :cost WHERE playerID = :playerID")
        ->execute(['cost' => $cost, 'playerID' => $playerID]);
    $pdo->prepare("UPDATE rooms SET wear = :wear WHERE roomID = :roomID")
        ->execute(['wear' => $newWear, 'roomID' => $roomID]);

    // Handle amazing renovation
    if ($type === 'amazing') {
        $queueStmt = $pdo->prepare("INSERT INTO renovation_queue (roomID, playerID, status) VALUES (:roomID, :playerID, 'pending')");
        $queueStmt->execute(['roomID' => $roomID, 'playerID' => $playerID]);
        writeLog("Amazing renovation queued for room {$roomID}.", $logFile);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    $pdo->rollBack();
    writeLog("Renovation failed: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
