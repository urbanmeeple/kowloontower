CREATE TABLE renovation_queue (
    queueID INT AUTO_INCREMENT PRIMARY KEY,
    roomID INT NOT NULL,
    playerID VARCHAR(32) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed'
    created_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL, -- 'small', 'big', or 'amazing'
    FOREIGN KEY (roomID) REFERENCES rooms(roomID) ON DELETE CASCADE,
    FOREIGN KEY (playerID) REFERENCES players(playerID) ON DELETE CASCADE
);
