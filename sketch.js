let petalImgs = [];
let petals = [];
let dofShader;
let lastEmissionTime = 0;
let petalMesh = null;
let debugImg = null;
let overlayShader;
let petalBuffer;

// Parameters for customization
let params = {
  imageUrls: [
    'imgs/petal-01.png',
    'imgs/petal-02.png',
  ],
  maxParticleCount: 60,   // Limit the maximum number of particles
  emissionRate: 6,        // Particles per second
  fadeInTime: 0.6,        // In seconds
  fadeOutTime: 0.6,       // In seconds
  minSize: 10,
  maxSize: 80,
  baseWind: -1.5,
  noiseScale: 0.002,
  noiseStrength: 1.2,
  rotationSpeed: 0.01,
  gravity: 0.02,
  noiseFrequency: 0.001,
  maxBlur: 0.08, 
  enableBlur: true,
  meshDetailX: 10,      // Mesh grid density (columns)
  meshDetailY: 10,      // Mesh grid density (rows)
  vertexNoiseScale: 0.006, // Vertex noise scale for fluttering
  vertexNoiseStrength: 36.0, // Vertex displacement strength
  blurNearZ: -3.6,      // World Z where blur starts
  blurFarZ: 3.6,        // World Z where blur reaches max
  centerMaskRadius: 0.6, // Radius (0-1) from center where masking starts
  centerMaskFeather: 0.6, // Softness of the mask edge
  centerMaskMinOpacity: 0.16, // Minimum opacity at center
  debugPlane: false,     // Show a debug plane to visualize vertex noise
  debugPlaneSize: 240,  // Debug plane size
  debugPlaneRotationX: 90, // Debug plane rotation X (degrees)
  debugPlaneRotationY: 0.0, // Debug plane rotation Y (degrees)
  debugPlaneRotationZ: 0.0    // Debug plane rotation Z (degrees)
};

// Shader code for DOF blur effect with Alpha support
const vert = `
  precision mediump float;

  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  varying float vWorldZ;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat3 uNormalMatrix;
  uniform float uTime;
  uniform float uSeed;
  uniform float uVertexNoiseScale;
  uniform float uVertexNoiseStrength;

  // 3D noise (simple, fast value noise)
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float n00 = mix(n000, n100, f.x);
    float n01 = mix(n001, n101, f.x);
    float n10 = mix(n010, n110, f.x);
    float n11 = mix(n011, n111, f.x);
    float n0 = mix(n00, n10, f.y);
    float n1 = mix(n01, n11, f.y);
    return mix(n0, n1, f.z);
  }

  void main() {
    vTexCoord = aTexCoord;
    vec3 pos = aPosition;

    // Edge weight so center stays more stable than the edges
    vec2 centered = vTexCoord - 0.5;
    float edge = smoothstep(0.1, 0.9, length(centered) * 2.0);

    // World-space position and normal
    vec4 worldPos = uModelMatrix * vec4(pos, 1.0);
    vec3 worldNormal = normalize(mat3(uModelMatrix) * aNormal);

    // 3D noise based on world position
    vec3 p = worldPos.xyz * uVertexNoiseScale + vec3(0.0, 0.0, uTime * 0.01 + uSeed);
    float n = noise3(p) * 2.0 - 1.0;

    // Displace along world normal
    worldPos.xyz += worldNormal * n * edge * uVertexNoiseStrength;

    vWorldZ = worldPos.z;

    // Project using view-projection
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
  }
`;

const frag = `
  precision mediump float;

  varying vec2 vTexCoord;
  varying float vWorldZ;
  uniform sampler2D uTexture;
  uniform float uBlurStrength;
  uniform float uBlurNearZ;
  uniform float uBlurFarZ;
  uniform float uOpacity;

  void main() {
    float blurT = clamp((vWorldZ - uBlurNearZ) / (uBlurFarZ - uBlurNearZ), 0.0, 1.0);
    float blurStrength = uBlurStrength * blurT;

    vec4 color = vec4(0.0);
    float total = 0.0;
    
    for (float x = -1.0; x <= 1.0; x++) {
      for (float y = -1.0; y <= 1.0; y++) {
        vec2 offset = vec2(x, y) * blurStrength;
        color += texture2D(uTexture, vTexCoord + offset);
        total += 1.0;
      }
    }
    vec4 finalColor = color / total;
    gl_FragColor = vec4(finalColor.rgb, finalColor.a * uOpacity);
  }
`;

// Full-screen pass (center mask)
const overlayVert = `
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

const overlayFrag = `
  precision mediump float;
  varying vec2 vTexCoord;
  uniform sampler2D uScene;
  uniform float uMaskRadius;
  uniform float uMaskFeather;
  uniform float uMaskMinOpacity;
  void main() {
    vec4 color = texture2D(uScene, vTexCoord);
    vec2 centered = vTexCoord - 0.5;
    float dist = length(centered) * 2.0;
    float t = smoothstep(uMaskRadius, uMaskRadius + uMaskFeather, dist);
    float maskOpacity = mix(uMaskMinOpacity, 1.0, t);
    // Fade petals near the center by reducing both color and alpha
    gl_FragColor = vec4(color.rgb * maskOpacity, color.a * maskOpacity);
  }
