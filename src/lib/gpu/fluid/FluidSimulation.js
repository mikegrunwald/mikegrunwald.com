import { FLUID_CONFIG, getResolution } from './fluidConfig.js';
import { createDoubleTarget, createTarget, createPass, runPass } from './passes.js';
import {
	SPLAT_FRAG,
	CURL_FRAG,
	VORTICITY_FRAG,
	DIVERGENCE_FRAG,
	CLEAR_FRAG,
	PRESSURE_FRAG,
	GRADIENT_SUBTRACT_FRAG,
	ADVECTION_FRAG,
	COPY_FRAG
} from './shaders/sim.wgsl.js';
import {
	BLOOM_PREFILTER_FRAG,
	BLOOM_BLUR_FRAG,
	BLOOM_FINAL_FRAG,
	SUNRAYS_MASK_FRAG,
	SUNRAYS_FRAG,
	BLUR_FRAG
} from './shaders/post.wgsl.js';

export class FluidSimulation {
	constructor({ device, queue, getCanvasSize, config = { ...FLUID_CONFIG }, rng = Math.random }) {
		this.device = device;
		this.queue = queue;
		this.getCanvasSize = getCanvasSize;
		this.config = config;
		this.rng = rng;
		this.splatQueue = []; // pending {x,y,dx,dy,color} applied at next step
		this.colorUpdateTimer = 0;

		this.passes = {
			splat: createPass(device, {
				label: 'splat',
				fragment: SPLAT_FRAG,
				uniformSize: 48,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float' // reused for rg16float via second pass, see below
			}),
			splatVelocity: createPass(device, {
				label: 'splat-velocity',
				fragment: SPLAT_FRAG,
				uniformSize: 48,
				samplerTypes: ['linear'],
				targetFormat: 'rg16float'
			}),
			curl: createPass(device, {
				label: 'curl',
				fragment: CURL_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'r16float'
			}),
			vorticity: createPass(device, {
				label: 'vorticity',
				fragment: VORTICITY_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear', 'nearest'],
				targetFormat: 'rg16float'
			}),
			divergence: createPass(device, {
				label: 'divergence',
				fragment: DIVERGENCE_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'r16float'
			}),
			clear: createPass(device, {
				label: 'clear',
				fragment: CLEAR_FRAG,
				uniformSize: 16,
				samplerTypes: ['nearest'],
				targetFormat: 'r16float'
			}),
			pressure: createPass(device, {
				label: 'pressure',
				fragment: PRESSURE_FRAG,
				uniformSize: 16,
				samplerTypes: ['nearest'],
				targetFormat: 'r16float'
			}),
			gradientSubtract: createPass(device, {
				label: 'gradient-subtract',
				fragment: GRADIENT_SUBTRACT_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear', 'nearest'],
				targetFormat: 'rg16float'
			}),
			advectVelocity: createPass(device, {
				label: 'advect-velocity',
				fragment: ADVECTION_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rg16float'
			}),
			advectDye: createPass(device, {
				label: 'advect-dye',
				fragment: ADVECTION_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float'
			}),
			bloomPrefilter: createPass(device, {
				label: 'bloom-prefilter',
				fragment: BLOOM_PREFILTER_FRAG,
				uniformSize: 48,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float'
			}),
			bloomBlur: createPass(device, {
				label: 'bloom-blur',
				fragment: BLOOM_BLUR_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float'
			}),
			bloomBlurAdditive: createPass(device, {
				label: 'bloom-blur-additive',
				fragment: BLOOM_BLUR_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float',
				blend: {
					color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
					alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
				}
			}),
			bloomFinal: createPass(device, {
				label: 'bloom-final',
				fragment: BLOOM_FINAL_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float'
			}),
			sunraysMask: createPass(device, {
				label: 'sunrays-mask',
				fragment: SUNRAYS_MASK_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'rgba16float'
			}),
			sunrays: createPass(device, {
				label: 'sunrays',
				fragment: SUNRAYS_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'r16float'
			}),
			blur: createPass(device, {
				label: 'blur',
				fragment: BLUR_FRAG,
				uniformSize: 16,
				samplerTypes: ['linear'],
				targetFormat: 'r16float'
			})
		};

		this.resize();
	}

