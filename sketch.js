let petalImgs = [];
let petals = [];
let dofShader;
let lastEmissionTime = 0;

// Parameters for customization
let params = {
  imageUrls: [
    'imgs/petal-01.png',
    'imgs/petal-02.png',
  ],
  maxParticleCount: 60,   // Limit the maximum number of particles
  emissionRate: 12,        // Particles per second
  fadeInTime: 0.6,        // In seconds
  fadeOutTime: 0.6,       // In seconds
  minSize: 10,
  maxSize: 80,
  baseWind: -1.5,
  noiseScale: 0.002,
  noiseStrength: 1.2,
  rotationSpeed: 0.01,
  gravity: 0.05,
  noiseFrequency: 0.001,
  maxBlur: 0.1, 
  enableBlur: true 
};

// Shader code for DOF blur effect with Alpha support
const vert = `
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  void main() {
    vTexCoord = aTexCoord;
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  }
`;

const frag = `
  precision mediump float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform float uBlurStrength;
  uniform float uOpacity;

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    for (float x = -1.0; x <= 1.0; x++) {
      for (float y = -1.0; y <= 1.0; y++) {
        vec2 offset = vec2(x, y) * uBlurStrength;
        color += texture2D(uTexture, vTexCoord + offset);
        total += 1.0;
      }
    }
    vec4 finalColor = color / total;
    gl_FragColor = vec4(finalColor.rgb, finalColor.a * uOpacity);
  }
`;

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('petal-canvas-container');

  dofShader = createShader(vert, frag);
  petalImgs = await Promise.all(params.imageUrls.map(url => loadImage(url)));
  
  // Start with no petals, they will be emitted over time
  petals = [];
  lastEmissionTime = millis();
}

function draw() {
  clear(); 
  
  ambientLight(180);
  directionalLight(255, 255, 255, 0, 0, -1);
  pointLight(255, 255, 255, width/2, -height/2, 200);

  // Emit new petals based on rate
  let currentTime = millis();
  let timeSinceLastEmission = currentTime - lastEmissionTime;
  let emissionInterval = 1000 / params.emissionRate;

  if (timeSinceLastEmission >= emissionInterval) {
    if (petals.length < params.maxParticleCount) {
      petals.push(new Petal());
      lastEmissionTime = currentTime;
    }
  }

  // Update and display petals
  for (let i = petals.length - 1; i >= 0; i--) {
    let petal = petals[i];
    petal.update();
    petal.display();

    // Remove if fully faded out and marked for death
    if (petal.isDead && petal.opacity <= 0) {
      petals.splice(i, 1);
    }
  }
}

class Petal {
  constructor() {
    this.init();
  }

  init() {
    // Spawn outside screen
    if (random() < 0.5) {
      this.pos = createVector(width/2 + random(100, 600), random(-height/2 - 200, height/2 + 200), random(-800, 200));
    } else {
      this.pos = createVector(random(-width/2 - 200, width/2 + 200), -height/2 - random(100, 600), random(-800, 200));
    }
    
    this.vel = createVector(params.baseWind + random(-1, 1), random(-1, 1), random(-0.5, 0.5));
    this.size = random(params.minSize, params.maxSize);
    
    if (petalImgs.length > 0) {
      this.img = random(petalImgs);
    }
    
    this.rot = createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI));
    this.rotVel = createVector(random(-1, 1), random(-1, 1), random(-1, 1)).mult(params.rotationSpeed);
    
    this.noiseOffset = random(10000);
    
    // Fade and Life state
    this.opacity = 0;
    this.isDead = false;
    this.birthTime = millis();
    this.deathTime = 0;
  }

  update() {
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
    this.vel.x += params.baseWind * 0.1;
    this.vel.mult(0.95);
    this.pos.add(this.vel);
    
    let speed = this.vel.mag();
    this.rot.add(p5.Vector.mult(this.rotVel, speed * 0.5 + 1));

    // Handle Alpha Transitions
    let now = millis();
    if (!this.isDead) {
      // Fade In
      let age = (now - this.birthTime) / 1000;
      this.opacity = constrain(age / params.fadeInTime, 0, 1);

      // Check for death (off screen)
      if (this.pos.x < -width/2 - 400 || this.pos.y > height/2 + 400 || this.pos.y < -height/2 - 800 || this.pos.z < -1500 || this.pos.z > 500) {
        this.isDead = true;
        this.deathTime = now;
      }
    } else {
      // Fade Out
      let deathAge = (now - this.deathTime) / 1000;
      this.opacity = constrain(1 - (deathAge / params.fadeOutTime), 0, 1);
    }
  }

  display() {
    let s = map(this.size, params.minSize, params.maxSize, 0, 1);
    let blurStrength = 0;
    
    if (s > 0.7 && s <= 0.9) {
      blurStrength = map(s, 0.7, 0.9, 0, params.maxBlur);
    } else if (s > 0.9) {
      blurStrength = params.maxBlur;
    }

    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateX(this.rot.x);
    rotateY(this.rot.y);
    rotateZ(this.rot.z);
    
    noStroke();
    
    if (this.img && this.img.width > 0) {
      // Always use shader to handle opacity smoothly
      shader(dofShader);
      dofShader.setUniform('uTexture', this.img);
      // Only apply blur if enabled and needed, otherwise 0
      dofShader.setUniform('uBlurStrength', (params.enableBlur ? blurStrength : 0));
      dofShader.setUniform('uOpacity', this.opacity);
      
      plane(this.size, this.size * (this.img.height / this.img.width));
      resetShader();
    } else {
      fill(255, 180, 200, 200 * this.opacity);
      ellipse(0, 0, this.size, this.size * 0.6);
    }
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
