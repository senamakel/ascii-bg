import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer";
import image from "./assets/texture-5.jpg";

const LARGESCREEN = window.innerWidth > 1680;

const SHINECOLOR = "#f60"; //window.colors.menushine;
const BGCOLOR = "black"; //window.colors.pri;
const MOUSESIZE = 50;
const VISCOSITY = 0.98;
const GRIDMOUSESIZE = 20;
const GRIDVISCOSITY = 0.9;
const DAMP = 0.97;
const MATERIALSHINE = 180;
var POINTLIGHTHEIGHT = 70;
var POINTLIGHTSTRENGTH = 0.125;
var WATERMAXHEIGHT = 80;

class backgroundAnim {
  constructor() {
    this.clock = new THREE.Clock();
    this.time = new THREE.Clock();
    this.delta = 0;
    this.interval = 1 / 60;

    this.colorVal = 0.0;
    this.colorDir = -1;

    this.running = true;

    this.WIDTH = 256;
    this.BOUNDS = 512 * 2;
    this.BOUNDS_HALF = this.BOUNDS * 0.5;
    this.container;
    this.stats;
    this.camera, this.controls, this.scene, this.renderer, this.composer;
    this.mouseMoved = false;
    this.mouseCoords = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.waterMesh;
    this.heightmap0;
    this.material;
    this.meshRay;
    this.gpuCompute;
    this.heightmapVariable;
    this.waterUniforms;
    this.gridUniforms;
    this.smoothShader;
    this.readWaterLevelShader;
    this.readWaterLevelRenderTarget;
    this.readWaterLevelImage;
    this.waterNormal = new THREE.Vector3();
    // this.simplex =
    //   new three_examples_jsm_math_SimplexNoise_js__WEBPACK_IMPORTED_MODULE_3__[
    //     "SimplexNoise"
    //   ]();

    this.setMouseCoords = this.setMouseCoords.bind(this);
    this.initWater = this.initWater.bind(this);
    // this.fillTexture = this.fillTexture.bind(this);
    this.animate = this.animate.bind(this);
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.valuesChanger = this.valuesChanger.bind(this);

    this.splashTime = 0;

    this.asciiPass = undefined;
    var uniforms = {
      time: {
        type: "f",
        value: 1.0,
      },
      resolution: {
        type: "v2",
        value: new THREE.Vector2(),
      },
      charsize: {
        type: "f",
        value: 5.0,
      },
      brightness: {
        type: "f",
        value: 0.3,
      },
    };
    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;

    this.shaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: document.getElementById("asc-general").textContent,
      fragmentShader: document.getElementById("asc-frag1").textContent,
    });

    this.init();
    this.start();
    window.three = this;
  }

  init() {
    console.log("init");

    this.container = document.getElementById("container");
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    // this.issupported = this.renderer.domElement.getContext('webgl').getExtension('OES_texture_float');
    // if(!this.issupported){
    //   this.renderer.domElement.remove();
    //   return false;
    // }

    // document.body.appendChild( this.container );
    this.camera = new THREE.PerspectiveCamera(
      20,
      window.innerWidth / window.innerHeight,
      1,
      3000
    );

    this.camera.position.set(0, 0, 0);
    if (window.innerWidth > window.innerHeight) {
      let ratio = window.innerWidth / window.innerHeight;
      if (ratio < 2.5) {
        this.camera.position.y = 1897.77 - 506.472 * ratio;
      } else {
        this.camera.position.y =
          window.innerHeight * 1.45 - window.innerWidth * 0.15;
      }
      // 2.5
      // this.camera.position.y = 1910.98 - (511.005 * (window.innerWidth/window.innerHeight));
      // this.camera.position.y = 2864.73 - 1.00605*window.innerWidth;
    } else {
      this.camera.position.y = window.innerHeight * 1.63;
    }

    this.scene = new THREE.Scene({
      background: new THREE.Color(BGCOLOR),
    });
    this.gridscene = new THREE.Scene({
      background: null,
    });

    // var gridSceneLamp = new THREE.AmbientLight( 0x404040 );
    // this.gridscene.add( gridSceneLamp );

    var sun = new THREE.DirectionalLight(0x40a040, 0.2);
    // sun.position.set( 0, 500, 0 );
    sun.position.set(800, 450, 200);
    this.scene.add(sun);

    var sun2 = new THREE.DirectionalLight(0x40a040, 0.2);
    sun2.position.set(-500, 300, 0);
    this.scene.add(sun2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    // this.controls.target.y = -500;
    // this.controls.autoRotate = false;
    // this.controls.dispose();
    this.controls.update();

    // ("EffectComposer");
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // this.fxaaPass = new ShaderPass( FXAAShader );
    // this.fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    // this.composer.addPass( this.fxaaPass );

    this.afterimagePass = new AfterimagePass();
    this.afterimagePass.renderToScreen = true;
    this.afterimagePass.uniforms["damp"].value = 0.99;
    this.composer.addPass(this.afterimagePass);

    this.asciiPass = new ShaderPass(this.shaderMaterial, "media");
    this.shaderMaterial.uniforms.media = this.composer.renderTarget1;
    this.composer.addPass(this.asciiPass);

    // this.stats = new Stats();
    // this.container.appendChild( this.stats.dom );
    // this.stats.domElement.style.bottom = '0';
    // this.stats.domElement.style.top = 'auto';
    // this.stats.domElement.style.left = 'auto';
    // this.stats.domElement.style.right = '0';
    document.addEventListener(
      "mousemove",
      this.onDocumentMouseMove.bind(this),
      false
    );
    document.addEventListener(
      "touchstart",
      this.onDocumentTouchStart.bind(this),
      false
    );
    document.addEventListener(
      "touchmove",
      this.onDocumentTouchMove.bind(this),
      false
    );

    var parent = this;

    document.addEventListener(
      "keydown",
      function (event) {
        // W Pressed: Toggle wireframe
        if (event.keyCode === 87) {
          parent.waterMesh.material.wireframe =
            !parent.waterMesh.material.wireframe;
          parent.waterMesh.material.needsUpdate = true;
        }
      },
      false
    );
    window.addEventListener("resize", this.onWindowResize.bind(this), false);

    // this.gui = new dat_gui__WEBPACK_IMPORTED_MODULE_1__["default"].GUI();
    // this.gui.closed = true;
    this.effectController = {
      mouseSize: MOUSESIZE,
      viscosity: VISCOSITY,
      gridMouseSize: GRIDMOUSESIZE,
      gridViscosity: GRIDVISCOSITY,
      damp: DAMP,
      shininess: MATERIALSHINE,
      lightY: POINTLIGHTHEIGHT,
      lightStrength: POINTLIGHTSTRENGTH,
      watermaxheight: WATERMAXHEIGHT,
    };

    this.pointlight = new THREE.PointLight(
      0xffffff,
      this.effectController.lightY,
      POINTLIGHTHEIGHT
    );
    this.pointlight.position.set(0, this.effectController.lightStrength, 0);
    this.scene.add(this.pointlight);

    // this.gui
    //   .add(this.effectController, "mouseSize", 1.0, 100.0)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "viscosity", 0.001, 0.999)
    //   .onChange(this.valuesChanger);

    // this.gui
    //   .add(this.effectController, "gridMouseSize", 1.0, 100.0)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "gridViscosity", 0.001, 0.999)
    //   .onChange(this.valuesChanger);

    // this.gui
    //   .add(this.effectController, "damp", 0.97, 0.999, 0.001)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "shininess", 1.0, 120.0)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "lightY", 0.0, 50.0)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "lightStrength", 0.0, 1.0, 0.01)
    //   .onChange(this.valuesChanger);
    // this.gui
    //   .add(this.effectController, "watermaxheight", 30, 100)
    //   .onChange(this.valuesChanger);

    this.initWater();
    this.initGrid();
    //	createSpheres();
    this.valuesChanger();
    // this.gui.updateDisplay();

    this.animate();

    // var t = this;
    // $('.gui input[type="range"]').on("touchmove", function (e) {
    //   var left =
    //     e.originalEvent.touches[0].clientX -
    //     e.target.getBoundingClientRect().left;
    //   var prc = left / e.target.offsetWidth;
    //   e.target.value = e.target.max * prc;
    //   t.valuesChanger();
    //   t.gui.updateDisplay();
    //   $(this).trigger("input");
    // });

    console.log("done");
  }

  valuesChanger() {
    this.heightmapVariable.material.uniforms.mouseSize.value =
      this.effectController.mouseSize;
    this.heightmapVariable.material.uniforms.viscosityConstant.value =
      this.effectController.viscosity;

    this.afterimagePass.uniforms["damp"].value = this.effectController.damp;
    this.material.uniforms.shininess.value = parseInt(
      this.effectController.shininess
    );
    this.material.needsUpdate = true;

    WATERMAXHEIGHT = this.effectController.watermaxheight;
    POINTLIGHTHEIGHT = this.effectController.lightY;
    this.pointlight.distance = POINTLIGHTHEIGHT + 200;
    this.pointlight.intensity = this.effectController.lightStrength;

    // console.log('POINTLIGHTHEIGHT',POINTLIGHTHEIGHT);
  }

  addSplashes() {
    // console.log('should do random splashes');
    // let t = this.clock.getElapsedTime();
    let diff = this.time - this.splashTime;
    // if(diff > 0.005) {
    if (diff > 0.15) {
      // console.log(diff);
      this.mouseCoords.x = Math.random() * 2 - 1;
      this.mouseCoords.y = Math.random() * 2 - 1;
      this.mouseMoved = true;
      this.splashTime = this.time;
    }
    // this.fillTexture( this.heightmap0 );
  }

  // fillTexture( texture ) {
  //   var waterMaxHeight = 40;
  //
  //   const simplexNoise = this.simplex;
  //
  //   function noise( x, y ) {
  //     var multR = waterMaxHeight;
  //     var mult = 0.025;
  //     var r = 0;
  //     for ( var i = 0; i < 15; i ++ ) {
  //       r += multR * simplexNoise.noise( x * mult, y * mult );
  //       multR *= 0.53 + 0.025 * i;
  //       mult *= 1.25;
  //     }
  //     return r;
  //   }
  //
  //   var pixels = texture.image.data;
  //   var p = 0;
  //   for ( var j = 0; j < this.WIDTH; j ++ ) {
  //     for ( var i = 0; i < this.WIDTH; i ++ ) {
  //       var x = i * 128 / this.WIDTH;
  //       var y = j * 128 / this.WIDTH;
  //       pixels[ p + 0 ] = noise( x, y, 123.4 );
  //       pixels[ p + 1 ] = pixels[ p + 0 ];
  //       pixels[ p + 2 ] = 0;
  //       pixels[ p + 3 ] = 1;
  //       p += 49;
  //     }
  //   }
  // }

  animate() {
    this.time = this.clock.getElapsedTime();

    if (this.shaderMaterial) {
      this.shaderMaterial.uniforms.time.value = this.time;
    }
    /*
      if(this.mouseMoved) {
        this.colorVal += 0.01 * this.colorDir;
        if(this.colorVal<=0.0) this.colorDir = 1;
        if(this.colorVal>=1.0) this.colorDir = -1;
        let time = ((Math.sin(t)+1) / 2);
        this.material.specular = new THREE.Color( 0xffffff * time );
        console.log(time);
        console.log(this.material.specular);
        this.material.uniforms.specular.value = this.material.specular;
      }
      */

    this.updateGrid();
    this.controls.update();
    this.render();
    // this.stats.update();
    // this.raf = requestAnimationFrame( this.update );
  }

  update() {
    this.raf = requestAnimationFrame(this.update);

    // requestAnimationFrame(update);
    this.delta += this.clock.getDelta();

    if (this.delta > this.interval) {
      // The draw or time dependent code are here
      this.animate();
      this.delta = this.delta % this.interval;
    }
  }

  start() {
    this.raf = requestAnimationFrame(this.update);
  }
  stop() {
    cancelAnimationFrame(this.raf);
  }

  render() {
    // console.log('anim');
    // Set uniforms: mouse interaction
    var uniforms = this.heightmapVariable.material.uniforms;

    if (this.mouseMoved) {
      this.raycaster.setFromCamera(this.mouseCoords, this.camera);
      var intersects = this.raycaster.intersectObject(this.meshRay);
      if (intersects.length > 0) {
        var point = intersects[0].point;
        // console.log(point);
        uniforms.mousePos.value.set(point.x, point.z, point.y);

        this.gridUniforms2.mousePos.value.set(point.x, -point.z);

        this.pointlight.position.set(
          point.x,
          point.y + POINTLIGHTHEIGHT,
          point.z
        );
        // console.log(this.pointlight.position);
      } else {
        uniforms.mousePos.value.set(10000, 10000);
      }
      this.mouseMoved = false;
    } else {
      // uniforms.mousePos.value.set( 10000, 10000 );
      // uniforms2.mousePos.value.set( 10000, 10000 );
    }
    // Do the gpu computation
    this.gpuCompute.compute();
    // Get compute output in custom uniform
    this.waterUniforms.heightmap.value = this.gpuCompute.getCurrentRenderTarget(
      this.heightmapVariable
    ).texture;

    this.renderer.autoClear = true;
    this.composer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.render(this.gridscene, this.camera);
  }

  updateGrid() {
    const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

    let mousePos = this.gridUniforms2.mousePos.value;
    for (var i = 0; i < this.pointsWrap.children.length; i++) {
      let sphere = this.pointsWrap.children[i];
      if (sphere.origPosition && sphere.avgPositions) {
        let dist = sphere.position.distanceTo(mousePos);
        // let dist = (sphere.position.manhattanDistanceTo(mousePos) + sphere.position.distanceTo(mousePos)) / 2;

        let curAvgs = new THREE.Vector3(0, 0, 0);
        for (var p = 0; p < sphere.avgPositions.length; p++) {
          curAvgs.add(sphere.avgPositions[p]);
        }

        // curAvgs.divide(sphere.avgPositions.length);

        // if(i==1) {
        //   console.log(curAvgs);
        // }
        curAvgs.x /= sphere.avgPositions.length;
        curAvgs.y /= sphere.avgPositions.length;
        curAvgs.z /= sphere.avgPositions.length;

        let newPos = new THREE.Vector3(
          curAvgs.x,
          // sphere.avgPositions[sphere.avgPositions.length-1].x,
          curAvgs.y,
          // sphere.avgPositions[sphere.avgPositions.length-1].y,
          // (sphere.avgPositions[sphere.avgPositions.length-1].x + sphere.origPosition.x) / 2,
          // (sphere.avgPositions[sphere.avgPositions.length-1].y + sphere.origPosition.y) / 2,
          0
        );

        // if(dist <= 100 && this.mouseMoved)Â {
        let pos = new THREE.Vector3().copy(
          sphere.avgPositions[sphere.avgPositions.length - 1]
        );
        let seg = pos.sub(mousePos);
        let dir = seg.normalize();
        // let force = -dist*.05;
        let force = clamp(14000 / (dist * dist), 0, 70.0);

        // if(!this.mouseMoved) force = .0;

        if (sphere.origPosition && sphere.avgPositions) {
          newPos = new THREE.Vector3(
            (curAvgs.x * 1.75 + sphere.origPosition.x * 0.25) / 2 +
              force * dir.x,
            (curAvgs.y * 1.75 + sphere.origPosition.y * 0.25) / 2 +
              force * dir.y,
            // ((sphere.avgPositions[0].x + sphere.origPosition.x) / 2) + (force * dir.x),
            // ((sphere.avgPositions[0].y + sphere.origPosition.y) / 2) + (force * dir.y),
            0
          );
        }
        // }

        sphere.avgPositions.unshift(newPos);
        sphere.avgPositions.pop();

        let avgPos = new THREE.Vector3(0, 0, 0);
        for (var p = 0; p < sphere.avgPositions.length; p++) {
          avgPos.add(sphere.avgPositions[p]);
        }

        avgPos.x /= sphere.avgPositions.length;
        avgPos.y /= sphere.avgPositions.length;
        avgPos.z /= sphere.avgPositions.length;

        sphere.position.x = avgPos.x;
        sphere.position.y = avgPos.y;
        // console.log(dist);
        // vec3 dir = normalize(seg) * 2.;
        // float dist = length(seg);
        // if (dist < 8000.){
        //   float force = clamp(8000. / (dist * dist), 0., 5.);
        //   transformed += dir * force;
        // }
        // sphere.position.y += Math.sin(this.clock.getElapsedTime());
      }
    }
  }

  initGrid() {
    var pointsCount = parseInt(this.WIDTH * 0.125);
    pointsCount = LARGESCREEN ? parseInt(this.WIDTH * 0.15) : pointsCount;
    const pointGridSize = pointsCount;
    // this.gridGeometry = new THREE.PlaneGeometry( this.BOUNDS, this.BOUNDS, this.WIDTH - 1, this.WIDTH - 1 );
    // this.gridGeometry = new THREE.PlaneGeometry( this.BOUNDS, this.BOUNDS, pointGridSize - 1, pointGridSize - 1 );

    let pointsWrap = (this.pointsWrap = new THREE.Object3D());
    pointsWrap.name = "Point grid";

    // this.marker = new THREE.Mesh(new THREE.SphereGeometry(2, 40, 8), new THREE.MeshBasicMaterial({color: "red", wireframe: true}));
    // pointsWrap.add(this.marker);

    this.gridUniforms2 = {
      mousePos: { value: new THREE.Vector3(-10000, -10000, 0) },
    };

    /*
      let g = new THREE.IcosahedronGeometry(40, 40);
      g = BufferGeometryUtils.mergeVertices(g);
      let uniforms = {
        mousePos: {value: new THREE.Vector3()}
      }
      let m = new THREE.PointsMaterial({
        size: 4.0,
        depthTest: false,
        onBeforeCompile: shader => {
          shader.uniforms.mousePos = this.gridUniforms2.mousePos;
          shader.vertexShader = `
          uniform vec3 mousePos;
          ${shader.vertexShader}
          `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>

            vec3 seg = position - mousePos;
            vec3 dir = normalize(seg) * 2.;
            float dist = length(seg);
            if (dist < 8000.){
              float force = clamp(8000. / (dist * dist), 0., 5.);
              transformed += dir * force;
            }

            `
          );
          console.log(shader.vertexShader);
        }
      });


      var points = new THREE.Points(this.gridGeometry, m);
      points.name = 'Point grid';
      pointsWrap.add(points);
      */

    // console.log(pointGridSize);

    // let dotThickness = 0.973228 - (0.000354331 * window.innerWidth);
    let dotSize = window.innerWidth > 1400 ? 0.5 : 0.66;
    this.sphereGeometry = new THREE.PlaneGeometry(dotSize, dotSize);
    // this.sphereGeometry = new THREE.PlaneBufferGeometry( .5, .5 );
    // this.sphereGeometry = new THREE.SphereGeometry( .25, 8, 8 );

    this.sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
    });

    for (var i = 0; i < pointGridSize; i++) {
      for (var j = 0; j < pointGridSize; j++) {
        const sphere = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);

        sphere.position.x =
          -this.WIDTH * 1.25 + (i / pointGridSize) * this.WIDTH * 2.5;
        sphere.position.y =
          -this.WIDTH * 1.25 + (j / pointGridSize) * this.WIDTH * 2.5;

        sphere.origPosition = new THREE.Vector3().copy(sphere.position);
        sphere.avgPositions = [
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
          new THREE.Vector3().copy(sphere.position),
        ];

        pointsWrap.add(sphere);
      }
    }

    pointsWrap.name = "pointsWrap";
    pointsWrap.rotation.x = -Math.PI / 2;
    // pointsWrap.position.y = 1.128 * window.innerWidth - 2160;

    this.gridscene.add(pointsWrap);
  }

  initWater() {
    var texture_test = new THREE.TextureLoader().load(image);
    texture_test.wrapS = THREE.RepeatWrapping;
    texture_test.wrapT = THREE.RepeatWrapping;
    texture_test.repeat.set(4, 4);

    var materialColor = BGCOLOR;
    this.geometry = new THREE.PlaneGeometry(
      this.BOUNDS,
      this.BOUNDS,
      this.WIDTH - 1,
      this.WIDTH - 1
    );
    // material: make a ShaderMaterial clone of MeshPhongMaterial, with customized vertex shader
    var copyPhong = THREE.ShaderLib["phong"].uniforms;
    copyPhong.texture = texture_test;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        copyPhong,
        {
          heightmap: { value: null },
        },
      ]),
      // wireframe: true,
      vertexShader: document.getElementById("waterVertexShader").textContent,
      // vertexShader: THREE.ShaderChunk[ 'meshphong_vert' ],
      fragmentShader: THREE.ShaderChunk["meshphong_frag"],
    });

    this.material.lights = true;
    // Material attributes from MeshPhongMaterial
    this.material.color = new THREE.Color(materialColor);
    // this.material.uniforms.map = new THREE.TextureLoader().load( BGTEXTURE );
    this.material.specular = new THREE.Color(SHINECOLOR);
    this.material.shininess = MATERIALSHINE;
    // Sets the uniforms with the material values
    this.material.uniforms.diffuse.value = this.material.color;
    this.material.uniforms.specular.value = this.material.specular;
    this.material.uniforms.shininess.value = Math.max(
      this.material.shininess,
      0.0001
    );
    this.material.uniforms.opacity.value = this.material.opacity;

    // Defines
    this.material.defines.WIDTH = this.WIDTH.toFixed(1);
    this.material.defines.BOUNDS = this.BOUNDS.toFixed(1);
    this.waterUniforms = this.material.uniforms;
    this.waterMesh = new THREE.Mesh(this.geometry, this.material);
    this.waterMesh.rotation.x = -Math.PI / 2;
    // this.waterMesh.position.y = 1.128 * window.innerWidth - 2160;
    this.waterMesh.matrixAutoUpdate = false;
    this.waterMesh.updateMatrix();

    // MAIN WATER THING
    // this.waterMesh.material.visible = false;

    this.scene.add(this.waterMesh);

    // Mesh just for mouse raycasting
    var geometryRay = new THREE.PlaneGeometry(this.BOUNDS, this.BOUNDS, 1, 1);
    this.meshRay = new THREE.Mesh(
      geometryRay,
      new THREE.MeshBasicMaterial({ color: 0xa0a0a0, visible: false })
    );
    this.meshRay.rotation.x = -Math.PI / 2;
    this.meshRay.matrixAutoUpdate = false;
    this.meshRay.updateMatrix();
    // this.meshRay.position.y = 1.128 * window.innerWidth - 2160;

    this.scene.add(this.meshRay);

    // Creates the gpu computation class and sets it up
    this.gpuCompute = new GPUComputationRenderer(
      this.WIDTH,
      this.WIDTH,
      this.renderer
    );

    this.heightmap0 = this.gpuCompute.createTexture();

    this.heightmapVariable = this.gpuCompute.addVariable(
      "heightmap",
      document.getElementById("heightmapFragmentShader").textContent,
      this.heightmap0
    );
    this.gpuCompute.setVariableDependencies(this.heightmapVariable, [
      this.heightmapVariable,
    ]);

    this.heightmapVariable.material.uniforms.mousePos = {
      value: new THREE.Vector2(10000, 10000),
    };
    this.heightmapVariable.material.uniforms.mouseSize = { value: MOUSESIZE };
    this.heightmapVariable.material.uniforms.viscosityConstant = {
      value: VISCOSITY,
    };
    this.heightmapVariable.material.uniforms.heightCompensation = { value: 0 };
    this.heightmapVariable.material.defines.BOUNDS = this.BOUNDS.toFixed(1);

    var error = this.gpuCompute.init();
    if (error !== null) {
      console.error(error);
    }
    // Create compute shader to smooth the water surface and velocity
    //	smoothShader = gpuCompute.createShaderMaterial( document.getElementById( 'smoothFragmentShader' ).textContent, { texture: { value: null } } );
    // Create compute shader to read water level
    this.readWaterLevelShader = this.gpuCompute.createShaderMaterial(
      document.getElementById("readWaterLevelFragmentShader").textContent,
      {
        point1: { value: new THREE.Vector2() },
        texture: { value: null },
      }
    );
    this.readWaterLevelShader.defines.WIDTH = this.WIDTH.toFixed(1);
    this.readWaterLevelShader.defines.BOUNDS = this.BOUNDS.toFixed(1);
    // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
    this.readWaterLevelImage = new Uint8Array(4 * 1 * 4);
    this.readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: false,
    });
  }

  smoothWater() {
    var currentRenderTarget = this.gpuCompute.getCurrentRenderTarget(
      this.heightmapVariable
    );
    var alternateRenderTarget = this.gpuCompute.getAlternateRenderTarget(
      this.heightmapVariable
    );
    for (var i = 0; i < 10; i++) {
      this.smoothShader.uniforms.texture.value = currentRenderTarget.texture;
      this.gpuCompute.doRenderTarget(this.smoothShader, alternateRenderTarget);
      this.smoothShader.uniforms.texture.value = alternateRenderTarget.texture;
      this.gpuCompute.doRenderTarget(this.smoothShader, currentRenderTarget);
    }

    currentRenderTarget = this.gpuCompute.getCurrentRenderTarget(
      this.heightmapVariable2
    );
    alternateRenderTarget = this.gpuCompute.getAlternateRenderTarget(
      this.heightmapVariable2
    );
    for (var i = 0; i < 10; i++) {
      this.smoothShader.uniforms.texture.value = currentRenderTarget.texture;
      this.gpuCompute.doRenderTarget(this.smoothShader, alternateRenderTarget);
      this.smoothShader.uniforms.texture.value = alternateRenderTarget.texture;
      this.gpuCompute.doRenderTarget(this.smoothShader, currentRenderTarget);
    }
  }
  onWindowResize() {
    clearTimeout(window.resize);
    var t = this;
    window.resize = setTimeout(function () {
      let ratio = window.innerWidth / window.innerHeight;
      if (ratio < 2.5) {
        t.camera.position.y = 1897.77 - 506.472 * ratio;
      } else {
        t.camera.position.y =
          window.innerHeight * 1.45 - window.innerWidth * 0.15;
      }

      t.camera.aspect = window.innerWidth / window.innerHeight;
      t.camera.updateProjectionMatrix();
      t.renderer.setSize(window.innerWidth, window.innerHeight);
      t.shaderMaterial.uniforms.resolution.value.x = window.innerWidth;
      t.shaderMaterial.uniforms.resolution.value.y = window.innerHeight;
    }, 10);
  }
  setMouseCoords(x, y) {
    this.mouseCoords.set(
      (x / this.renderer.domElement.clientWidth) * 2 - 1,
      -(y / this.renderer.domElement.clientHeight) * 2 + 1
    );

    this.mouseMoved = true;
  }
  onDocumentMouseMove(event) {
    this.setMouseCoords(event.clientX, event.clientY);

    this.colorVal += 0.000001;
    this.material.specular = this.material.specular.offsetHSL(
      Math.sin(this.colorVal),
      1.0,
      0.0
    );
    this.material.uniforms.specular.value = this.material.specular;
  }
  onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
      // event.preventDefault();
      this.setMouseCoords(event.touches[0].clientX, event.touches[0].clientY);
    }
  }
  onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
      // event.preventDefault();
      this.setMouseCoords(event.touches[0].clientX, event.touches[0].clientY);
    }
  }
}

export default backgroundAnim;
