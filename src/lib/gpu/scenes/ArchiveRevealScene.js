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
		// Named `params` (not `p`) so the debug panel's createLiveProxy — which
		// reads/writes `scene.params` — can bind these live (Task 7).
		this.params = { ...DEFAULTS, ...params };
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
		this._imgW = 1;
		this._imgH = 1;
		this.texture.onSourceLoaded((source) => {
			if (this.destroyed) return;
			this._imgW = source?.width || source?.naturalWidth || 1;
			this._imgH = source?.height || source?.naturalHeight || 1;
			const { sx, sy } = revealPlaneScale({
				imgW: this._imgW,
				imgH: this._imgH,
				planeW: this.params.planeW,
				planeH: this.params.planeH
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
						feather: { type: 'f32', value: this.params.feather },
						distortion: { type: 'f32', value: this.params.distortion },
						chroma: { type: 'f32', value: this.params.chroma },
						time: { type: 'f32', value: 0 }
					}
				}
			}
		});
		// PlaneGeometry is -1..1 (2 units); scale so on-screen size = planeW/H.
		this.mesh.scale.set(this.params.planeW / 2, this.params.planeH / 2, 1);
		this.mesh.visible = false;

		this._unframe = engine.onFrame(() => this._tick());
		// autoResize:false, so keep the second renderer's drawing buffer in sync
		// with its (viewport-sized) canvas off the engine's resize fan-out.
		this._unresize = engine.onResize(() => {
			if (!this.destroyed) this.renderer.resize();
		});

		// DEV-only GPU readback probe. The WebGPU canvas cannot be screenshotted
		// from a page-level probe (documented repo-wide) and, in a hidden tab, the
		// render loop is suspended — so pixel truth is only reachable GPU-side.
		// This reads back the LOADED IMAGE texture (MediaTexture's default usage
		// includes COPY_SRC — gpu-curtains textures/utils.mjs) to assert the image
		// pipeline is non-empty on the GPU, and reports the live reveal state
		// (active/reveal/position/uvScale) so automated checks can assert the
		// reveal responds without a compositor screenshot. The shader that samples
		// this texture through the mask is separately compile-gated.
		if (import.meta.env.DEV) {
			this._qaFn = () => this._qa();
			window.__archiveQA = this._qaFn;
		}
	}

	async _qa() {
		const state = {
			active: this.active,
			reveal: Number(this.reveal.toFixed(4)),
			meshVisible: this.mesh?.visible ?? false,
			position: { x: Number(this.pos.x.toFixed(4)), y: Number(this.pos.y.toFixed(4)) },
			uvScale: this.mesh?.uniforms?.params?.uvScale?.value ?? null,
			currentUrl: this._currentUrl
		};
		const gpuTexture = this.texture?.texture;
		const size = this.texture?.size;
		if (!gpuTexture || !size?.width || !this.texture?.sources?.[0]?.sourceLoaded) {
			return { ...state, imageLoaded: false };
		}

		const device = this.engine.device;
		// Read back a small centered region — enough to prove non-empty upload,
		// cheap on bandwidth. 64*4 = 256 bytes/row, already 256-aligned.
		const w = Math.min(64, size.width);
		const h = Math.min(64, size.height);
		const bytesPerRow = Math.ceil((w * 4) / 256) * 256;
		const buffer = device.createBuffer({
			size: bytesPerRow * h,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});
		const encoder = device.createCommandEncoder();
		encoder.copyTextureToBuffer(
			{
				texture: gpuTexture,
				mipLevel: 0,
				origin: {
					x: Math.floor((size.width - w) / 2),
					y: Math.floor((size.height - h) / 2),
					z: 0
				}
			},
			{ buffer, bytesPerRow, rowsPerImage: h },
			{ width: w, height: h, depthOrArrayLayers: 1 }
		);
		device.queue.submit([encoder.finish()]);
		await buffer.mapAsync(GPUMapMode.READ);
		const bytes = new Uint8Array(buffer.getMappedRange());
		let sum = 0;
		let nonZero = 0;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = y * bytesPerRow + x * 4;
				const luma = (bytes[i] + bytes[i + 1] + bytes[i + 2]) / 3;
				sum += luma;
				if (luma > 0) nonZero++;
			}
		}
		buffer.unmap();
		buffer.destroy();
		const count = w * h;
		return {
			...state,
			imageLoaded: true,
			imageSize: { width: size.width, height: size.height },
			imageNonEmpty: nonZero > 0,
			imageNonZeroFraction: Number((nonZero / count).toFixed(3)),
			imageMeanLuma: Number((sum / count).toFixed(2))
		};
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

		this.reveal = followStep(this.reveal, this.active ? 1 : 0, this.params.revealRate, dt);
		this.pos.x = followStep(this.pos.x, this.target.x, this.params.followRate, dt);
		this.pos.y = followStep(this.pos.y, this.target.y, this.params.followRate, dt);

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

		// Re-apply the tunable params every frame from this.params so the debug
		// panel's sliders stay live (same discipline as CarouselScene.layout()).
		// planeW/H also recompute the cover-fit uvScale off the last image size.
		const p = this.params;
		this.mesh.scale.set(p.planeW / 2, p.planeH / 2, 1);
		const { sx, sy } = revealPlaneScale({
			imgW: this._imgW,
			imgH: this._imgH,
			planeW: p.planeW,
			planeH: p.planeH
		});
		const u = this.mesh.uniforms.params;
		u.uvScale.value = [sx, sy];
		u.feather.value = p.feather;
		u.distortion.value = p.distortion;
		u.chroma.value = p.chroma;
		u.reveal.value = this.reveal;
		u.time.value = this.time;
	}

	destroy() {
		this.destroyed = true;
		if (import.meta.env.DEV && window.__archiveQA === this._qaFn) delete window.__archiveQA;
		this._unframe?.();
		this._unresize?.();
		this.mesh?.remove?.();
		this.texture?.destroy?.();
		this.renderer?.destroy?.();
	}
}
