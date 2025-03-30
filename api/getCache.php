<?php
require_once('../config.php'); // Include config.php to access appCacheFile
require_once('../utils/logger.php'); // Include centralized logger

header('Content-Type: application/json');

// Use the appCacheFile from config.php
if (file_exists($appCacheFile)) {
    // Read and output the cache; no modifications allowed.
    $cacheContent = file_get_contents($appCacheFile);
    echo $cacheContent;

    // Free memory by unsetting variables
    unset($cacheContent);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Cache file not found.']);
}
?>