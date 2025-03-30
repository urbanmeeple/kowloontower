<?php

// Default log file path
$defaultLogFile = dirname(__FILE__) . '/../logs/game.log';

// Logging function: Append timestamped messages to the log file and rotate if necessary.
function writeLog($message, $logFile = null) {
    global $defaultLogFile;
    $logFile = $logFile ?? $defaultLogFile; // Use provided log file or default

    $timestamp = date('Y-m-d H:i:s');
    
    // Rotate log file if it exceeds 5MB
    $maxLogSize = 5 * 1024 * 1024; // 5MB
    if (file_exists($logFile) && filesize($logFile) > $maxLogSize) {
        rename($logFile, $logFile . '.' . time());
    }
    
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}
?>