`;

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('petal-canvas-container');

  dofShader = createShader(vert, frag);
  overlayShader = createShader(overlayVert, overlayFrag);
  petalImgs = await Promise.all(params.imageUrls.map(url => loadImage(url)));
  petalMesh = buildPetalMesh();
  petalBuffer = createFramebuffer();

  if(params.debugPlane) {
    debugImg = await loadImage('imgs/debug.png');
  }
  
  // Start with no petals, they will be emitted over time
  petals = [];
  lastEmissionTime = millis();
}

function buildPetalMesh() {
  const detailX = max(1, floor(params.meshDetailX));
  const detailY = max(1, floor(params.meshDetailY));

  // Build a reusable p5.Geometry mesh using WebGL's internal geometry builder
  const geom = buildGeometry(() => {
    beginShape(TRIANGLES);
    for (let y = 0; y < detailY; y++) {
      const v0 = y / detailY;
      const v1 = (y + 1) / detailY;
      for (let x = 0; x < detailX; x++) {
        const u0 = x / detailX;
        const u1 = (x + 1) / detailX;

        const x0 = u0 - 0.5;
        const x1 = u1 - 0.5;
        const y0 = v0 - 0.5;
        const y1 = v1 - 0.5;

        // Triangle 1
        vertex(x0, y0, 0, u0, v0);
        vertex(x1, y0, 0, u1, v0);
        vertex(x1, y1, 0, u1, v1);
        // Triangle 2
        vertex(x0, y0, 0, u0, v0);
        vertex(x1, y1, 0, u1, v1);
        vertex(x0, y1, 0, u0, v1);
      }
    }
    endShape();
  });

  return geom;
}

function draw() {
  // Render petals into the offscreen buffer
  petalBuffer.begin();
  clear();

  // Transparency setup: disable depth test for proper alpha blending
  const gl = drawingContext;
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

  // Sort by Z to reduce transparency artifacts (back-to-front)
  petals.sort((a, b) => a.pos.z - b.pos.z);

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

  drawDebugPlane();
  gl.enable(gl.DEPTH_TEST);
  petalBuffer.end();

  // Composite with a full-screen pass that applies the center mask
  clear();
  drawCenterMaskOverlay();
}

function drawCenterMaskOverlay() {
  push();
  resetMatrix();
  noStroke();
  shader(overlayShader);
  const sceneTex = petalBuffer.color || petalBuffer;
  overlayShader.setUniform('uScene', sceneTex);
  overlayShader.setUniform('uMaskRadius', params.centerMaskRadius);
  overlayShader.setUniform('uMaskFeather', params.centerMaskFeather);
  overlayShader.setUniform('uMaskMinOpacity', params.centerMaskMinOpacity);
  rectMode(CENTER);
  // Use the current WEBGL coordinate system
  rect(0, 0, width, height);
  resetShader();
  pop();
}

function drawDebugPlane() {
  if (!params.debugPlane || !petalImgs[0]) {
    return;
  }

  push();
  translate(0, 0, 0);
  rotateX(radians(params.debugPlaneRotationX));
  rotateY(radians(params.debugPlaneRotationY));
  rotateZ(radians(params.debugPlaneRotationZ));
  noStroke();

  shader(dofShader);
  dofShader.setUniform('uTexture', debugImg);
  dofShader.setUniform('uBlurStrength', params.maxBlur);
  dofShader.setUniform('uBlurNearZ', params.blurNearZ);
  dofShader.setUniform('uBlurFarZ', params.blurFarZ);
  dofShader.setUniform('uOpacity', 1);
  dofShader.setUniform('uTime', millis() / 100);
  dofShader.setUniform('uSeed', 123.456);
  dofShader.setUniform('uVertexNoiseScale', params.vertexNoiseScale);
  dofShader.setUniform('uVertexNoiseStrength', params.vertexNoiseStrength);

  scale(params.debugPlaneSize, params.debugPlaneSize, 1);
  model(petalMesh);
  resetShader();
  pop();
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
    this.seed = random(1000);
    
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
      dofShader.setUniform('uBlurStrength', params.maxBlur);
      dofShader.setUniform('uBlurNearZ', params.blurNearZ);
      dofShader.setUniform('uBlurFarZ', params.blurFarZ);
      dofShader.setUniform('uOpacity', this.opacity);
      dofShader.setUniform('uTime', millis() / 100);
      dofShader.setUniform('uSeed', this.seed);
      dofShader.setUniform('uVertexNoiseScale', params.vertexNoiseScale);
      dofShader.setUniform('uVertexNoiseStrength', params.vertexNoiseStrength);

      const aspect = this.img.height / this.img.width;
      push();
      scale(this.size, this.size * aspect, 1);
      model(petalMesh);
      pop();
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
