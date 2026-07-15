// gpu-curtains 0.16.3 API resolution notes (Task 4, [VERIFY-API] markers from
// task-4-brief.md). Verified against node_modules/gpu-curtains/dist/types/**/*.d.ts
// (shapes) and the corresponding dist/esm/**/*.mjs runtime source (actual
// generation/behavior — types alone don't show it). Tasks 5-8 build directly
// on these; re-verify against the installed version before trusting them if
// gpu-curtains gets bumped.
//
// 1. Instancing on a `Plane` — `instancesCount` is a top-level `Plane`/
//    `PlaneGeometry` constructor param, not nested under `geometry`.
//    PlaneParams extends PlaneGeometryParams extends GeometryBaseParams =
//    `Omit<Partial<GeometryOptions>, 'verticesOrder'>`, and `GeometryOptions`
//    declares `instancesCount: number` (types/Geometries.d.ts). Runtime default
//    is `1` (PlaneGeometry.mjs constructor: `instancesCount = 1`). So
//    `new Plane(engine.curtains, element, { instancesCount: this.params.count, ... })`
//    is correct as drafted. Default `widthSegments`/`heightSegments` are both
//    `1`, giving a single indexed quad (4 vertices) per instance — exactly the
//    sprite base geometry we want; no need to pass either.
//
// 2. Storage buffer shape — THE BIGGEST DEVIATION FROM THE BRIEF'S DRAFT.
//    `storages` is `Record<bindingName, BufferBindingParams>` (types/BindGroups.d.ts
//    `ReadWriteInputBindings`), and `BufferBindingParams.struct` is
//    `Record<string, Input>` where each `Input` is `{ type, value }` — there is
//    NO top-level `value` on the binding itself (the brief's draft
//    `storages: { particles: { value: data } }` shape does not exist).
//    For a LOCKED interleaved-struct-per-instance (AoS) layout, the correct
//    gpu-curtains pattern is FOUR separate flat arrays, one per field, each
//    typed `array<vec2f>` and each of length `count * 2`:
//      struct: {
//        pos:  { type: 'array<vec2f>', value: posArr  },
//        vel:  { type: 'array<vec2f>', value: velArr  },
//        home: { type: 'array<vec2f>', value: homeArr },
//        seed: { type: 'array<vec2f>', value: seedArr },
//      }
//    BufferBinding.mjs#setInputsAlignment detects >1 array-typed struct fields
//    of matching element counts and auto-interleaves them into a single AoS
//    GPU buffer (comment: "Used to compute alignment when dealing with arrays
//    of Struct") — i.e. gpu-curtains does the AoS packing FOR us from four
//    caller-supplied SoA arrays; we do not build the interleaved Float32Array
//    by hand. setWGSLFragment's WGSL generation has TWO branches depending on
//    whether any plain (non-array) fields are mixed in alongside the array
//    fields: mixed → wraps the array in an `{ elements: array<...> }`
//    container struct; ALL-array (our case, all 4 fields are `array<vec2f>`)
//    → generates the struct directly with no wrapper:
//      struct Particles { pos: vec2f, vel: vec2f, home: vec2f, seed: vec2f };
//      @group(x) @binding(y) var<storage, read> particles: array<Particles>;
//    (Confirmed empirically, not just by reading source: an earlier version
//    of this file assumed the wrapped form and got a real WGSL compile error
//    — "cannot index into expression of type 'array<Particles>'" — from
//    trying `particles.elements[i]` against this actually-generated type.)
//    Field declaration order matches struct-object key insertion order
//    (pos, vel, home, seed) — confirmed by tracing `Object.keys(this.inputs)`
//    through `setInputsAlignment`. Access in the shader is
//    `particles[instanceIndex].pos` etc, exactly matching the brief's
//    original shader draft (no fix needed there, despite the storages param
//    shape underneath it being wrong — see above).
//    The struct TYPE name ("Particles") and the binding VARIABLE name
//    ("particles") differ only in case: `toKebabCase` in gpu-curtains'
//    utils.mjs is actually PascalCase despite the name
//    (`camelCase.charAt(0).toUpperCase() + camelCase.slice(1)`), so a
//    same-named binding key never collides with its own generated struct
//    type — no `label` override needed. (Also already proven safe in the
//    uniform case by GrainPass.js's `uniforms: { params: {...} }`, which
//    generates `struct Params {...}; var<uniform> params: Params;`.)
//    `usage: ['storage']` is NOT needed: BindGroup.mjs#createBindingBuffer
//    unconditionally includes `binding.bindingType` ("storage", from the
//    `storages` vs `uniforms` key) in the GPUBuffer usage flags regardless of
//    the `usage` option, so it would be redundant.
//    `access: 'read'` is the BufferBinding constructor default; passed
//    explicitly below only for documentation (Task 5's compute pass will flip
//    its own binding to `read_write`, this render-side binding stays `read`).
//
// 3. Default Plane vertex shader matrix/position chunk —
//    `getOutputPosition(position: vec3f) -> vec4f` (core/shaders/chunks/vertex/
//    head/get-position-helpers.mjs), auto-injected into every vertex shader
//    head by RenderPipelineEntry.mjs#patchShaders:
//      fn getOutputPosition(position: vec3f) -> vec4f {
//        return camera.projection * camera.view * matrices.model * vec4f(position, 1.0);
//      }
//    The `Attributes` struct (Geometry.mjs#setWGSLFragment) is likewise
//    auto-injected and provides `@location(0) position: vec3f` / `uv: vec2f`
//    (PlaneGeometry.mjs's default attribute names) plus
//    `@builtin(vertex_index)`/`@builtin(instance_index)` fields ON the struct
//    itself — we do not declare either struct ourselves in particles.wgsl.js,
//    and (confirmed via a real compile error, "'@builtin(instance_index)'
//    appears multiple times as pipeline input") must NOT also declare a
//    separate `@builtin(instance_index)` function parameter; instance index
//    is read as `attributes.instanceIndex`.
//
// 4. `plane.domElement.boundingRect` fields (needed by Task 6's coordinate
//    transform) — `DOMElementBoundingRect extends RectCoords, RectBBox,
//    DOMPosition` (core/DOM/DOMElement.d.ts): `{ top, right, bottom, left,
//    width, height, x, y }`, all CSS-pixel numbers (RectCoords: top/right/
//    bottom/left; RectBBox adds width/height; DOMPosition adds x/y). Standard
//    DOMRect-shaped object.
//    DOMObject3D.mjs#documentToWorldSpace confirms the DOM-sync mechanism:
//    the mesh's world position is computed from `this.boundingRect` relative
//    to `this.renderer.boundingRect` (the renderer's OWN canvas bounding
//    rect) — i.e. the synced DOM element's on-screen rect must overlap the
//    WebGPU canvas's on-screen rect for the mesh to be visible at all. This is
//    why the dev route's `[data-gpu-logo]` box is positioned to overlap the
//    fluid canvas (see +page.svelte `.logo-host`), not placed in a separate
//    page section the way Task 3's temp bake-check canvas was.
//
// 5. Draw order vs the fluid's FullscreenPlane — `renderOrder` is a real
//    `MeshBaseParams`/`MeshBaseRenderParams` field, but it does not need to do
//    the work here. Scene.mjs's own stacking order (JSDoc + the
//    `renderPassEntries` sort passes) draws, in order: (1) ComputePass,
//    (2) pingPong, (3) opaque UNPROJECTED meshes (FullscreenPlane / RenderBundle),
//    (4) transparent UNPROJECTED meshes, (5) prePass ShaderPass, (6) opaque
//    PROJECTED meshes (Mesh/DOMMesh/Plane), (7) transparent PROJECTED meshes.
//    FluidScene's display mesh is a `FullscreenPlane` (unprojected, category
//    3/4); this scene's particle field is a `Plane`/DOMMesh (projected,
//    category 6/7) — so it structurally draws AFTER the fluid regardless of
//    `renderOrder` value. The grain ShaderPass is a separate post-processing
//    pass applied to the whole composited canvas texture afterward (already
//    proven in Phase 1 per GrainPass.js), so it draws after both. `renderOrder:
//    1` is kept below purely as documentation of intent, not because it
//    changes behavior.

