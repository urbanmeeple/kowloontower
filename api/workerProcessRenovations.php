<?php
require_once('../config.php');
require_once('../utils/logger.php');

$logFile = dirname(__FILE__) . '/../logs/cron.log';
writeLog("Worker started for processing amazing renovations.", $logFile);

try {
    $pdo->beginTransaction();

    // Fetch pending renovations
    $stmt = $pdo->query("SELECT * FROM renovation_queue WHERE status = 'pending' LIMIT 1 FOR UPDATE");
    $renovation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$renovation) {
        writeLog("No pending renovations found.", $logFile);
        exit;
    }

    $queueID = $renovation['queueID'];
    $roomID = $renovation['roomID'];
    $playerID = $renovation['playerID'];

    // Mark as processing
    $pdo->prepare("UPDATE renovation_queue SET status = 'processing' WHERE queueID = :queueID")
        ->execute(['queueID' => $queueID]);

    // Call external API
    $apiUrl = 'https://example.com/generate-image';
    $response = file_get_contents($apiUrl);
    if (!$response) {
        throw new Exception('Failed to fetch image from API.');
    }

    // Save image
    $imagePath = dirname(__FILE__) . "/../room_images/{$playerID}/";
    if (!is_dir($imagePath)) {
        mkdir($imagePath, 0777, true);
    }
    $imageFile = $imagePath . "room_{$roomID}.png";
    file_put_contents($imageFile, $response);

    // Resize image
    $image = imagecreatefromstring($response);
    $resized = imagescale($image, 300, 300);
    imagepng($resized, $imageFile);
    imagedestroy($image);
    imagedestroy($resized);

    // Mark as completed
    $pdo->prepare("UPDATE renovation_queue SET status = 'completed' WHERE queueID = :queueID")
        ->execute(['queueID' => $queueID]);

    $pdo->commit();
    writeLog("Amazing renovation completed for room {$roomID}.", $logFile);
} catch (Exception $e) {
    $pdo->rollBack();
    writeLog("Worker failed: " . $e->getMessage(), $logFile);
}
?>
