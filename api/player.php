<?php
header('Content-Type: application/json');
require_once('../config.php');

// Define log file path
$logFile = dirname(__FILE__) . '/../logs/game.log';

// Logging function
function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// Function to sanitize input to prevent XSS attacks
function sanitizeInput($data) {
    return htmlspecialchars(strip_tags(trim($data)));
}

// Function to generate a unique username
function generateUniqueUsername() {
    // List of adjectives and nouns for username generation
    $adjectives = [
        'Ambitious', 'Bold', 'Clever', 'Daring', 'Eager', 'Fearless', 'Generous', 'Humble', 'Innovative', 'Jovial',
        'Keen', 'Loyal', 'Meticulous', 'Noble', 'Optimistic', 'Patient', 'Quick', 'Resilient', 'Strategic', 'Tenacious',
        'Unique', 'Vigilant', 'Wise', 'Youthful', 'Zealous'
    ];
    $nouns = [
        'Architect', 'Builder', 'Investor', 'Merchant', 'Tycoon', 'Visionary', 'Planner', 'Trader', 'Banker', 'Engineer',
        'Foreman', 'Developer', 'Designer', 'Contractor', 'Entrepreneur', 'Strategist', 'Negotiator', 'Broker', 'Financier',
        'Surveyor', 'Constructor', 'Innovator', 'Manager', 'Overseer', 'Supervisor'
    ];
    
    // Random adjective and noun
    $adjective = $adjectives[array_rand($adjectives)];
    $noun = $nouns[array_rand($nouns)];
    
    // Add random number for more uniqueness
    $randomNum = rand(100, 999);
    
    return $adjective . $noun . $randomNum;
}

// Handle GET request - Fetch player by ID
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id'])) {
    $playerID = sanitizeInput($_GET['id']);
    writeLog("Fetching player with ID: $playerID");
    
    try {
        // Update the active_datetime for the player to current UTC time
        $currentUtcDateTime = gmdate('Y-m-d H:i:s');
        $updateStmt = $pdo->prepare("UPDATE players SET active_datetime = :active_datetime WHERE playerID = :playerID");
        $updateStmt->execute([
            'active_datetime' => $currentUtcDateTime,
            'playerID' => $playerID
        ]);
        
        // Now fetch the player data
        $stmt = $pdo->prepare("SELECT * FROM players WHERE playerID = :playerID");
        $stmt->execute(['playerID' => $playerID]);
        $player = $stmt->fetch();
        
        if ($player) {
            writeLog("Player found: {$player['username']}");
            echo json_encode([
                'success' => true,
                'player' => $player
            ]);
        } else {
            // Player not found
            writeLog("Player not found with ID: $playerID");
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Player not found'
            ]);
        }
    } catch (Exception $e) {
        writeLog("Database error when fetching player: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error'
        ]);
    }
}
// Handle POST request - Create a new player
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    writeLog("Creating new player");
    
    try {
        // Generate a unique username
        $username = generateUniqueUsername();
        
        // Starting money
        $startingMoney = 1000000;
        
        // Distribute 100 stocks randomly among the five sectors
        $totalStocks = 100;
        $remainingStocks = $totalStocks;
        
        // Randomly distribute stocks across sectors
        $stock_housing = rand(0, (int)($remainingStocks * 0.4));
        $remainingStocks -= $stock_housing;
        
        $stock_entertainment = rand(0, (int)($remainingStocks * 0.5));
        $remainingStocks -= $stock_entertainment;
        
        $stock_weapons = rand(0, (int)($remainingStocks * 0.6));
        $remainingStocks -= $stock_weapons;
        
        $stock_food = rand(0, (int)($remainingStocks * 0.7));
        $remainingStocks -= $stock_food;
        
        // Assign remaining stocks to technical sector
        $stock_technical = $remainingStocks;
        
        // Get current UTC datetime for created and active timestamps
        $currentUtcDateTime = gmdate('Y-m-d H:i:s');
        
        // Insert the new player
        $stmt = $pdo->prepare("
            INSERT INTO players 
            (username, money, stock_housing, stock_entertainment, stock_weapons, stock_food, stock_technical, created_datetime, active_datetime) 
            VALUES 
            (:username, :money, :stock_housing, :stock_entertainment, :stock_weapons, :stock_food, :stock_technical, :created_datetime, :active_datetime)
        ");
        
        $stmt->execute([
            'username' => $username,
            'money' => $startingMoney,
            'stock_housing' => $stock_housing,
            'stock_entertainment' => $stock_entertainment,
            'stock_weapons' => $stock_weapons,
            'stock_food' => $stock_food,
            'stock_technical' => $stock_technical,
            'created_datetime' => $currentUtcDateTime,
            'active_datetime' => $currentUtcDateTime
        ]);
        
        // Get the newly created player ID
        $newPlayerID = $pdo->lastInsertId();
        
        // Fetch the complete player record to return
        $stmt = $pdo->prepare("SELECT * FROM players WHERE playerID = :playerID");
        $stmt->execute(['playerID' => $newPlayerID]);
        $player = $stmt->fetch();
        
        writeLog("New player created: {$player['username']} (ID: {$player['playerID']})");
        
        echo json_encode([
            'success' => true,
            'player' => $player
        ]);
    } catch (Exception $e) {
        writeLog("Error creating new player: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create player'
        ]);
    }
} else {
    // Method not allowed
    writeLog("Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}
?>
