<?php
// api/saveState.php
header('Content-Type: application/json');
require_once('../config.php');

// Get the POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['grid'])) {
    echo json_encode(['success' => false, 'error' => 'Missing grid data']);
    exit;
}

try {
    // Save the updated state to the database
    $state = json_encode($data);
    $stmt = $pdo->prepare("INSERT INTO tower_state (state) VALUES (:state)");
    $stmt->execute(['state' => $state]);
    
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