import { Plane } from 'gpu-curtains';
import { bakeLogoImage } from '../particles/bakeLogo.js';
import { sampleSpawnPoints } from '../particles/spawnSampler.js';
import { mulberry32 } from '../utils/rng.js';
import { PARTICLES_VERTEX, PARTICLES_FRAGMENT } from '../particles/shaders/particles.wgsl.js';

// Matches FluidScene's PREMULTIPLIED_BLEND pattern (canvas alphaMode is
// 'premultiplied'; gpu-curtains' generic `transparent: true` default is
// straight-alpha, so this must be set explicitly — see FluidScene.js/Task 9).
const PREMULTIPLIED_BLEND = {
	color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
	alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

export class LogoParticlesScene {
	static async create({ engine, element, fluidScene = null, seed = Date.now() }) {
		const imageData = await bakeLogoImage();
		return new LogoParticlesScene({ engine, element, fluidScene, seed, imageData });
	}

	constructor({ engine, element, fluidScene, seed, imageData }) {
		this.engine = engine;
		this.fluidScene = fluidScene;
		this.destroyed = false;

		const isMobile = engine.quality.tier === 'mobile';
		this.params = {
			count: isMobile ? 40000 : 150000,
			size: 0.006, // sprite radius, plane-local units
			opacity: 1.0,
			spring: 6.0,
			damping: 3.5,
			curlStrength: 0.06,
			curlScale: 3.0,
			curlSpeed: 0.25,
			pointerRadius: 0.16,
			pointerForce: 1.4,
			coupling: 0.35,
			shimmerSpeed: 1.6,
			shimmerIntensity: 0.45,
			sizeVariation: 0.6,
			glintGain: 2.0,
			// Tilt (spec amendment 2026-07-14): production tilt.js tuning carried over.
			maxTilt: 13, // degrees
			tiltEase: 0.067,
			tiltDepth: 0.12 // per-particle z spread in plane-local units (parallax)
		};

		const rng = mulberry32(seed);
		const { positions, brightness } = sampleSpawnPoints(imageData, {
			count: this.params.count,
			rng
		});

		// [VERIFY-API #2] Four separate SoA arrays (NOT a single hand-interleaved
		// buffer) — gpu-curtains auto-interleaves matching-length array-typed
		// struct fields into the locked 32 B/particle AoS layout. vel starts at
		// zero (no motion until Task 5); home mirrors the spawn position (T5's
		// spring target); seed.x is a random phase, seed.y is bake brightness.
		const count = this.params.count;
		const posArr = positions; // already Float32Array(count * 2), pos == home at spawn
		const velArr = new Float32Array(count * 2); // zeroed: static field, Task 4 has no motion
		const homeArr = new Float32Array(positions); // copy: independent buffer from pos
		const seedArr = new Float32Array(count * 2);
		for (let i = 0; i < count; i++) {
			seedArr[i * 2 + 0] = rng() * Math.PI * 2; // phase
			seedArr[i * 2 + 1] = brightness[i]; // brightness
		}

		this.plane = new Plane(engine.curtains, element, {
			label: 'logo-particles',
			instancesCount: count,
			transparent: true,
			targets: [{ blend: PREMULTIPLIED_BLEND }],
			renderOrder: 1, // documentation only — see [VERIFY-API #5] above
			shaders: {
				vertex: { code: PARTICLES_VERTEX },
				fragment: { code: PARTICLES_FRAGMENT, entryPoint: 'fsMain' }
			},
			uniforms: {
				render: {
					struct: {
						size: { type: 'f32', value: this.params.size },
						opacity: { type: 'f32', value: this.params.opacity }
					}
				}
			},
			storages: {
				particles: {
					access: 'read', // default; explicit for documentation (see [VERIFY-API #2])
					struct: {
						pos: { type: 'array<vec2f>', value: posArr },
						vel: { type: 'array<vec2f>', value: velArr },
						home: { type: 'array<vec2f>', value: homeArr },
						seed: { type: 'array<vec2f>', value: seedArr }
					}
				}
			}
		});

		this.unsubFrame = engine.onFrame(() => this.update());
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;
		// Task 4: static field — sync live params only.
		this.plane.uniforms.render.size.value = this.params.size;
		this.plane.uniforms.render.opacity.value = this.params.opacity;
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		this.plane.remove();
	}
}
