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

try {
  $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
  throw new \PDOException($e->getMessage(), (int)$e->getCode());
}
?>
