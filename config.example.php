<?php
// config.php
$host = 'localhost';
$db   = 'database';  // Name your database (create this in your hosting control panel)
$user = 'your_db_user';
$pass = 'your_db_password';
$charset = 'utf8mb4';

// Secret key for API authorization
$secret_key = 'YOUR_SECRET_KEY'; // Replace with a strong, unique key

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
  PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES   => false,
];
$appCacheFile = dirname(__FILE__) . '/temp/your_cache_file.json'; // Backend-only configuration

// ---------- Client (public) configuration ----------
$clientConfig = [
    'gridWidth'   => 10,  // Exposed to both client and server
    'gridHeight'  => 30,  // Exposed to both client and server
    'cellSize'    => 30,
    'cronJobInterval' => 60, // In seconds, how often to run the cron job
    'autoUpdatePollingInterval' => 10000, // In milliseconds, how long between checking for new cache file
    'colors'      => [
        'background' => ['top' => '#FFEB3B', 'brightness' => 1.0],
        'grid'       => '#333333',
        'room'       => '#000000',
        'selected'   => '#00000066',
        'ground'     => '#8B4513'
    ],
    'view'        => [
        'zoom'         => 1,
        'minZoom'      => 0.2,
        'maxZoom'      => 3,
        'zoomStep'     => 0.1,
        'panX'         => 0,
        'panY'         => 0,
        'isPanning'    => false,
        'lastX'        => 0,
        'lastY'        => 0,
        'keyPanAmount' => 15,
        'keysPressed'  => new stdClass()
    ],
    'player'              => [
        'welcomeMessageDuration' => 5000,
        'storageKey'             => 'kowloonTowerPlayerID',
        'usernameKey'            => 'kowloonTowerUsername', // Key for storing username in localStorage
    ],
    'sectorIcons'         => [
        'housing' => '🏠',
        'entertainment' => '🎭',
        'weapons' => '🔫',
        'food' => '🍔',
        'technical' => '⚙️',
        'default' => '🏢'
    ]
];

// Function to return client-safe configuration
function getClientConfig() {
    global $clientConfig;
    return $clientConfig;
}

// ---------- PDO creation for backend usage ----------
try {
  $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
  throw new \PDOException($e->getMessage(), (int)$e->getCode());
}

// ...existing backend code...
?>