	resize() {
		const { width, height } = this.getCanvasSize();
		if (!width || !height) return;
		const simRes = getResolution(this.config.SIM_RESOLUTION, width, height);
		const dyeRes = getResolution(this.config.DYE_RESOLUTION, width, height);

		// (Resize-preserving copy like resizeDoubleFBO is a follow-up; recreate for now —
		// original also fully re-inits sim targets other than dye/velocity.)
		this.dye?.destroy();
		this.velocity?.destroy();
		this.divergence?.destroy();
		this.curl?.destroy();
		this.pressure?.destroy();

		this.dye = createDoubleTarget(this.device, dyeRes.width, dyeRes.height, 'rgba16float', 'dye');
		this.velocity = createDoubleTarget(
			this.device,
			simRes.width,
			simRes.height,
			'rg16float',
			'velocity'
		);
		this.divergence = createTarget(
			this.device,
			simRes.width,
			simRes.height,
			'r16float',
			'divergence'
		);
		this.curl = createTarget(this.device, simRes.width, simRes.height, 'r16float', 'curl');
		this.pressure = createDoubleTarget(
			this.device,
			simRes.width,
			simRes.height,
			'r16float',
			'pressure'
		);

		this.bloom?.destroy();
		this.bloomLevels?.forEach((t) => t.destroy());
		this.sunrays?.destroy();
		this.sunraysTemp?.destroy();

		const bloomRes = getResolution(this.config.BLOOM_RESOLUTION, width, height);
		this.bloom = createTarget(this.device, bloomRes.width, bloomRes.height, 'rgba16float', 'bloom');
		this.bloomLevels = [];
		for (let i = 0; i < this.config.BLOOM_ITERATIONS; i++) {
			const w = bloomRes.width >> (i + 1);
			const h = bloomRes.height >> (i + 1);
			if (w < 2 || h < 2) break;
			this.bloomLevels.push(createTarget(this.device, w, h, 'rgba16float', `bloom-${i}`));
		}

		const sunraysRes = getResolution(this.config.SUNRAYS_RESOLUTION, width, height);
		this.sunrays = createTarget(
			this.device,
			sunraysRes.width,
			sunraysRes.height,
			'r16float',
			'sunrays'
		);
		this.sunraysTemp = createTarget(
			this.device,
			sunraysRes.width,
			sunraysRes.height,
			'r16float',
			'sunrays-temp'
		);
	}

	get dyeTexture() {
		return this.dye.read;
	}

	get bloomTexture() {
		return this.bloom;
	}

	get sunraysTexture() {
		return this.sunrays;
	}

	generateColor() {
		// Production override (WebGLFluid.js:1578-1584): constant PRIMARY_RGB
		return { ...this.config.PRIMARY_RGB };
	}

	updateColors(dt) {
		if (!this.config.COLORFUL) return;
		this.colorUpdateTimer += dt * this.config.COLOR_UPDATE_SPEED;
		if (this.colorUpdateTimer >= 1) {
			this.colorUpdateTimer = this.colorUpdateTimer % 1;
			// pointer colors refreshed by caller (FluidScene) via generateColor()
		}
	}

	correctRadius(radius) {
		const { width, height } = this.getCanvasSize();
		const aspectRatio = width / height;
		return aspectRatio > 1 ? radius * aspectRatio : radius;
	}

	splat(x, y, dx, dy, color) {
		this.splatQueue.push({ x, y, dx, dy, color });
	}

	multipleSplats(amount) {
		for (let i = 0; i < amount; i++) {
			const color = this.generateColor();
			color.r *= 10.0;
			color.g *= 10.0;
			color.b *= 10.0;
			const x = this.rng();
			const y = this.rng();
			const dx = 1000 * (this.rng() - 0.5);
			const dy = 1000 * (this.rng() - 0.5);
			this.splat(x, y, dx, dy, color);
		}
	}

	applyPointers(pointers) {
		for (const p of pointers) {
			if (p.moved) {
				p.moved = false;
				const dx = p.deltaX * this.config.SPLAT_FORCE;
				const dy = p.deltaY * this.config.SPLAT_FORCE;
				this.splat(p.texcoordX, p.texcoordY, dx, dy, p.color);
			}
		}
	}

