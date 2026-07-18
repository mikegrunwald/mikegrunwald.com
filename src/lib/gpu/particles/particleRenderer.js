// Unprojected particle renderer. Draws instanced soft-sprite quads straight to
// clip space from logo-local particle positions — NO camera, NO gpu-curtains
// projected mesh, NO DOM-sync matrix (the pane-invisible, hang-suspect path).
// Mirrors the fluid's hand-rolled render style (src/lib/gpu/fluid/passes.js):
// simple, observable, pane-testable, one manually-encoded render pass into an
// owned offscreen texture.
import {
	PARTICLES_RENDER_VERTEX,
	PARTICLES_RENDER_FRAGMENT
} from './shaders/particlesRender.wgsl.js';

// See the field layout documented in shaders/particlesRender.wgsl.js's header
// comment (rect/canvas/size/opacity/time/shimmer*/glintGain/tilt/tiltDepth).
// 96 B comfortably covers the WGSL struct's own std140-style aligned size
// (80 B, vec4f-aligned) — a uniform buffer only needs to be >= the struct
// size, so the extra slack is harmless.
export const PARTICLE_RENDER_UNIFORM_SIZE = 96;

function finite(...vals) {
	for (const v of vals) if (!Number.isFinite(v)) return false;
	return true;
}

// Pure, TDD'd: maps a logo-local point (px,py in [0,1], top-left origin)
// through a hero rect (CSS px) and canvas size (CSS px) to NDC (y up).
// `ok: false` on any non-finite input or a degenerate (<=0) rect/canvas —
// callers must treat that as "do not render" rather than trust x/y.
export function logoLocalToNdc({ px, py, rect, canvas }) {
	if (
		!finite(px, py, rect.left, rect.top, rect.width, rect.height, canvas.width, canvas.height) ||
		rect.width <= 0 ||
		rect.height <= 0 ||
		canvas.width <= 0 ||
		canvas.height <= 0
	) {
		return { x: 0, y: 0, ok: false };
	}
	const sx = (rect.left + px * rect.width) / canvas.width;
	const sy = (rect.top + py * rect.height) / canvas.height;
	return { x: sx * 2 - 1, y: 1 - sy * 2, ok: true };
}

const PREMULTIPLIED_BLEND = {
	color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
	alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

// createParticleRenderer(device, { format }) -> { resize, outputView,
// outputTexture, render(encoder, { renderBinding, uniformBytes, count }), destroy }.
// Draws ONE unprojected instanced pass (draw(6, count): two-triangle quad per
// instance, no index buffer) into an owned offscreen render target — the same
// shape as the fluid's passes.js targets (RENDER_ATTACHMENT | TEXTURE_BINDING
// | COPY_SRC, so the caller can copyTextureToBuffer it for readback/compositing).
export function createParticleRenderer(device, { format = 'rgba16float' } = {}) {
	const module = device.createShaderModule({
		label: 'particles-render',
		code: PARTICLES_RENDER_VERTEX + PARTICLES_RENDER_FRAGMENT
	});
	const pipeline = device.createRenderPipeline({
		label: 'particles-render',
		layout: 'auto',
		vertex: { module, entryPoint: 'vsMain' },
		fragment: {
			module,
			entryPoint: 'fsMain',
			targets: [{ format, blend: PREMULTIPLIED_BLEND }]
		},
		primitive: { topology: 'triangle-list' }
	});
	const uniformBuffer = device.createBuffer({
		label: 'particles-render-uniforms',
		size: PARTICLE_RENDER_UNIFORM_SIZE,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	let target = null;
	let view = null;
	// Bind group built once, cached — mirrors passes.js's per-pass cache
	// (see ae3d4a6): the particle GPUBuffer identity never changes for the
	// life of a scene (one allocation at construction, see
	// LogoParticlesScene.js [VERIFY-API #6]), and the uniform buffer here is
	// a stable per-renderer resource, so a single rebuild-on-identity-change
	// check is sufficient — no per-frame createBindGroup call.
	let bindGroup = null;
	let boundGpuBuffer = null;

	function resize(w, h) {
		target?.destroy();
		target = device.createTexture({
			label: 'particles-output',
			size: { width: Math.max(1, w | 0), height: Math.max(1, h | 0) },
			format,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_SRC
		});
		view = target.createView();
	}

	// render(encoder, { renderBinding, uniformBytes, count }): renderBinding is
	// the shared-buffer gpu-curtains BufferBinding (see LogoParticlesScene.js
	// [VERIFY-API #6]/particlesRenderBinding) — `.buffer.GPUBuffer` is the
	// documented accessor onto the underlying native GPUBuffer resource
	// (BufferBinding.mjs constructs `this.buffer = options.buffer ?? new
	// Buffer()`, and every internal consumer, e.g. line 198 of BufferBinding.mjs,
	// reads `this.buffer.GPUBuffer` as the bindGroup resource — confirmed
	// against node_modules/gpu-curtains/dist/esm/core/bindings/BufferBinding.mjs).
	// `count` is the live instance count (particle count) — passed explicitly
	// by the caller rather than derived from uniformBytes.
	function render(encoder, { renderBinding, uniformBytes, count }) {
		if (!target) return;
		device.queue.writeBuffer(uniformBuffer, 0, uniformBytes);
		const particleGpuBuffer = renderBinding.buffer.GPUBuffer;
		if (particleGpuBuffer !== boundGpuBuffer) {
			bindGroup = device.createBindGroup({
				layout: pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: uniformBuffer } },
					{ binding: 1, resource: { buffer: particleGpuBuffer } }
				]
			});
			boundGpuBuffer = particleGpuBuffer;
		}
		const pass = encoder.beginRenderPass({
			label: 'particles-render',
			colorAttachments: [
				{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }
			]
		});
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.draw(6, count);
		pass.end();
	}

	return {
		resize,
		render,
		get outputView() {
			return view;
		},
		get outputTexture() {
			return target;
		},
		destroy() {
			target?.destroy();
			uniformBuffer.destroy();
		}
	};
}
