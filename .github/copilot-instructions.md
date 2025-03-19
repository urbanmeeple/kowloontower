Project Type: Web-based game (mobile-friendly)
Technology Stack: PHP, HTML (Canvas), CSS, JavaScript with two.js, MySQL
Graphics: Procedurally generated (no graphic assets)
Game Logic: Updated via a cronjob every minute by calling updateState.php
Security: Secrets (passwords, API keys, etc.) are stored in config.php (ignored by Git)

Core Development Guidelines
Mobile-Friendly Design:
Ensure the game works on mobile browsers (touch events, responsive canvas).
Optimize performance for low-power devices.

Graphics:
All visuals must be procedurally generated using JavaScript with two.js and HTML Canvas.
No external images, sprites, or third-party graphics libraries.

Game Logic & Updates:
A cronjob triggers updateState.php every minute to process game state changes.
The game fetches updated state from the MySQL database.

Database & Backend:
Use PHP & MySQL for game state storage and updates.
Optimize database queries for minimal load on the server.

Security & Configurations:
Never hardcode secrets. Always retrieve them from config.php.
config.php is ignored in Git (.gitignore).

Code Structure & Best Practices:
Keep backend (PHP) and frontend (JavaScript) logic separate.
Use AJAX (or Fetch API) for real-time updates instead of page reloads.
Minimize external dependencies to keep the project lightweight.

Performance Considerations:
Optimize Canvas rendering (batch drawing, requestAnimationFrame).
Reduce server load by limiting database calls per request.

Preferred Copilot Behavior
-Prioritize performance and efficiency in generated code.
-Suggest procedural graphics algorithms when working with the canvas.
-Use secure coding practices (e.g., prepared SQL statements).
Avoid suggesting libraries that conflict with mobile performance (e.g., heavy frameworks).
-Respect the project’s file structure and security policies