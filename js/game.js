document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const context = canvas.getContext('2d');
  
    // Resize canvas to fit the window s
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  
    // Render loop (for now a simple animation)
    function draw() {
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Placeholder: Draw a rectangle (later replace with tower graphics)
      context.fillStyle = "#3498db";
      context.fillRect(50, 50, 100, 100);
  
      requestAnimationFrame(draw);
    }
    draw();
  }); 
  