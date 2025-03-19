<?php
// api/updateState.php
header('Content-Type: application/json');
require_once('../config.php'); // Now $secret_key is available

// Verify that the request includes the correct key from the URL query string
if (!isset($_GET['key']) || $_GET['key'] !== $secret_key) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized access.']);
    exit;
}

/**
 * Generates a new block to add to the current tower state.
 *
 * @param array $currentState Current state array with a 'blocks' key.
 * @return array Updated state array with the new block added.
 */
function generateNewBlock($currentState) {
    $blocks = $currentState['blocks'];
    $blockCount = count($blocks);

    $newBlock = [
        'id'    => $blockCount + 1,
        'x'     => 50, // Example fixed x-coordinate
        'y'     => 500 - ($blockCount * 30), // Simple stacking logic for y-coordinate
        'color' => sprintf('#%06X', mt_rand(0, 0xFFFFFF)) // Random color
    ];

    $blocks[] = $newBlock;
    return ['blocks' => $blocks];
}

try {
    // Retrieve the current tower state from the database
    $stmt = $pdo->query("SELECT state FROM tower_state ORDER BY updated_at DESC LIMIT 1");
    $row = $stmt->fetch();
    $currentState = $row ? json_decode($row['state'], true) : ['blocks' => []];

    // Generate the new state with an additional block
    $newState = generateNewBlock($currentState);
    $newStateJson = json_encode($newState);

    // Insert the updated state into the database
    $stmt = $pdo->prepare("INSERT INTO tower_state (state) VALUES (:state)");
    $stmt->execute(['state' => $newStateJson]);

    echo json_encode(['success' => true, 'state' => $newState]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
