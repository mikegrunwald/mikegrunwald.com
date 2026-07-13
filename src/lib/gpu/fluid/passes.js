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

// A pass = one pipeline (shared fullscreen-triangle vertex + given fragment),
// one uniform buffer, N sampled textures. Bind group built per run because
// ping-pong textures change between runs.
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

	// samplerTypes: array like ['linear','nearest'] mapped to bindings after textures
	const samplers = (samplerTypes ?? []).map((type) =>
		device.createSampler({
			magFilter: type === 'linear' ? 'linear' : 'nearest',
			minFilter: type === 'linear' ? 'linear' : 'nearest',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge'
		})
	);

	return { pipeline, uniformBuffer, samplers, textureCount, label };
}

export function runPass(device, encoder, pass, { target, uniforms, textureViews, loadOp }) {
	if (uniforms) device.queue.writeBuffer(pass.uniformBuffer, 0, uniforms);

	const entries = [{ binding: 0, resource: { buffer: pass.uniformBuffer } }];
	let binding = 1;
	for (const view of textureViews ?? []) entries.push({ binding: binding++, resource: view });
	for (const sampler of pass.samplers) entries.push({ binding: binding++, resource: sampler });

	// WGSL bindings not statically reachable from the entry points are stripped
	// by layout: 'auto', which makes createBindGroup throw an entry-count
	// mismatch. Every declared texture/sampler in a pass's shader must be
	// referenced in code (runtime-false branches are fine — reachability is
	// static, not dynamic).
	const bindGroup = device.createBindGroup({
		layout: pass.pipeline.getBindGroupLayout(0),
		entries
	});

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