	encodeSplat(encoder, { x, y, dx, dy, color }) {
		const { width, height } = this.getCanvasSize();
		const aspectRatio = width / height;
		const radius = this.correctRadius(this.config.SPLAT_RADIUS / 100.0);

		// velocity splat: color = (dx, dy, 0)
		const u = new ArrayBuffer(48);
		const f = new Float32Array(u);
		f[0] = this.velocity.texelSizeX;
		f[1] = this.velocity.texelSizeY;
		f[2] = x;
		f[3] = y;
		f[4] = dx;
		f[5] = dy;
		f[6] = 0;
		f[7] = aspectRatio; // @28 — packs into color vec3f padding
		f[8] = radius; // @32
		runPass(this.device, encoder, this.passes.splatVelocity, {
			target: this.velocity.write,
			uniforms: u,
			textureViews: [this.velocity.read.view]
		});
		this.velocity.swap();

		// dye splat: color as-is (WebGLFluid.js:1441-1449)
		const u2 = new ArrayBuffer(48);
		const f2 = new Float32Array(u2);
		f2[0] = this.dye.texelSizeX;
		f2[1] = this.dye.texelSizeY;
		f2[2] = x;
		f2[3] = y;
		f2[4] = color.r;
		f2[5] = color.g;
		f2[6] = color.b;
		f2[7] = aspectRatio;
		f2[8] = radius;
		runPass(this.device, encoder, this.passes.splat, {
			target: this.dye.write,
			uniforms: u2,
			textureViews: [this.dye.read.view]
		});
		this.dye.swap();
	}

	// Port of step(dt) (WebGLFluid.js:1195-1265) — pass order preserved exactly.
	step(dt, encoder) {
		for (const s of this.splatQueue) this.encodeSplat(encoder, s);
		this.splatQueue.length = 0;

		const simTexel = new Float32Array([this.velocity.texelSizeX, this.velocity.texelSizeY]);

		// curl
		const uCurl = new ArrayBuffer(16);
		new Float32Array(uCurl).set(simTexel);
		runPass(this.device, encoder, this.passes.curl, {
			target: this.curl,
			uniforms: uCurl,
			textureViews: [this.velocity.read.view]
		});

		// vorticity
		const uVort = new ArrayBuffer(16);
		{
			const f = new Float32Array(uVort);
			f.set(simTexel);
			f[2] = this.config.CURL;
			f[3] = dt;
		}
		runPass(this.device, encoder, this.passes.vorticity, {
			target: this.velocity.write,
			uniforms: uVort,
			textureViews: [this.velocity.read.view, this.curl.view]
		});
		this.velocity.swap();

		// divergence
		const uDiv = new ArrayBuffer(16);
		new Float32Array(uDiv).set(simTexel);
		runPass(this.device, encoder, this.passes.divergence, {
			target: this.divergence,
			uniforms: uDiv,
			textureViews: [this.velocity.read.view]
		});

		// clear pressure (decay by config.PRESSURE)
		const uClear = new ArrayBuffer(16);
		{
			const f = new Float32Array(uClear);
			f.set(simTexel);
			f[2] = this.config.PRESSURE;
		}
		runPass(this.device, encoder, this.passes.clear, {
			target: this.pressure.write,
			uniforms: uClear,
			textureViews: [this.pressure.read.view]
		});
		this.pressure.swap();

		// pressure iterations
		const uPressure = new ArrayBuffer(16);
		new Float32Array(uPressure).set(simTexel);
		for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
			runPass(this.device, encoder, this.passes.pressure, {
				target: this.pressure.write,
				uniforms: uPressure,
				textureViews: [this.pressure.read.view, this.divergence.view]
			});
			this.pressure.swap();
		}

		// gradient subtract
		const uGrad = new ArrayBuffer(16);
		new Float32Array(uGrad).set(simTexel);
		runPass(this.device, encoder, this.passes.gradientSubtract, {
			target: this.velocity.write,
			uniforms: uGrad,
			textureViews: [this.pressure.read.view, this.velocity.read.view]
		});
		this.velocity.swap();

		// advect velocity
		const uAdvV = new ArrayBuffer(16);
		{
			const f = new Float32Array(uAdvV);
			f.set(simTexel);
			f[2] = dt;
			f[3] = this.config.VELOCITY_DISSIPATION;
		}
		runPass(this.device, encoder, this.passes.advectVelocity, {
			target: this.velocity.write,
			uniforms: uAdvV,
			textureViews: [this.velocity.read.view, this.velocity.read.view]
		});
		this.velocity.swap();

