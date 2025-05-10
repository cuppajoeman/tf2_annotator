
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const penSize = document.getElementById('penSize');
const buttons = document.querySelectorAll('#toolbar > div > button, #toolbar > button');

// Set canvas dimensions to window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

// Initialize
let mode = 'pen';
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isDrawing = false;
let startX = 0, startY = 0;

let mapImage = null;
let objects = []; // stamp objects and user-loaded images
let paths = [];   // pen paths

let selectedObject = null;
let draggingCanvas = false;
let scalingObject = false;

let penColor = '#ffffff';
let eraserSize = 15;

let currentStampPath = '';
let stampImg = null;

// Load class images for team placement
const classImages = {
  blu: {},
  red: {}
};

const classTypes = ['scout', 'soldier', 'pyro', 'demo', 'heavy', 'engi', 'med', 'sniper', 'spy'];
classTypes.forEach(className => {
  // Preload BLU team images
  const bluImg = new Image();
  bluImg.src = `${className}_blu.png`;
  bluImg.onload = () => {
    bluImg.defaultWidth = bluImg.width / 2;
    bluImg.defaultHeight = bluImg.height / 2;
    classImages.blu[className] = bluImg;
  };
  
  // Preload RED team images
  const redImg = new Image();
  redImg.src = `${className}_red.png`;
  redImg.onload = () => {
    redImg.defaultWidth = redImg.width / 2;
    redImg.defaultHeight = redImg.height / 2;
    classImages.red[className] = redImg;
  };
});

// Place a team formation at the cursor position
function placeTeam(team) {
  // Get cursor position (center of formation)
  const cursorX = (lastMouseX - offsetX) / scale;
  const cursorY = (lastMouseY - offsetY) / scale;
  
  // Standard 6v6 team: medic, demo, 2 scouts, 2 soldiers
  const formation = ['med', 'demo', 'scout', 'scout', 'soldier', 'soldier'];
  
  // Calculate spacing and start positions
  const spacing = 40; // pixels between classes
  const startX = cursorX - (spacing * (formation.length - 1)) / 2;
  
  // Place each class in the formation
  formation.forEach((className, index) => {
    const img = classImages[team][className];
    if (img) {
      const width = img.defaultWidth || img.width / 2;
      const height = img.defaultHeight || img.height / 2;
      
      // Position each class in a horizontal line
      const posX = startX + (index * spacing);
      
      objects.push({
        type: 'stamp',
        img: img,
        path: `${className}_${team}.png`,
        x: posX - width/2,
        y: cursorY - height/2,
        width: width,
        height: height,
        originalWidth: img.width,
        originalHeight: img.height
      });
    }
  });
  
  draw();
}

// Track mouse position for team placement
let lastMouseX = 0;
let lastMouseY = 0;
canvas.addEventListener('mousemove', e => {
  lastMouseX = e.offsetX;
  lastMouseY = e.offsetY;
});

// Enable stamp selection UI
function showStamps(team) {
  document.querySelectorAll('.stamp-selection').forEach(el => {
    el.classList.remove('active');
  });
  
  document.getElementById(`${team}Stamps`).classList.add('active');
}

// Set the current stamp image
function setStamp(path) {
  currentStampPath = path;
  stampImg = new Image();
  stampImg.src = currentStampPath;
  stampImg.onload = () => {
    // Use half the original size as default
    stampImg.defaultWidth = stampImg.width / 2;
    stampImg.defaultHeight = stampImg.height / 2;
  };
  setMode('stamp');
}

// Load a map image
function loadMap(path) {
  const img = new Image();
  img.onload = () => {
    mapImage = {
      img,
      x: (canvas.width - img.width) / 2 / scale,
      y: (canvas.height - img.height) / 2 / scale,
      width: img.width,
      height: img.height
    };
    
    // Center the view on the map
    offsetX = (canvas.width - mapImage.width * scale) / 2;
    offsetY = (canvas.height - mapImage.height * scale) / 2;
    
    draw();
  };
  img.src = path;
}

// Update UI based on selected mode
function updateUI() {
  buttons.forEach(btn => {
    btn.classList.remove('active');
    const modeId = `${mode}Btn`;
    if (btn.id === modeId) {
      btn.classList.add('active');
    }
  });
}

function setMode(newMode) {
  mode = newMode;
  updateUI();
}

function clearPaths() {
  if (confirm('Are you sure you want to clear all drawing paths?')) {
    paths = [];
    draw();
  }
}

function clearAll() {
  if (confirm('Are you sure you want to clear everything?')) {
    paths = [];
    objects = [];
    mapImage = null;
    draw();
  }
}

