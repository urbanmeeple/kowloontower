<?php
header('Content-Type: application/json');
require_once('../config.php');

// Function to sanitize input to prevent XSS attacks
function sanitizeInput($data) {
    return htmlspecialchars(strip_tags(trim($data)));
}

// Function to generate a unique username
function generateUniqueUsername() {
    // List of adjectives and nouns for username generation
    $adjectives = ['Happy', 'Quick', 'Clever', 'Bright', 'Smart', 'Swift', 'Brave', 'Kind', 'Wise', 'Bold'];
    $nouns = ['Tiger', 'Eagle', 'Lion', 'Panther', 'Dolphin', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Dragon'];
    
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
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM player WHERE playerID = :playerID");
        $stmt->execute(['playerID' => $playerID]);
        $player = $stmt->fetch();
        
        if ($player) {
            echo json_encode([
                'success' => true,
                'player' => $player
            ]);
        } else {
            // Player not found
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Player not found'
            ]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error'
        ]);
        
        // Log the actual error but don't expose details to client
        error_log("Player fetch error: " . $e->getMessage());
    }
}
// Handle POST request - Create a new player
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
        
        // Insert the new player
        $stmt = $pdo->prepare("
            INSERT INTO player 
            (username, money, stock_housing, stock_entertainment, stock_weapons, stock_food, stock_technical) 
            VALUES 
            (:username, :money, :stock_housing, :stock_entertainment, :stock_weapons, :stock_food, :stock_technical)
        ");
        
        $stmt->execute([
            'username' => $username,
            'money' => $startingMoney,
            'stock_housing' => $stock_housing,
            'stock_entertainment' => $stock_entertainment,
            'stock_weapons' => $stock_weapons,
            'stock_food' => $stock_food,
            'stock_technical' => $stock_technical
        ]);
        
        // Get the newly created player ID
        $newPlayerID = $pdo->lastInsertId();
        
        // Fetch the complete player record to return
        $stmt = $pdo->prepare("SELECT * FROM player WHERE playerID = :playerID");
        $stmt->execute(['playerID' => $newPlayerID]);
        $player = $stmt->fetch();
        
        echo json_encode([
            'success' => true,
            'player' => $player
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create player'
        ]);
        
        // Log the actual error but don't expose details to client
        error_log("Player creation error: " . $e->getMessage());
    }
} else {
    // Method not allowed
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}
?>
