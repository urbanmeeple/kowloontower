<?php
header('Content-Type: application/json');
require_once('../config.php');

// Check if the cache file exists and return its last modified timestamp
if (file_exists($appCacheFile)) {
    // Get the file modification time (Unix timestamp)
    $lastCacheUpdate = filemtime($appCacheFile);
    
    // Send both the timestamp and a readable time for debugging
    echo json_encode([
        'lastCacheUpdate' => $lastCacheUpdate,
        'readableTime' => date('Y-m-d H:i:s', $lastCacheUpdate)
    ]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Cache file not found']);
}
?>