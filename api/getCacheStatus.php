<?php
header('Content-Type: application/json');
require_once('../config.php');

// Check if the cache file exists and return its last modified timestamp
if (file_exists($appCacheFile)) {
    $lastCacheUpdate = filemtime($appCacheFile);
    echo json_encode(['lastCacheUpdate' => $lastCacheUpdate]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Cache file not found']);
}
?>