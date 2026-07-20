import { FullscreenPlane, Texture } from 'gpu-curtains';
import { FluidSimulation } from '../fluid/FluidSimulation.js';
import { FLUID_CONFIG } from '../fluid/fluidConfig.js';
import { gradingFromProgress } from '../fluid/grading.js';
import { mulberry32 } from '../utils/rng.js';

// TEXTURE BRIDGE [VERIFY-API resolved] — zero-copy, not a per-frame GPU copy.
//
// gpu-curtains' Texture#copyGPUTexture(gpuTexture) (confirmed by reading
// node_modules/gpu-curtains/dist/esm/core/textures/Texture.mjs +
// core/bindings/TextureBinding.mjs) re-points the wrapper's internal `.texture`
// reference directly at the given native GPUTexture and flips
// TextureBinding#shouldResetBindGroup, which makes gpu-curtains rebuild the
// FullscreenPlane's bind group (and thus its `texture.createView()`) next render.
// No pixel data is copied — the FullscreenPlane ends up sampling the exact
// GPUTexture memory FluidSimulation.render() just wrote into.
//
// `sim.output` (unlike the ping-ponging dye/velocity targets) is a single
// non-swapping target — the same GPUTexture object persists across frames and is
// only replaced by `sim.resize()`. So this bridge only needs to run once at
// construction and once per resize, NOT every frame (contrast with Task 7's debug
// bridge, which had to call copyGPUTexture every frame because it aliased the
// ping-ponging `dye.read` texture, whose identity flips each step).
//
// Fallback (not needed here, rendering into a gpu-curtains-owned texture works
// via this aliasing) would have been `encoder.copyTextureToTexture(...)` per frame.

// gpu-curtains' own default FullscreenPlane shaders (see FullscreenPlane.mjs
// doc comment) use `struct VSOutput { @builtin(position) position: vec4f,
// @location(0) uv: vec2f }`, entry point `main`, and the default sampler is
// named `defaultSampler` (only bound if its name appears in the shader code
// string — Material.mjs `setSamplers()`/`addSampler()`). This exact pattern was
// already proven working by Task 7's debug bridge.
const PASSTHROUGH_FRAG = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@fragment fn main(fsInput: VSOutput) -> @location(0) vec4f {
  return textureSample(fluidTexture, defaultSampler, fsInput.uv);
}
`;

// gpu-curtains' `transparent: true` default blend is
// (srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha') — straight-alpha
// blending (confirmed via RenderPipelineEntry.getDefaultTransparentBlending()
// in node_modules/gpu-curtains/dist/esm/core/pipelines/RenderPipelineEntry.mjs).
// The display shader outputs PREMULTIPLIED color (`graded*gradingAlpha`,
// `outAlpha`), so we override with an explicit premultiplied blend
// (ONE / one-minus-src-alpha on both channels) via `targets`.
const PREMULTIPLIED_BLEND = {
	color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
	alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

export class FluidScene {
	constructor({ engine, seed = Date.now() }) {
		this.engine = engine;
		this.params = { ...FLUID_CONFIG }; // live object shared with tweak panel
		this.progress = 0;
		this.grading = gradingFromProgress(0);
		this.destroyed = false;

		this.sim = new FluidSimulation({
			device: engine.device,
			queue: engine.queue,
			getCanvasSize: engine.getCanvasSize,
			config: this.params,
			rng: mulberry32(seed)
		});

		for (const p of engine.input.pointers) p.color = this.sim.generateColor();

		const renderer = engine.curtains.renderer;
		const { width, height } = engine.getCanvasSize();

		// fixedSize disables gpu-curtains' automatic per-canvas-resize handling for
		// this texture (Texture#resize() is a no-op when fixedSize was given —
		// see Texture.mjs `#autoResize`). Without this, `renderer.resize()` would
		// try to auto-recreate/destroy this texture on every window resize using
		// its own bookkeeping, fighting the manual copyGPUTexture bridge below and
		// risking a destroy of the GPUTexture we've aliased onto sim.output.
		// autoDestroy: false — lifecycle of the *aliased* native GPUTexture is
		// owned by FluidSimulation (destroyed by sim.resize()/sim.destroy()), not
		// by this wrapper or the FullscreenPlane's material (same pattern as
		// Task 7's debug bridge).
		this.curtainsTexture = new Texture(renderer, {
			label: 'fluid-output',
			name: 'fluidTexture',
			format: 'rgba16float',
			fixedSize: { width, height },
			autoDestroy: false
		});
		// Drop the placeholder GPUTexture the constructor just allocated (it was
		// never rendered into) before aliasing onto the real sim output, so we
		// don't leak one native texture per FluidScene instantiation.
		this.curtainsTexture.texture?.destroy();
		this.curtainsTexture.copyGPUTexture(this.sim.output.texture);

		this.plane = new FullscreenPlane(renderer, {
			label: 'fluid-display',
			shaders: { fragment: { code: PASSTHROUGH_FRAG } },
			transparent: true,
			targets: [{ blend: PREMULTIPLIED_BLEND }],
			textures: [this.curtainsTexture]
		});

		// Subscribe to the engine's resize fan-out (Task 1 of Phase 2 converted
		// gpu-curtains' single-slot onAfterResize into engine.onResize) instead of
		// registering directly on renderer.onAfterResize, which is a single-
		// callback slot (last registration wins, not a Set — see GPURenderer.mjs)
		// that only the engine may own. Re-bridging happens in the SAME
		// synchronous tick as sim.resize() (which itself destroys the old output
		// texture and creates a new one) so there is never a frame where
		// curtainsTexture aliases an already-destroyed GPUTexture.
		this.unsubscribeResize = engine.onResize(() => this.resizeSim());

		this.lastTime = performance.now();
		this.unsubscribe = engine.onFrame(() => this.update());
	}

	// Owns the resize+rebridge invariant: after sim.resize() destroys the old
	// output texture and creates a new one, copyGPUTexture re-aliases the
	// gpu-curtains wrapper onto it. sim.resize() + copyGPUTexture must
	// always be called together, never separately.
	resizeSim() {
		if (this.destroyed) return;
		this.sim.resize();
		this.curtainsTexture.copyGPUTexture(this.sim.output.texture);
	}

	setProgress(p) {
		if (p === this.progress) return;
		this.progress = p;
		this.grading = gradingFromProgress(p);
	}

	update() {
		if (this.engine.hidden) return;
		const now = performance.now();
		const dt = Math.min((now - this.lastTime) / 1000, 0.016666); // WebGLFluid.js:1149-1155
		this.lastTime = now;

		const beforeTimer = this.sim.colorUpdateTimer;
		this.sim.updateColors(dt);
		if (this.sim.colorUpdateTimer < beforeTimer) {
			// timer wrapped → refresh pointer colors (WebGLFluid.js:1168-1180)
			for (const p of this.engine.input.pointers) p.color = this.sim.generateColor();
		}

		this.sim.applyPointers(this.engine.input.pointers);

		const encoder = this.engine.device.createCommandEncoder({ label: 'fluid-frame' });
		if (!this.params.PAUSED) this.sim.step(dt, encoder);
		this.sim.render(encoder, this.grading);
		this.engine.queue.submit([encoder.finish()]);
	}

	destroy() {
		this.destroyed = true;
		// Unsubscribe from the engine's resize fan-out (see constructor comment).
		this.unsubscribeResize();
		this.unsubscribe();
		this.plane.remove();
		this.sim.destroy();
	}
}
