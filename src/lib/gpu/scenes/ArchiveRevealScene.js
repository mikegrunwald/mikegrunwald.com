// Second-renderer image reveal for the Project Archive (Plan C). Renders a
// single cursor-following textured plane onto a route-local canvas layered
// ABOVE the DOM table, sharing the engine's GPU device. Mirrors CarouselScene's
// plain-Mesh + MediaTexture + WGSL approach (manual placement, no DOM-sync).
//
// gpu-curtains 0.16.3 API — VERIFIED against node_modules/gpu-curtains source:
//   1. Second renderer sharing the device: `GPURenderer` (base of
//      `GPUCameraRenderer`) constructor takes `{ deviceManager, container, ... }`
//      (GPURenderer.d.ts:36-40; container may be a canvas element) and
//      SELF-REGISTERS with `this.deviceManager.addRenderer(this)`
//      (GPURenderer.mjs:34). `GPUDeviceManager.render()` iterates
//      `this.renderers.forEach((r) => r.render(commandEncoder))`
//      (GPUDeviceManager.mjs:494) each frame — so a renderer added to the
//      engine's shared deviceManager is auto-rendered by the existing rAF loop,
//      no manual registration or second loop needed. Context is set
//      synchronously in the constructor since the device already exists
//      (GPURenderer.mjs:84). `autoResize: false` because we pass our own canvas
//      (d.ts:43 advice) and drive resize from engine.onResize.
//   2. `GPUCameraRenderer` default camera: fov 50, position (0,0,10), near .1
//      (see CarouselScene.js header). Plane sits at z=0, so world half-height at
//      that depth = camZ * tan(fov/2); half-width = that * aspect. Computed live
//      from renderer.camera + renderer.boundingRect (not magic numbers).
//   3. Image texture: `MediaTexture.loadImage(url)` (async, MediaTexture.mjs:319)
//      → sourcesTypes "image" → binds as `texture_2d<f32>` (textureSample, not
//      the video-only external path). `onSourceLoaded(cb)` (MediaTexture.mjs:582)
//      is a single-callback setter that fires per source load with the loaded
//      ImageBitmap (has .width/.height) — registered ONCE, refires on each
//      loadImage. Texture/sampler `name`s ('revealTexture'/'revealSampler') are
//      the WGSL binding names the shader references.
//   4. `mesh.position/scale` are Vec3 with `.set(x,y,z)` wired to dirty the model
//      matrix (Object3D.mjs). PlaneGeometry is -1..1 (2 units) → scale is HALF
//      the desired world size (CarouselScene header note #1).
import { GPUCameraRenderer, Mesh, PlaneGeometry, MediaTexture, Sampler } from 'gpu-curtains';
import { REVEAL_VERTEX, REVEAL_FRAGMENT } from '../archive/shaders/reveal.wgsl.js';
import { pointerToNdc, followStep, revealPlaneScale } from '../archive/revealMath.js';

const DEFAULTS = {
	planeW: 3.2, // world units at z=0; tuned in the debug panel (Task 7)
	planeH: 2.0,
	followRate: 14,
	feather: 0.15,
	distortion: 0.03,
	chroma: 0.006,
	revealRate: 10
};

