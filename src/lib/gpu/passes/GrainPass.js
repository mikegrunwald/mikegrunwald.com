import { ShaderPass, MediaTexture, Sampler } from 'gpu-curtains';

// ShaderPass conventions [VERIFY-API resolved against gpu-curtains@0.16.3 source]:
//
// - Scene texture binding name defaults to 'renderTexture'
//   (ShaderPass.mjs constructor: `this.options = { ..., renderTextureName:
//   parameters.renderTextureName ?? 'renderTexture' }`, then
//   `this.renderTexture = this.createTexture({ name: this.options.renderTextureName, ... })`).
//   Confirmed again by the library's own default fragment shader
//   (get-default-shader-pass-fragment-code.mjs): `textureSample(renderTexture,
//   defaultSampler, fsInput.uv)`. Do not rename via `renderTextureName` — no
//   reason to here.
// - Default sampler name is 'defaultSampler' (same default-fragment source, and
//   confirmed working already by FluidScene's PASSTHROUGH_FRAG).
// - Varying struct: FullscreenPlane/ShaderPass's default vertex shader
//   (get-default-vertex-shader-code.mjs) outputs
//   `struct VSOutput { @builtin(position) position: vec4f, @location(0) uv: vec2f }`
//   from entry point `main`. We re-declare the same struct name/shape in our
//   fragment code (gpu-curtains does not auto-share it across shader stages)
//   and use entry point `main`, matching FluidScene's PASSTHROUGH_FRAG pattern.
//   No `entryPoint` is passed in `shaders.fragment` — RenderMaterial only
//   defaults `entryPoint` to `'main'` when the whole `fragment` object is
//   omitted (RenderMaterial.mjs), so ours stays `undefined`; WebGPU falls back
//   to auto-detecting the single `@fragment` entry point in the module, which
//   Task 9 already proved works for this same shape of shader.
// - Custom uniforms: `uniforms` param is `Record<bindingName, BufferBindingParams>`
//   (Material.d.ts: `uniforms: Record<string, Record<string, BufferBindingInput>>`,
//   BindGroup.mjs: `this.uniforms[binding.name] = binding.inputs`). The brief's
//   nested-under-`struct` shape (`uniforms: { params: { struct: { resolution: {...} } } }`)
//   is exactly right — `struct` is a real `BufferBindingParams` field
//   (BufferBinding.d.ts:32, documented example at line ~85). WGSL access is
//   `params.resolution` etc., matching the binding's `name` ('params').
//   After construction, `pass.uniforms.params.<key>.value = ...` updates and
//   auto-flags the binding for a GPU buffer rewrite next frame — `setBindings()`
//   in BufferBinding.mjs defines `value` as an accessor whose setter does
//   `binding.shouldUpdate = true`, so no manual dirty-flagging call is needed.
// - Image texture with a REPEAT sampler: `pass.createTexture({name})` (used by
//   the brief's draft) only builds a plain `Texture` (MeshBaseMixin.mjs
//   `createTexture()`: `new Texture(this.renderer, options)`), which has no
//   `loadImage`. That API lives on `MediaTexture` (extends `Texture`), so we
//   construct a `MediaTexture` directly and pass it in via the `textures`
//   constructor param (`SceneObjectTextureOptions`, proven working already by
//   FluidScene's `textures: [this.curtainsTexture]`). Address mode is a
//   `Sampler` concern, not the texture's: `Sampler`'s own constructor already
//   defaults `addressModeU`/`addressModeV` to `'repeat'`
//   (core/samplers/Sampler.mjs), so a plain named `Sampler` used as
//   `repeatSampler` in the WGSL is a REPEAT sampler by construction (set
//   explicitly below anyway for clarity/documentation). Only bindings actually
//   referenced by name in the shader source get attached to the bind group
//   (TextureBindGroup / Material.addSampler doc comment: "add it to the
//   textures bind group only if used in the shaders"), so adding the sampler
//   via the `samplers` param is enough — no manual `@group`/`@binding` WGSL
//   declarations are needed for any of `renderTexture`, `defaultSampler`,
//   `noiseTexture`, or `repeatSampler`.
//
// Compositing: a low-alpha noise layer OVER the scene, both treated as
// PREMULTIPLIED alpha (matches Task 9's finding that FluidScene's composite,
// which `scene` here samples via `renderTexture`, is already premultiplied):
//   out = vec4(noise.rgb·a, a) + scene·(1 − a),  a = intensity · noise.a
// This is the standard "A over B" formula for premultiplied colors, so
// out.a = a + scene.a·(1 − a) correctly *preserves* (rather than discards)
// the scene's own alpha — important since the fluid canvas relies on alpha
// to show the page background through empty regions (Task 9/10).
//
// Blend state: unlike a plain FullscreenPlane (Task 9: gpu-curtains' generic
// `transparent: true` default is straight-alpha, had to be overridden),
// ShaderPass's OWN constructor already defaults to a premultiplied blend
// (`srcFactor: 'one', dstFactor: 'one-minus-src-alpha'` on both channels,
// applied only when `parameters.targets` is not passed) — no override needed
// here. Confirmed via Scene.mjs `addShaderPass()`: immediately before a
// ShaderPass renders, the current target contents are copied out into
// `shaderPass.renderTexture` (that's the `scene` we sample) and then
// `postProcessingPass.setLoadOp('clear')` clears the actual render target, so
// the pass draws onto a blank surface — with `srcFactor: 'one'` the dst blend
// factor is multiplying against a cleared (all-zero) destination and
// contributes nothing, so the pass's output pixel is written through exactly
// as computed in `out` above, once per pixel, with no double-compositing.
const GRAIN_FRAG = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@fragment fn main(fsInput: VSOutput) -> @location(0) vec4f {
  let scene = textureSample(renderTexture, defaultSampler, fsInput.uv);
  let tiledUv = fsInput.uv * params.resolution / (params.noiseSize * params.scale);
  let noise = textureSample(noiseTexture, repeatSampler, tiledUv);
  let a = params.intensity * noise.a;
  return vec4f(noise.rgb * a, a) + scene * (1.0 - a);
}
`;

/**
 * Film-grain ShaderPass: composites tiled noise.webp over the whole canvas
 * (fluid + empty regions alike), replacing the site's CSS noise.webp
 * background. `params.{intensity,scale}` are live-tweakable; both are synced
 * to the GPU uniforms every frame via `engine.onFrame` (same per-frame-push
 * pattern as FluidScene.update()) rather than requiring callers to propagate
 * changes themselves — cheapest-to-get-right option for a small 4-float
 * uniform buffer, and matches how `params` is documented as a "live object"
 * elsewhere in this codebase (see FluidScene's `this.params = { ...FLUID_CONFIG }`).
 *
 * Resize is NOT wired through `renderer.onAfterResize` — that slot is a
 * single-callback slot gpu-curtains only lets one owner register
 * (GPURenderer.mjs, confirmed in Task 9's report) and FluidScene already
 * claims it exclusively for `sim.resize()` + texture re-bridging. Overwriting
 * it here would silently break FluidScene's resize handling. Instead this
 * returns a plain `resize(width, height)` method; the caller (the dev parity
 * route) calls it from its own `ResizeObserver` callback, alongside
 * `renderer.resize()`, which is the "different resize signal" option the
 * brief calls out.
 */
export function createGrainPass({ engine, noiseUrl = '/images/noise.webp' }) {
	const renderer = engine.curtains.renderer;
	const { width, height } = engine.getCanvasSize();
	const dpr = engine.quality?.dpr ?? 1;

	// Tuned default: CSS `background-image: url(noise.webp)` (no background-size)
	// draws the image at 1 image px == 1 CSS px and composites it with its own
	// alpha as-is — exactly what `a = intensity * noise.a` does at intensity 1.
	// Verified against production visually in the dev parity route (see
	// task-11-report.md); 1.0 was the matching value, no tuning needed beyond
	// confirming the DPR compensation below (see noiseSize comment).
	const params = { intensity: 1.0, scale: 1.0 };

	const repeatSampler = new Sampler(renderer, {
		label: 'Grain repeat sampler',
		name: 'repeatSampler',
		addressModeU: 'repeat',
		addressModeV: 'repeat'
	});

	const noiseTexture = new MediaTexture(renderer, {
		label: 'Grain noise texture',
		name: 'noiseTexture'
	});

	const pass = new ShaderPass(renderer, {
		label: 'grain',
		shaders: { fragment: { code: GRAIN_FRAG } },
		samplers: [repeatSampler],
		textures: [noiseTexture],
		uniforms: {
			params: {
				struct: {
					resolution: { type: 'vec2f', value: [width, height] },
					// Placeholder until the image loads (see onSourceUploaded below);
					// keeps `noise.a` sampling well-defined (texture starts filled with
					// MediaTexture's placeholderColor) before the real size is known.
					noiseSize: { type: 'vec2f', value: [1, 1] },
					intensity: { type: 'f32', value: params.intensity },
					scale: { type: 'f32', value: params.scale }
				}
			}
		}
	});

	// `resolution` and `noiseSize` are both in the render target's DEVICE-pixel
	// space (canvas.width/height, already DPR-scaled per engine.js), but the
	// noise texture's natural size is in IMAGE texels, which the browser's CSS
	// background-image treats as CSS px (1 image px == 1 CSS px, no density
	// descriptor on this asset). Baking `dpr` into noiseSize compensates: at
	// scale=1 the tile then repeats every `naturalSize` CSS px in both the CSS
	// reference and this shader, instead of every `naturalSize` DEVICE px
	// (which would make the grain look ~dpr× finer than production on
	// high-DPR screens).
	noiseTexture.onSourceUploaded(() => {
		pass.uniforms.params.noiseSize.value = [
			noiseTexture.size.width * dpr,
			noiseTexture.size.height * dpr
		];
	});
	noiseTexture.loadImage(noiseUrl);

	const unsubscribe = engine.onFrame(() => {
		pass.uniforms.params.intensity.value = params.intensity;
		pass.uniforms.params.scale.value = params.scale;
	});

	return {
		pass,
		params,
		/**
		 * Push a new canvas size (DEVICE pixels, e.g. from `engine.getCanvasSize()`
		 * after `renderer.resize()`) into the `resolution` uniform. Call this from
		 * whatever resize signal the caller already owns — see module doc comment
		 * for why this isn't wired through `renderer.onAfterResize` itself.
		 */
		resize(newWidth, newHeight) {
			pass.uniforms.params.resolution.value = [newWidth, newHeight];
		},
		destroy() {
			unsubscribe();
			pass.remove();
		}
	};
}
