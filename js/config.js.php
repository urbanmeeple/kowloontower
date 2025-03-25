<?php
header('Content-Type: application/javascript');
require_once('../config.php');
?>
export const config = <?php echo json_encode(getClientConfig(), JSON_PRETTY_PRINT); ?>;