document.getElementById('imgLoader').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = () => {
      objects.push({
        type: 'image',
        img,
        x: (canvas.width / scale - img.width) / 2 - offsetX / scale,
        y: (canvas.height / scale - img.height) / 2 - offsetY / scale,
        width: img.width,
        height: img.height,
        originalWidth: img.width,
        originalHeight: img.height
      });
      draw();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

colorPicker.addEventListener('change', e => {
  penColor = e.target.value;
});

canvas.addEventListener('mousedown', e => {
  const canvasX = (e.offsetX - offsetX) / scale;
  const canvasY = (e.offsetY - offsetY) / scale;

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    draggingCanvas = true;
    startX = e.clientX;
    startY = e.clientY;
    return;
  }
  
  // If we click outside of any object while in move mode, deselect
  if (mode === 'move' && selectedObject) {
    let clickedOnSelected = false;
    if (selectedObject === mapImage) {
      clickedOnSelected = canvasX >= mapImage.x && canvasX <= mapImage.x + mapImage.width &&
                         canvasY >= mapImage.y && canvasY <= mapImage.y + mapImage.height;
    } else {
      clickedOnSelected = canvasX >= selectedObject.x && canvasX <= selectedObject.x + selectedObject.width &&
                         canvasY >= selectedObject.y && canvasY <= selectedObject.y + selectedObject.height;
    }
    
    if (!clickedOnSelected) {
      selectedObject = null;
      draw();
    }
  }

  if (mode === 'pen') {
    isDrawing = true;
    paths.push({
      color: penColor,
      width: parseInt(penSize.value),
      points: [{ x: canvasX, y: canvasY }]
    });
    draw();
  } else if (mode === 'eraser') {
    isDrawing = true;
    startX = canvasX;
    startY = canvasY;
    // No need to create a new path, we'll check for stroke erasure in mousemove
  } else if (mode === 'stamp' && stampImg) {
    // Create stamp at half the original size
    const width = stampImg.defaultWidth || stampImg.width / 2;
    const height = stampImg.defaultHeight || stampImg.height / 2;
    objects.push({
      type: 'stamp',
      img: stampImg,
      path: currentStampPath,
      x: canvasX - width/2,
      y: canvasY - height/2,
      width: width,
      height: height,
      originalWidth: stampImg.width,
      originalHeight: stampImg.height
    });
    draw();
  } else if (mode === 'move') {
    // Check if we clicked on an object (checking in reverse to select top objects first)
    selectedObject = null;
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (
        canvasX >= obj.x && canvasX <= obj.x + obj.width &&
        canvasY >= obj.y && canvasY <= obj.y + obj.height
      ) {
        selectedObject = obj;
        // Move selected object to end of array (top of stack)
        objects.splice(i, 1);
        objects.push(selectedObject);
        startX = canvasX;
        startY = canvasY;
        draw();
        break;
      }
    }
    
    // If no object was selected and we clicked on the map, select the map
    if (!selectedObject && mapImage && 
        canvasX >= mapImage.x && canvasX <= mapImage.x + mapImage.width &&
        canvasY >= mapImage.y && canvasY <= mapImage.y + mapImage.height) {
      selectedObject = mapImage;
      startX = canvasX;
      startY = canvasY;
    }
  }
});

canvas.addEventListener('mousemove', e => {
  // Update last known mouse position
  lastMouseX = e.offsetX;
  lastMouseY = e.offsetY;
  
  const canvasX = (e.offsetX - offsetX) / scale;
  const canvasY = (e.offsetY - offsetY) / scale;

  if (draggingCanvas) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    offsetX += dx;
    offsetY += dy;
    startX = e.clientX;
    startY = e.clientY;
    draw();
    return;
  }

  if (isDrawing && mode === 'pen') {
    const path = paths[paths.length - 1];
    path.points.push({ x: canvasX, y: canvasY });
    draw();
  } else if (isDrawing && mode === 'eraser') {
    // For eraser, check if we're intersecting with any path
    eraseAt(canvasX, canvasY);
    startX = canvasX;
    startY = canvasY;
  } else if (mode === 'move' && selectedObject && !scalingObject) {
    const dx = canvasX - startX;
    const dy = canvasY - startY;
    selectedObject.x += dx;
    selectedObject.y += dy;
    startX = canvasX;
    startY = canvasY;
    draw();
  }
});

