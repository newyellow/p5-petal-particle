let petalImg;
let petals = [];

// Parameters for customization - modify these directly to change the effect
let params = {
  particleCount: 60,
  minSize: 10,
  maxSize: 60,
  baseWind: -1.5,     // Right to left (negative x)
  noiseScale: 0.002,  // Scale of the Perlin noise
  noiseStrength: 1.2, // Influence of noise on movement
  rotationSpeed: 0.01,
  gravity: 0.05,      // Slight downward pull
  noiseFrequency: 0.001
};

async function setup() {
  // Use WEBGL for 3D rotations
  createCanvas(windowWidth, windowHeight, WEBGL);

  // In p5.js 2.0, we use async/await for loading assets in setup
  petalImg = await loadImage('imgs/petal.png');
  
  initPetals();
}

function initPetals() {
  petals = [];
  for (let i = 0; i < params.particleCount; i++) {
    petals.push(new Petal());
  }
}

function draw() {
  // A nice subtle gradient-like background
  background(25, 20, 35);
  
  // Lights help with the 3D feel
  ambientLight(180);
  directionalLight(255, 255, 255, 0, 0, -1);
  pointLight(255, 255, 255, width/2, -height/2, 200);

  // Move and display petals
  for (let petal of petals) {
    petal.update();
    petal.display();
  }
}

class Petal {
  constructor() {
    this.randomize(true);
  }

  randomize(anywhere = false) {
    if (anywhere) {
      // Initially distribute across the whole view
      this.pos = createVector(
        random(-width, width),
        random(-height, height),
        random(-1000, 400)
      );
    } else {
      // Spawn from the right OR the top, strictly outside the canvas
      if (random() < 0.5) {
        // From the right
        this.pos = createVector(
          width / 2 + random(100, 600),
          random(-height / 2 - 200, height / 2 + 200),
          random(-800, 200)
        );
      } else {
        // From the top
        this.pos = createVector(
          random(-width / 2 - 200, width / 2 + 200),
          -height / 2 - random(100, 600),
          random(-800, 200)
        );
      }
    }
    
    this.vel = createVector(
      params.baseWind + random(-1, 1),
      random(-1, 1),
      random(-0.5, 0.5)
    );
    
    this.size = random(params.minSize, params.maxSize);
    
    // 3D Rotation
    this.rot = createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI));
    this.rotVel = createVector(
      random(-1, 1),
      random(-1, 1),
      random(-1, 1)
    ).mult(params.rotationSpeed);
    
    this.noiseOffset = random(10000);
  }

  update() {
    // Noise-based wind
    let t = frameCount * params.noiseFrequency;
    let nX = noise(this.pos.x * params.noiseScale, this.pos.y * params.noiseScale, t + this.noiseOffset);
    let nY = noise(this.pos.x * params.noiseScale + 55, this.pos.y * params.noiseScale + 55, t + this.noiseOffset);
    let nZ = noise(this.pos.x * params.noiseScale + 110, this.pos.y * params.noiseScale + 110, t + this.noiseOffset);
    
    let noiseForce = createVector(
      map(nX, 0, 1, -1, 1),
      map(nY, 0, 1, -1, 1) + params.gravity * 10,
      map(nZ, 0, 1, -1, 1)
    ).mult(params.noiseStrength);
    
    this.vel.add(noiseForce);
    this.vel.x += params.baseWind * 0.1; // constant push
    
    // Friction
    this.vel.mult(0.95);
    
    this.pos.add(this.vel);
    
    // Rotation updates
    let speed = this.vel.mag();
    this.rot.add(p5.Vector.mult(this.rotVel, speed * 0.5 + 1));
    
    // Respawn if off screen
    if (this.pos.x < -width / 2 - 400 || 
        this.pos.y > height / 2 + 400 || 
        this.pos.y < -height / 2 - 800 ||
        this.pos.z < -1500 || 
        this.pos.z > 500) {
      this.randomize(false);
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    rotateX(this.rot.x);
    rotateY(this.rot.y);
    rotateZ(this.rot.z);
    
    noStroke();
    
    if (petalImg && petalImg.width > 0) {
      texture(petalImg);
      plane(this.size, this.size * (petalImg.height / petalImg.width));
    } else {
      fill(255, 180, 200, 200);
      ellipse(0, 0, this.size, this.size * 0.6);
    }
    
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
