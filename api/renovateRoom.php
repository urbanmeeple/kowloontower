<?php
header('Content-Type: application/json');
require_once('../config.php');
require_once('../utils/logger.php');

$logFile = dirname(__FILE__) . '/../logs/game.log';
writeLog("Renovation request received.", $logFile);

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['playerID'])) {
    $playerID = htmlspecialchars(strip_tags(trim($_GET['playerID'])));
    writeLog("Fetching renovations for playerID: {$playerID}", $logFile);

    try {
        // Fetch active renovations for the player
        $stmt = $pdo->prepare("SELECT * FROM renovation_queue WHERE playerID = :playerID AND status = 'pending'");
        $stmt->execute(['playerID' => $playerID]);
        $renovations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        writeLog("Found " . count($renovations) . " renovations for playerID: {$playerID}", $logFile);

        echo json_encode(['success' => true, 'renovations' => $renovations]);
    } catch (Exception $e) {
        writeLog("Error fetching renovations: " . $e->getMessage(), $logFile);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch renovations.']);
    }
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$roomID = $data['roomID'] ?? null;
$type = $data['type'] ?? null;
$playerID = $data['playerID'] ?? null; // Use playerID from the request payload

writeLog("Received input: roomID = {$roomID}, type = {$type}, playerID = {$playerID}", $logFile);

if (!$roomID || !$type || !$playerID) {
    writeLog("Invalid input: roomID, type, or playerID is missing.", $logFile);
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Fetch player data
    $playerStmt = $pdo->prepare("SELECT money FROM players WHERE playerID = :playerID");
    $playerStmt->execute(['playerID' => $playerID]);
    $playerData = $playerStmt->fetch(PDO::FETCH_ASSOC);

    if (!$playerData) {
        writeLog("Player not found for playerID = {$playerID}.", $logFile);
        throw new Exception('Player not found.');
    }

    $currentMoney = $playerData['money'];

    // Fetch room data
    $roomStmt = $pdo->prepare("SELECT wear, status FROM rooms WHERE roomID = :roomID");
    $roomStmt->execute(['roomID' => $roomID]);
    $roomData = $roomStmt->fetch(PDO::FETCH_ASSOC);

    if (!$roomData) {
        writeLog("Room not found for roomID = {$roomID}.", $logFile);
        throw new Exception('Room not found.');
    }

    writeLog("Fetched room data: " . json_encode($roomData), $logFile);

    if ($roomData['status'] !== 'new_constructed' && $roomData['status'] !== 'old_constructed') {
        writeLog("Room status is not eligible for renovation: status = {$roomData['status']}.", $logFile);
        throw new Exception('Room not eligible for renovation.');
    }

    $currentWear = $roomData['wear'];

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