// Function to erase entire paths at a specific point
function eraseAt(x, y) {
  const eraserRadius = eraserSize / 2;
  
  // Loop through each path and check if the eraser intersects with it
  for (let p = paths.length - 1; p >= 0; p--) {
    const path = paths[p];
    let shouldErase = false;
    
    // Check each segment of the path
    for (let i = 0; i < path.points.length - 1; i++) {
      const pt1 = path.points[i];
      const pt2 = path.points[i + 1];
      
      // Simple distance check from point to line segment
      const dist = pointToLineDistance(x, y, pt1.x, pt1.y, pt2.x, pt2.y);
      
      if (dist < eraserRadius + path.width/2) {
        // If eraser touches any part of the path, mark it for removal
        shouldErase = true;
        break;
      }
    }
    
    // If we should erase this path, remove it
    if (shouldErase) {
      paths.splice(p, 1);
    }
  }
  
  draw();
}

// Calculate distance from point to line segment
function pointToLineDistance(x, y, x1, y1, x2, y2) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  
  if (len_sq != 0) param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener('mouseup', e => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    draggingCanvas = false;
  } else {
    isDrawing = false;
    scalingObject = false;
    
    // If we're in move mode and we're releasing the mouse button,
    // check if we actually moved the object or just clicked
    if (mode === 'move' && selectedObject) {
      // If we didn't move much, consider it a click to deselect
      if (Math.abs(e.offsetX/scale - startX) < 5 && Math.abs(e.offsetY/scale - startY) < 5) {
        selectedObject = null;
        draw();
      }
    }
  }
});

// Add event listener for Escape key to deselect objects
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && selectedObject) {
    selectedObject = null;
    draw();
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  
  // Get mouse position for zoom origin
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  
  if (mode === 'move' && selectedObject) {
    // Scale the selected object with mouse wheel
    scalingObject = true;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    // Calculate new dimensions while preserving aspect ratio
    const newWidth = selectedObject.width * zoomFactor;
    const newHeight = selectedObject.height * zoomFactor;
    
    // Scale from center
    const centerX = selectedObject.x + selectedObject.width / 2;
    const centerY = selectedObject.y + selectedObject.height / 2;
    
    selectedObject.width = newWidth;
    selectedObject.height = newHeight;
    selectedObject.x = centerX - newWidth / 2;
    selectedObject.y = centerY - newHeight / 2;
    
    draw();
  } else {
    // Improved zoom with cursor as focal point
    const zoomPoint = {
      x: (mouseX - offsetX) / scale,
      y: (mouseY - offsetY) / scale
    };
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = scale;
    scale *= zoomFactor;
    
    // Adjust offset to keep the point under the cursor fixed
    offsetX = mouseX - zoomPoint.x * scale;
    offsetY = mouseY - zoomPoint.y * scale;

    draw();
  }
}, { passive: false });

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  // Draw grid (subtle lines)
  drawGrid();
  
  // Draw the map if one is loaded
  if (mapImage) {
    ctx.drawImage(mapImage.img, mapImage.x, mapImage.y, mapImage.width, mapImage.height);
  }
  
  // Draw objects (stamps and user-loaded images)
  objects.forEach(obj => {
    ctx.drawImage(obj.img, obj.x, obj.y, obj.width, obj.height);
  });

  // Draw all pen paths
  for (const path of paths) {
    if (path.points.length < 2) continue;
    
    ctx.beginPath();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
  }
  
  // Show selection outline for selected object
  if (selectedObject && mode === 'move') {
    ctx.strokeStyle = '#4285f4';
    ctx.lineWidth = 2 / scale; // Keep outline same visual width regardless of zoom
    ctx.setLineDash([5 / scale, 5 / scale]);
    ctx.strokeRect(
      selectedObject.x - 2 / scale, 
      selectedObject.y - 2 / scale, 
      selectedObject.width + 4 / scale, 
      selectedObject.height + 4 / scale
    );
    ctx.setLineDash([]);
  }
  
  // Draw eraser preview if in eraser mode
  if (mode === 'eraser') {
    const mouseX = startX;
    const mouseY = startY;
    
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, eraserSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  }
}

function drawGrid() {
  const gridSize = 50;
  const minX = -offsetX / scale;
  const minY = -offsetY / scale;
  const maxX = (canvas.width - offsetX) / scale;
  const maxY = (canvas.height - offsetY) / scale;
  
  // Round to nearest gridSize
  const startX = Math.floor(minX / gridSize) * gridSize;
  const startY = Math.floor(minY / gridSize) * gridSize;
  const endX = Math.ceil(maxX / gridSize) * gridSize;
  const endY = Math.ceil(maxY / gridSize) * gridSize;
  
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.2)';
  ctx.lineWidth = 1 / scale;
  
  // Draw vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

// Handle resizing
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
updateUI();

// Initialize with pen as default tool
setMode('pen');