export class ArchiveRevealScene {
	constructor({ engine, canvas, params = {} }) {
		this.engine = engine;
		this.p = { ...DEFAULTS, ...params };
		this.destroyed = false;
		this.active = false;
		this.reveal = 0; // eased mask growth
		this.target = { x: 0, y: 0 }; // NDC target from cursor
		this.pos = { x: 0, y: 0 }; // NDC eased position
		this.time = 0;
		this._currentUrl = null;
		this._lastFrame = null;

		// Second renderer sharing the engine's device (see header #1).
		this.renderer = new GPUCameraRenderer({
			deviceManager: engine.curtains.deviceManager,
			container: canvas,
			label: 'archiveReveal',
			autoResize: false,
			context: { alphaMode: 'premultiplied' }
		});

		this.sampler = new Sampler(this.renderer, {
			label: 'archive-reveal-sampler',
			name: 'revealSampler',
			magFilter: 'linear',
			minFilter: 'linear'
		});

		this.texture = new MediaTexture(this.renderer, {
			label: 'archive-reveal-texture',
			name: 'revealTexture'
		});

		// Register once; refires on each loadImage with the loaded ImageBitmap.
		this.texture.onSourceLoaded((source) => {
			if (this.destroyed) return;
			const iw = source?.width || source?.naturalWidth || 1;
			const ih = source?.height || source?.naturalHeight || 1;
			const { sx, sy } = revealPlaneScale({
				imgW: iw,
				imgH: ih,
				planeW: this.p.planeW,
				planeH: this.p.planeH
			});
			this.mesh.uniforms.params.uvScale.value = [sx, sy];
		});

		this.mesh = new Mesh(this.renderer, {
			label: 'archive-reveal-plane',
			geometry: new PlaneGeometry(),
			transparent: true,
			shaders: {
				vertex: { code: REVEAL_VERTEX },
				fragment: { code: REVEAL_FRAGMENT }
			},
			textures: [this.texture],
			samplers: [this.sampler],
			uniforms: {
				params: {
					struct: {
						uvScale: { type: 'vec2f', value: [1, 1] },
						reveal: { type: 'f32', value: 0 },
						feather: { type: 'f32', value: this.p.feather },
						distortion: { type: 'f32', value: this.p.distortion },
						chroma: { type: 'f32', value: this.p.chroma },
						time: { type: 'f32', value: 0 }
					}
				}
			}
		});
		// PlaneGeometry is -1..1 (2 units); scale so on-screen size = planeW/H.
		this.mesh.scale.set(this.p.planeW / 2, this.p.planeH / 2, 1);
		this.mesh.visible = false;

		this._unframe = engine.onFrame(() => this._tick());
		// autoResize:false, so keep the second renderer's drawing buffer in sync
		// with its (viewport-sized) canvas off the engine's resize fan-out.
		this._unresize = engine.onResize(() => {
			if (!this.destroyed) this.renderer.resize();
		});
	}

	setImage(url) {
		if (!url || this.destroyed || url === this._currentUrl) return;
		this._currentUrl = url;
		this.texture.loadImage(url);
	}

	setPointer(clientX, clientY) {
		if (this.destroyed) return;
		// boundingRect is CSS px (same space as clientX/Y), unlike getCanvasSize
		// which is device px — see CarouselScene projectVideoRect note.
		const rect = this.renderer.boundingRect;
		const w = rect?.width || 1;
		const h = rect?.height || 1;
		const { ndcX, ndcY } = pointerToNdc(clientX, clientY, w, h);
		this.target.x = ndcX;
		this.target.y = ndcY;
	}

	setActive(v) {
		this.active = v;
	}

	_tick() {
		if (this.destroyed) return;
		const now = performance.now();
		const dt = Math.min((now - (this._lastFrame ?? now)) / 1000, 0.033);
		this._lastFrame = now;
		this.time += dt;

		this.reveal = followStep(this.reveal, this.active ? 1 : 0, this.p.revealRate, dt);
		this.pos.x = followStep(this.pos.x, this.target.x, this.p.followRate, dt);
		this.pos.y = followStep(this.pos.y, this.target.y, this.p.followRate, dt);

		// Skip all GPU-facing work while fully hidden (reveal ~0). The shader also
		// discards at reveal 0, but hiding the mesh avoids a pointless draw.
		const visible = this.reveal > 0.001;
		this.mesh.visible = visible;
		if (!visible) return;

		// NDC → world at the plane's depth (z=0), from the live camera frustum.
		const camera = this.renderer.camera;
		const rect = this.renderer.boundingRect;
		const aspect = rect?.height > 0 ? rect.width / rect.height : 1;
		const camZ = camera?.position?.z ?? 10;
		const halfH = camZ * Math.tan(((camera?.fov ?? 50) * Math.PI) / 360);
		const halfW = halfH * aspect;
		this.mesh.position.set(this.pos.x * halfW, this.pos.y * halfH, 0);

		const u = this.mesh.uniforms.params;
		u.reveal.value = this.reveal;
		u.time.value = this.time;
	}

	destroy() {
		this.destroyed = true;
		this._unframe?.();
		this._unresize?.();
		this.mesh?.remove?.();
		this.texture?.destroy?.();
		this.renderer?.destroy?.();
	}
}
