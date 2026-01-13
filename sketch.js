let petalImgs = [];
let petals = [];
let dofShader;

// Parameters for customization
let params = {
  // Add your image URLs here
  imageUrls: [
    'imgs/petal-01.png',
    'imgs/petal-02.png',
  ],
  particleCount: 60,
  minSize: 10,
  maxSize: 80,
  baseWind: -1.5,
  noiseScale: 0.002,
  noiseStrength: 1.2,
  rotationSpeed: 0.01,
  gravity: 0.05,
  noiseFrequency: 0.001,
  maxBlur: 0.1, // Max blur strength (normalized to texture size)
  enableBlur: true // Toggle blur effect for better performance
};

// Shader code for DOF blur effect
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

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    // Simple 9-tap blur (box/gaussian mix)
    for (float x = -1.0; x <= 1.0; x++) {
      for (float y = -1.0; y <= 1.0; y++) {
        vec2 offset = vec2(x, y) * uBlurStrength;
        color += texture2D(uTexture, vTexCoord + offset);
        total += 1.0;
      }
    }
    gl_FragColor = color / total;
  }
`;

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('petal-canvas-container');

  // Load the shader
  dofShader = createShader(vert, frag);

  // Load all images from the list
  petalImgs = await Promise.all(params.imageUrls.map(url => loadImage(url)));
  
  initPetals();
}

function initPetals() {
  petals = [];
  for (let i = 0; i < params.particleCount; i++) {
    petals.push(new Petal());
  }
}

function draw() {
  clear(); 
  
  ambientLight(180);
  directionalLight(255, 255, 255, 0, 0, -1);
  pointLight(255, 255, 255, width/2, -height/2, 200);

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
      this.pos = createVector(random(-width, width), random(-height, height), random(-1000, 400));
    } else {
      if (random() < 0.5) {
        this.pos = createVector(width/2 + random(100, 600), random(-height/2 - 200, height/2 + 200), random(-800, 200));
      } else {
        this.pos = createVector(random(-width/2 - 200, width/2 + 200), -height/2 - random(100, 600), random(-800, 200));
      }
    }
    
    this.vel = createVector(params.baseWind + random(-1, 1), random(-1, 1), random(-0.5, 0.5));
    this.size = random(params.minSize, params.maxSize);
    
    // Randomly pick an image from the loaded list
    if (petalImgs.length > 0) {
      this.img = random(petalImgs);
    }
    
    this.rot = createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI));
    this.rotVel = createVector(random(-1, 1), random(-1, 1), random(-1, 1)).mult(params.rotationSpeed);
    
    this.noiseOffset = random(10000);
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
    
    if (this.pos.x < -width/2 - 400 || this.pos.y > height/2 + 400 || this.pos.y < -height/2 - 800 || this.pos.z < -1500 || this.pos.z > 500) {
      this.randomize(false);
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
      if (params.enableBlur && blurStrength > 0) {
        shader(dofShader);
        dofShader.setUniform('uTexture', this.img);
        dofShader.setUniform('uBlurStrength', blurStrength);
        plane(this.size, this.size * (this.img.height / this.img.width));
        resetShader();
      } else {
        texture(this.img);
        plane(this.size, this.size * (this.img.height / this.img.width));
      }
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