		// advect dye — NOTE: original binds VELOCITY texelSize here too
		// (WebGLFluid.js:1240-1263 never rebinds texelSize for the dye pass)
		const uAdvD = new ArrayBuffer(16);
		{
			const f = new Float32Array(uAdvD);
			f.set(simTexel);
			f[2] = dt;
			f[3] = this.config.DENSITY_DISSIPATION;
		}
		runPass(this.device, encoder, this.passes.advectDye, {
			target: this.dye.write,
			uniforms: uAdvD,
			textureViews: [this.velocity.read.view, this.dye.read.view]
		});
		this.dye.swap();
	}

	// Port of applyBloom (WebGLFluid.js:1333-1380).
	applyBloom(encoder) {
		if (this.bloomLevels.length < 2) return;
		let last = this.bloom;

		const knee = this.config.BLOOM_THRESHOLD * this.config.BLOOM_SOFT_KNEE + 0.0001;
		const uPre = new ArrayBuffer(48);
		{
			const f = new Float32Array(uPre);
			f[0] = last.texelSizeX; // texelSize (vertex neighbors unused here but bound)
			f[1] = last.texelSizeY;
			f[4] = this.config.BLOOM_THRESHOLD - knee; // curve.x @16
			f[5] = knee * 2; // curve.y
			f[6] = 0.25 / knee; // curve.z
			f[7] = this.config.BLOOM_THRESHOLD; // threshold @28
		}
		runPass(this.device, encoder, this.passes.bloomPrefilter, {
			target: this.bloom,
			uniforms: uPre,
			textureViews: [this.dye.read.view]
		});

		// downsample chain — texelSize = SOURCE texel size (WebGLFluid.js:1352-1360)
		for (const dest of this.bloomLevels) {
			const u = new ArrayBuffer(16);
			const f = new Float32Array(u);
			f[0] = last.texelSizeX;
			f[1] = last.texelSizeY;
			runPass(this.device, encoder, this.passes.bloomBlur, {
				target: dest,
				uniforms: u,
				textureViews: [last.view]
			});
			last = dest;
		}

		// additive upsample chain (WebGLFluid.js:1362-1372) — loadOp 'load' + ONE/ONE blend
		for (let i = this.bloomLevels.length - 2; i >= 0; i--) {
			const baseTex = this.bloomLevels[i];
			const u = new ArrayBuffer(16);
			const f = new Float32Array(u);
			f[0] = last.texelSizeX;
			f[1] = last.texelSizeY;
			runPass(this.device, encoder, this.passes.bloomBlurAdditive, {
				target: baseTex,
				uniforms: u,
				textureViews: [last.view],
				loadOp: 'load'
			});
			last = baseTex;
		}

		// final (WebGLFluid.js:1374-1380)
		const uFinal = new ArrayBuffer(16);
		{
			const f = new Float32Array(uFinal);
			f[0] = last.texelSizeX;
			f[1] = last.texelSizeY;
			f[2] = this.config.BLOOM_INTENSITY;
		}
		runPass(this.device, encoder, this.passes.bloomFinal, {
			target: this.bloom,
			uniforms: uFinal,
			textureViews: [last.view]
		});
	}

	// Port of applySunrays + blur (WebGLFluid.js:1382-1408).
	applySunrays(encoder) {
		// mask into dye.write (WebGLFluid.js:1273, 1383-1388)
		const uMask = new ArrayBuffer(16);
		{
			const f = new Float32Array(uMask);
			f[0] = this.dye.texelSizeX;
			f[1] = this.dye.texelSizeY;
		}
		runPass(this.device, encoder, this.passes.sunraysMask, {
			target: this.dye.write,
			uniforms: uMask,
			textureViews: [this.dye.read.view]
		});

		const uSun = new ArrayBuffer(16);
		{
			const f = new Float32Array(uSun);
			f[0] = this.sunrays.texelSizeX;
			f[1] = this.sunrays.texelSizeY;
			f[2] = this.config.SUNRAYS_WEIGHT;
		}
		runPass(this.device, encoder, this.passes.sunrays, {
			target: this.sunrays,
			uniforms: uSun,
			textureViews: [this.dye.write.view]
		});

		// blur(sunrays, sunraysTemp, 1) (WebGLFluid.js:1274, 1397-1408)
		const uBlurH = new ArrayBuffer(16);
		{
			const f = new Float32Array(uBlurH);
			f[0] = this.sunrays.texelSizeX;
			f[1] = 0;
		}
		runPass(this.device, encoder, this.passes.blur, {
			target: this.sunraysTemp,
			uniforms: uBlurH,
			textureViews: [this.sunrays.view]
		});
		const uBlurV = new ArrayBuffer(16);
		{
			const f = new Float32Array(uBlurV);
			f[0] = 0;
			f[1] = this.sunrays.texelSizeY;
		}
		runPass(this.device, encoder, this.passes.blur, {
			target: this.sunrays,
			uniforms: uBlurV,
			textureViews: [this.sunraysTemp.view]
		});
	}

	destroy() {
		this.dye?.destroy();
		this.velocity?.destroy();
		this.divergence?.destroy();
		this.curl?.destroy();
		this.pressure?.destroy();
		this.bloom?.destroy();
		this.bloomLevels?.forEach((t) => t.destroy());
		this.sunrays?.destroy();
		this.sunraysTemp?.destroy();
	}
}
