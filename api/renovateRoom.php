<?php
header('Content-Type: application/json');
require_once('../config.php');
require_once('../utils/logger.php');

$logFile = dirname(__FILE__) . '/../logs/game.log';
writeLog("Renovation request received.", $logFile);

$data = json_decode(file_get_contents('php://input'), true);
$roomID = $data['roomID'] ?? null;
$type = $data['type'] ?? null;

writeLog("Received input: roomID = {$roomID}, type = {$type}", $logFile);

if (!$roomID || !$type) {
    writeLog("Invalid input: roomID or type is missing.", $logFile);
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
    $roomPlayerData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$roomPlayerData) {
        writeLog("Room not found for roomID = {$roomID}.", $logFile);
        throw new Exception('Room not found.');
    }

    writeLog("Fetched room and player data: " . json_encode($roomPlayerData), $logFile);

    if ($roomPlayerData['status'] !== 'old_constructed') {
        writeLog("Room status is not eligible for renovation: status = {$roomPlayerData['status']}.", $logFile);
        throw new Exception('Room not eligible for renovation.');
    }

    $playerID = $roomPlayerData['playerID'];
    $currentMoney = $roomPlayerData['money'];
    $currentWear = $roomPlayerData['wear'];

    writeLog("Player ID: {$playerID}, Current Money: {$currentMoney}, Current Wear: {$currentWear}", $logFile);

    // Fetch renovation costs from config
    $renovationCosts = $clientConfig['renovationCosts'];

    if (!isset($renovationCosts[$type])) {
        writeLog("Invalid renovation type: {$type}.", $logFile);
        throw new Exception('Invalid renovation type.');
    }

    $cost = $renovationCosts[$type]['cost'];
    $wearReduction = $renovationCosts[$type]['wearReduction'];

    writeLog("Renovation type: {$type}, Cost: {$cost}, Wear Reduction: {$wearReduction}", $logFile);

    // Check if a "pending" renovation already exists for this room and player
    $existingPendingRenovationStmt = $pdo->prepare("SELECT COUNT(*) FROM renovation_queue WHERE roomID = :roomID AND playerID = :playerID AND status = 'pending'");
    $existingPendingRenovationStmt->execute(['roomID' => $roomID, 'playerID' => $playerID]);
    $pendingCount = $existingPendingRenovationStmt->fetchColumn();

    writeLog("Pending renovations for roomID = {$roomID}, playerID = {$playerID}: {$pendingCount}", $logFile);

    if ($pendingCount > 0) {
        throw new Exception('A pending renovation already exists for this room.');
    }

    // Check if the player has enough money
    if ($currentMoney < $cost) {
        writeLog("Insufficient funds: Current Money = {$currentMoney}, Required = {$cost}.", $logFile);
        throw new Exception('Insufficient funds.');
    }

    // Add renovation request to the queue
    $queueStmt = $pdo->prepare("INSERT INTO renovation_queue (roomID, playerID, type, status) VALUES (:roomID, :playerID, :type, 'pending')");
    $queueStmt->execute(['roomID' => $roomID, 'playerID' => $playerID, 'type' => $type]);

    writeLog("Renovation request added to queue: roomID = {$roomID}, playerID = {$playerID}, type = {$type}.", $logFile);

    // Apply wear reduction to the room
    $newWear = max(0, $currentWear - $wearReduction);
    $updateWearStmt = $pdo->prepare("UPDATE rooms SET wear = :newWear WHERE roomID = :roomID");
    $updateWearStmt->execute(['newWear' => $newWear, 'roomID' => $roomID]);

    writeLog("Room wear updated: roomID = {$roomID}, Old Wear = {$currentWear}, New Wear = {$newWear}.", $logFile);

    // Deduct the cost from the player's money
    $newMoney = $currentMoney - $cost;
    $updateMoneyStmt = $pdo->prepare("UPDATE players SET money = :newMoney WHERE playerID = :playerID");
    $updateMoneyStmt->execute(['newMoney' => $newMoney, 'playerID' => $playerID]);

    writeLog("Player money updated: playerID = {$playerID}, Old Money = {$currentMoney}, New Money = {$newMoney}.", $logFile);

    // Log the renovation request
    writeLog("Renovation request successfully processed: playerID = {$playerID}, roomID = {$roomID}, type = {$type}.", $logFile);

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    $pdo->rollBack();
    writeLog("Database error: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'A database error occurred.']);
} catch (Exception $e) {
    $pdo->rollBack();
    writeLog("Renovation failed: " . $e->getMessage(), $logFile);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
