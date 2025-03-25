<?php
require_once('../config.php'); // Include config.php to access appCacheFile

header('Content-Type: application/json');

// Use the appCacheFile from config.php
if (file_exists($appCacheFile)) {
    // Read and output the cache; no modifications allowed.
    echo file_get_contents($appCacheFile);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Cache file not found.']);
}
?>