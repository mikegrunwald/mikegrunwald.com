import { VERTEX_WGSL } from './shaders/common.wgsl.js';

export function createTarget(device, w, h, format, label) {
	const texture = device.createTexture({
		label,
		size: { width: w, height: h },
		format,
		usage:
			GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
	});
	return {
		texture,
		view: texture.createView(),
		width: w,
		height: h,
		texelSizeX: 1.0 / w,
		texelSizeY: 1.0 / h,
		destroy: () => texture.destroy()
	};
}

export function createDoubleTarget(device, w, h, format, label) {
	let a = createTarget(device, w, h, format, `${label}-a`);
	let b = createTarget(device, w, h, format, `${label}-b`);
	return {
		width: w,
		height: h,
		texelSizeX: a.texelSizeX,
		texelSizeY: a.texelSizeY,
		get read() {
			return a;
		},
		get write() {
			return b;
		},
		swap() {
			const t = a;
			a = b;
			b = t;
		},
		destroy() {
			a.destroy();
			b.destroy();
		}
	};
}

// --- Bind group caching ---------------------------------------------------
// runPass() used to call device.createBindGroup() on every invocation (~67
// per frame at steady state, 4000+/sec) — a named WebGPU/Dawn anti-pattern
// implicated in GPU-process memory growth under sustained per-frame churn
// (see .superpowers/sdd/particle-optimization-research.md hypothesis #1).
// Bind groups are now cached per pass, keyed on the identity of the
// resources that determine their contents. The uniform buffer and sampler
// set are constant per pass (only their *contents*/config change), so the
// only thing that varies call-to-call is which texture views are bound —
// ping-pong passes alternate between two stable textures, so caching on
// view identity naturally settles at ~2 entries per ping-pong pass and 1
// per static pass.
const viewIds = new WeakMap();
let nextViewId = 1;

function getViewId(view) {
	let id = viewIds.get(view);
	if (id === undefined) {
		id = nextViewId++;
		viewIds.set(view, id);
	}
	return id;
}

// Pure key derivation, split out so the cache decision is unit-testable
// without a real GPUDevice/GPUTextureView: same views (by identity) => same
// key; any view swapped for a different object => different key.
export function getBindGroupCacheKey(textureViews) {
	if (!textureViews || textureViews.length === 0) return '';
	let key = '';
	for (const view of textureViews) key += getViewId(view) + ',';
	return key;
}

const stats = { created: 0, reused: 0 };

// Dev-only visibility into cache effectiveness — read from a debug panel or
// console to confirm `created` stabilizes (steady-state cache population)
// while `reused` climbs (per-frame calls now hitting the cache).
export function getBindGroupStats() {
	return { ...stats };
}

// resize() destroys and recreates render targets, which produces brand-new
// GPUTextureView objects (new identities) — those naturally get fresh cache
// keys on next use, and stale entries referencing destroyed views are never
// looked up again, so this isn't required for correctness. It's called
// anyway to keep each pass's cache bounded to the current resize's targets
// instead of accumulating an entry per prior resize.
export function clearPassCaches(passes) {
	for (const pass of Object.values(passes)) pass.bindGroupCache?.clear();
}

// A pass = one pipeline (shared fullscreen-triangle vertex + given fragment),
// one uniform buffer, N sampled textures. Bind groups are cached per unique
// textureViews combination (see above) — ping-pong textures change between
// runs, but only ever alternate between two stable identities.
export function createPass(
	device,
	{ label, fragment, uniformSize, textureCount, samplerTypes, blend, targetFormat }
) {
	const module = device.createShaderModule({
		label,
		code: fragment + VERTEX_WGSL
	});
	const pipeline = device.createRenderPipeline({
		label,
		layout: 'auto',
		vertex: { module, entryPoint: 'vsMain' },
		fragment: {
			module,
			entryPoint: 'fsMain',
			targets: [{ format: targetFormat, ...(blend ? { blend } : {}) }]
		},
		primitive: { topology: 'triangle-list' }
	});

	const uniformBuffer = device.createBuffer({
		label: `${label}-uniforms`,
		size: Math.max(uniformSize, 16),
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	// samplerTypes: array of entries mapped to bindings after textures. Each entry
	// is either a bare string ('linear'/'nearest', clamp-to-edge address — original
	// shape, kept working) or an { type, address } object to override the address
	// mode (e.g. the display pass's repeat-mode dithering sampler).
	const samplers = (samplerTypes ?? []).map((entry) => {
		const { type, address } =
			typeof entry === 'string'
				? { type: entry, address: 'clamp-to-edge' }
				: { address: 'clamp-to-edge', ...entry };
		return device.createSampler({
			magFilter: type === 'linear' ? 'linear' : 'nearest',
			minFilter: type === 'linear' ? 'linear' : 'nearest',
			addressModeU: address,
			addressModeV: address
		});
	});

	return { pipeline, uniformBuffer, samplers, textureCount, label, bindGroupCache: new Map() };
}

export function runPass(device, encoder, pass, { target, uniforms, textureViews, loadOp }) {
	if (uniforms) device.queue.writeBuffer(pass.uniformBuffer, 0, uniforms);

	const cacheKey = getBindGroupCacheKey(textureViews);
	let bindGroup = pass.bindGroupCache.get(cacheKey);
	if (bindGroup) {
		stats.reused++;
	} else {
		const entries = [{ binding: 0, resource: { buffer: pass.uniformBuffer } }];
		let binding = 1;
		for (const view of textureViews ?? []) entries.push({ binding: binding++, resource: view });
		for (const sampler of pass.samplers) entries.push({ binding: binding++, resource: sampler });

		// WGSL bindings not statically reachable from the entry points are stripped
		// by layout: 'auto', which makes createBindGroup throw an entry-count
		// mismatch. Every declared texture/sampler in a pass's shader must be
		// referenced in code (runtime-false branches are fine — reachability is
		// static, not dynamic).
		bindGroup = device.createBindGroup({
			layout: pass.pipeline.getBindGroupLayout(0),
			entries
		});
		pass.bindGroupCache.set(cacheKey, bindGroup);
		stats.created++;
	}

	const renderPass = encoder.beginRenderPass({
		label: pass.label,
		colorAttachments: [
			{
				view: target.view,
				loadOp: loadOp ?? 'load',
				storeOp: 'store',
				clearValue: { r: 0, g: 0, b: 0, a: 0 }
			}
		]
	});
	renderPass.setPipeline(pass.pipeline);
	renderPass.setBindGroup(0, bindGroup);
	renderPass.draw(3);
	renderPass.end();
}
