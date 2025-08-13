import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Mesh, Program, Renderer, Triangle, Vec3} from 'ogl';

@Component({
  selector: 'om-galaxy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ngx-galaxy.component.html',
  styleUrl: './ngx-galaxy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxGalaxyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('wrapper', {static: true}) wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('container', {static: true}) containerRef!: ElementRef<HTMLDivElement>;

  @Input() focal: [number, number] = [0.5, 0.5];
  @Input() rotation: [number, number] = [1.0, 0.0];
  @Input() starSpeed = 0.5;
  @Input() density = 1;
  @Input() hueShift = 140;
  @Input() disableAnimation = false;
  @Input() speed = 1.0;
  @Input() mouseInteraction = true;
  @Input() glowIntensity = 0.3;
  @Input() saturation = 0.0;
  @Input() mouseRepulsion = true;
  @Input() twinkleIntensity = 0.3;
  @Input() rotationSpeed = 0.1;
  @Input() repulsionStrength = 2;
  @Input() autoCenterRepulsion = 0;
  @Input() transparent = true;

  private renderer?: Renderer;
  private program?: Program;
  private mesh?: Mesh;
  private rafId: number | null = null;
  private resizeHandler?: () => void;
  private intersectionObserver?: IntersectionObserver;

  private targetMousePos = {x: 0.5, y: 0.5};
  private smoothMousePos = {x: 0.5, y: 0.5};
  private targetMouseActive = 0.0;
  private smoothMouseActive = 0.0;
  private onPointerMove?: (e: PointerEvent) => void;
  private onPointerLeave?: (e: PointerEvent) => void;

  isInView = signal(false);

  private readonly vertexShader = `
    attribute vec2 uv;
    attribute vec2 position;

    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0, 1);
    }
  `;

  private readonly fragmentShader = `
    precision highp float;

    uniform float uTime;
    uniform vec3 uResolution;
    uniform vec2 uFocal;
    uniform vec2 uRotation;
    uniform float uStarSpeed;
    uniform float uDensity;
    uniform float uHueShift;
    uniform float uSpeed;
    uniform vec2 uMouse;
    uniform float uGlowIntensity;
    uniform float uSaturation;
    uniform bool uMouseRepulsion;
    uniform float uTwinkleIntensity;
    uniform float uRotationSpeed;
    uniform float uRepulsionStrength;
    uniform float uMouseActiveFactor;
    uniform float uAutoCenterRepulsion;
    uniform bool uTransparent;

    varying vec2 vUv;

    #define NUM_LAYER 4.0
    #define STAR_COLOR_CUTOFF 0.2
    #define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
    #define PERIOD 3.0

    float Hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float tri(float x) {
      return abs(fract(x) * 2.0 - 1.0);
    }

    float tris(float x) {
      float t = fract(x);
      return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
    }

    float trisn(float x) {
      float t = fract(x);
      return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
    }

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    float Star(vec2 uv, float flare) {
      float d = length(uv);
      float m = (0.05 * uGlowIntensity) / d;
      float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
      m += rays * flare * uGlowIntensity;
      uv *= MAT45;
      rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
      m += rays * 0.3 * flare * uGlowIntensity;
      m *= smoothstep(1.0, 0.2, d);
      return m;
    }

    vec3 StarLayer(vec2 uv) {
      vec3 col = vec3(0.0);

      vec2 gv = fract(uv) - 0.5;
      vec2 id = floor(uv);

      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 offset = vec2(float(x), float(y));
          vec2 si = id + vec2(float(x), float(y));
          float seed = Hash21(si);
          float size = fract(seed * 345.32);
          float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
          float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

          float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
          float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
          float grn = min(red, blu) * seed;
          vec3 base = vec3(red, grn, blu);

          float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
          hue = fract(hue + uHueShift / 360.0);
          float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
          float val = max(max(base.r, base.g), base.b);
          base = hsv2rgb(vec3(hue, sat, val));

          vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

          float star = Star(gv - offset - pad, flareSize);
          vec3 color = base;

          float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
          twinkle = mix(1.0, twinkle, uTwinkleIntensity);
          star *= twinkle;

          col += star * size * color;
        }
      }

      return col;
    }

    void main() {
      vec2 focalPx = uFocal * uResolution.xy;
      vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

      vec2 mouseNorm = uMouse - vec2(0.5);

      if (uAutoCenterRepulsion > 0.0) {
        vec2 centerUV = vec2(0.0, 0.0);
        float centerDist = length(uv - centerUV);
        vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
        uv += repulsion * 0.05;
      } else if (uMouseRepulsion) {
        vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
        float mouseDist = length(uv - mousePosUV);
        vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
        uv += repulsion * 0.05 * uMouseActiveFactor;
      } else {
        vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
        uv += mouseOffset;
      }

      float autoRotAngle = uTime * uRotationSpeed;
      mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
      uv = autoRot * uv;

      uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

      vec3 col = vec3(0.0);

      for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
        float depth = fract(i + uStarSpeed * uSpeed);
        float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
        float fade = depth * smoothstep(1.0, 0.9, depth);
        col += StarLayer(uv * scale + i * 453.32) * fade;
      }

      if (uTransparent) {
        float alpha = length(col);
        alpha = smoothstep(0.0, 0.3, alpha);
        alpha = min(alpha, 1.0);
        gl_FragColor = vec4(col, alpha);
      } else {
        gl_FragColor = vec4(col, 1.0);
      }
    }
  `;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isInView.set(entry.isIntersecting);
        if (entry.isIntersecting) this.initAndStart();
        else this.stopAndCleanup();
      },
      {threshold: 0.1}
    );
    this.intersectionObserver.observe(this.wrapperRef.nativeElement);
  }

  private initAndStart() {
    this.stopAndCleanup();

    const container = this.containerRef.nativeElement;

    this.renderer = new Renderer({
      alpha: this.transparent,
      premultipliedAlpha: false,
    });
    const gl = this.renderer.gl;

    if (this.transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(0, 0, 0, 1);
    }

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    this.program = new Program(gl, {
      vertex: this.vertexShader,
      fragment: this.fragmentShader,
      uniforms: {
        uTime: {value: 0},
        uResolution: {value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)},
        uFocal: {value: new Float32Array(this.focal)},
        uRotation: {value: new Float32Array(this.rotation)},
        uStarSpeed: {value: this.starSpeed},
        uDensity: {value: this.density},
        uHueShift: {value: this.hueShift},
        uSpeed: {value: this.speed},
        uMouse: {value: new Float32Array([this.smoothMousePos.x, this.smoothMousePos.y])},
        uGlowIntensity: {value: this.glowIntensity},
        uSaturation: {value: this.saturation},
        uMouseRepulsion: {value: this.mouseRepulsion},
        uTwinkleIntensity: {value: this.twinkleIntensity},
        uRotationSpeed: {value: this.rotationSpeed},
        uRepulsionStrength: {value: this.repulsionStrength},
        uMouseActiveFactor: {value: 0.0},
        uAutoCenterRepulsion: {value: this.autoCenterRepulsion},
        uTransparent: {value: this.transparent},
      },
    });

    this.mesh = new Mesh(gl, {geometry, program: this.program});

    const resize = () => {
      if (!this.renderer || !this.program) return;
      const scale = 1;
      this.renderer.setSize(container.offsetWidth * scale, container.offsetHeight * scale);
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      (this.program.uniforms['uResolution'].value as Vec3).set(w, h, w / h);
    };
    window.addEventListener('resize', resize, false);
    this.resizeHandler = () => window.removeEventListener('resize', resize);
    resize();

    if (this.mouseInteraction) {
      const wrapper = this.wrapperRef.nativeElement;
      this.onPointerMove = (e: PointerEvent) => {
        const rect = wrapper.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height; // matches shader's Y
        this.targetMousePos = {x, y};
        this.targetMouseActive = 1.0;
      };
      this.onPointerLeave = () => {
        this.targetMouseActive = 0.0;
      };
      wrapper.addEventListener('pointermove', this.onPointerMove, {passive: true});
      wrapper.addEventListener('pointerleave', this.onPointerLeave, {passive: true});
      wrapper.addEventListener('pointerdown', this.onPointerMove, {passive: true});
    }

    const loop = (t: number) => {
      this.rafId = requestAnimationFrame(loop);
      if (!this.renderer || !this.program || !this.mesh) return;

      if (!this.disableAnimation) {
        this.program.uniforms['uTime'].value = t * 0.001;
        this.program.uniforms['uStarSpeed'].value = (t * 0.001 * this.starSpeed) / 10.0;
      }

      const lerp = 0.05;
      this.smoothMousePos.x += (this.targetMousePos.x - this.smoothMousePos.x) * lerp;
      this.smoothMousePos.y += (this.targetMousePos.y - this.smoothMousePos.y) * lerp;
      this.smoothMouseActive += (this.targetMouseActive - this.smoothMouseActive) * lerp;

      (this.program.uniforms['uMouse'].value as Float32Array)[0] = this.smoothMousePos.x;
      (this.program.uniforms['uMouse'].value as Float32Array)[1] = this.smoothMousePos.y;
      this.program.uniforms['uMouseActiveFactor'].value = this.smoothMouseActive;

      // live-update uniforms from inputs
      this.program.uniforms['uFocal'].value = new Float32Array(this.focal);
      this.program.uniforms['uRotation'].value = new Float32Array(this.rotation);
      this.program.uniforms['uDensity'].value = this.density;
      this.program.uniforms['uHueShift'].value = this.hueShift;
      this.program.uniforms['uSpeed'].value = this.speed;
      this.program.uniforms['uGlowIntensity'].value = this.glowIntensity;
      this.program.uniforms['uSaturation'].value = this.saturation;
      this.program.uniforms['uMouseRepulsion'].value = this.mouseRepulsion;
      this.program.uniforms['uTwinkleIntensity'].value = this.twinkleIntensity;
      this.program.uniforms['uRotationSpeed'].value = this.rotationSpeed;
      this.program.uniforms['uRepulsionStrength'].value = this.repulsionStrength;
      this.program.uniforms['uAutoCenterRepulsion'].value = this.autoCenterRepulsion;
      this.program.uniforms['uTransparent'].value = this.transparent;

      try {
        this.renderer.render({scene: this.mesh});
      } catch {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopAndCleanup() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const wrapper = this.wrapperRef?.nativeElement;
    if (wrapper && this.onPointerMove) wrapper.removeEventListener('pointermove', this.onPointerMove);
    if (wrapper && this.onPointerLeave) wrapper.removeEventListener('pointerleave', this.onPointerLeave);
    this.onPointerMove = undefined;
    this.onPointerLeave = undefined;

    if (this.resizeHandler) {
      this.resizeHandler();
      this.resizeHandler = undefined;
    }

    if (this.renderer) {
      try {
        const lose = this.renderer.gl.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        const canvas = this.renderer.gl.canvas;
        canvas?.parentNode?.removeChild(canvas);
      } catch {
      }
    }

    this.mesh = undefined;
    this.program = undefined;
    this.renderer = undefined;
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.stopAndCleanup();
  }
}
