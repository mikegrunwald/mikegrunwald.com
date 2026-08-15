// Cursor-follow image reveal for the Project Archive (Plan C). Passthrough
// vertex (auto-injected Attributes + getOutputPosition, same as
// carousel.wgsl.js).
//
// gpu-curtains 0.16.3 binding convention — VERIFIED against carousel.wgsl.js +
// CarouselScene.js (both in this repo) and node_modules/gpu-curtains source:
//   - The uniform block, its `struct`, and ALL @group/@binding declarations for
//     uniforms + textures + samplers are AUTO-INJECTED by gpu-curtains from the
//     Mesh's `uniforms`/`textures`/`samplers` params. The shader must NOT
//     declare them itself (doing so double-declares the binding and fails
//     pipeline creation). We reference `params.*` and the texture/sampler by the
//     `name` given to the MediaTexture/Sampler in ArchiveRevealScene — here
//     `revealTexture` / `revealSampler`.
//   - This texture is an IMAGE (MediaTexture.loadImage → sourcesTypes "image",
//     MediaTexture.mjs:319-343), NOT a video, so it binds as a regular
//     `texture_2d<f32>` and is sampled with `textureSample` — the video-only
//     `texture_external` + `textureSampleBaseClampToEdge` rule that
//     carousel.wgsl.js documents does NOT apply here.
export const REVEAL_VERTEX = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn main(attributes: Attributes) -> VSOutput {
  var vsOutput: VSOutput;
  vsOutput.position = getOutputPosition(attributes.position);
  vsOutput.uv = attributes.uv;
  return vsOutput;
}
`;

// Uniform field order/padding: keep 16-byte alignment (see CarouselScene.js's
// vec3f warning). Only scalars follow the single vec2f, so this packs cleanly.
// The `params` struct + its binding are injected from the JS `uniforms.params`
// spec in ArchiveRevealScene — do not declare them here.
export const REVEAL_FRAGMENT = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn coverUv(uv: vec2f, scale: vec2f) -> vec2f {
  return (uv - 0.5) / scale + 0.5;
}

// Signed distance to a rounded rectangle (iq). <0 inside, 0 on edge, >0 outside.
fn sdRoundRect(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn main(fsInput: VSOutput) -> @location(0) vec4f {
  let centered = fsInput.uv - 0.5; // -0.5..0.5

  // The image occupies a rounded-rect content box inset by glowPad; the ring of
  // space left around it is where the outer glow falls off. No radial vignette.
  //
  // UV is square (0..1) but the plane is planeW×planeH, so a UV-space radius
  // stretches into an ellipse. Work in world-proportional units (multiply x by
  // aspect = planeW/planeH) so radius, glowPad and glowWidth are all EVEN in
  // world units. pad is applied in these units too, so the inset is symmetric.
  let aspect = params.aspect;
  let p = vec2f(centered.x * aspect, centered.y);
  let pad = params.glowPad;
  let half = vec2f(0.5 * aspect - pad, 0.5 - pad);
  let d = sdRoundRect(p, half, params.radius);
  if (d > params.glowWidth) { discard; }

  // Remap the content box back to 0..1 before cover-fitting the source image.
  // x is inset by pad/aspect (undoing the aspect scale), y by pad.
  let padUv = vec2f(pad / aspect, pad);
  let contentUv = (fsInput.uv - padUv) / (vec2f(1.0) - 2.0 * padUv);
  let wobble = params.distortion * sin(params.time + length(centered) * 6.2831);
  let baseUv = coverUv(contentUv + centered * wobble, params.uvScale);

  // Chromatic offset on R/B channels.
  let off = params.chroma * centered;
  let r = textureSample(revealTexture, revealSampler, baseUv + off).r;
  let g = textureSample(revealTexture, revealSampler, baseUv).g;
  let b = textureSample(revealTexture, revealSampler, baseUv - off).b;

  // Crisp rounded edge (antialiased by one pixel of the SDF gradient) + a
  // primary-tinted glow ring outside it. params.reveal fades the whole thing in.
  let aa = fwidth(d) + 1e-4;
  let inside = 1.0 - smoothstep(0.0, aa, d);
  let glow = (1.0 - smoothstep(0.0, params.glowWidth, max(d, 0.0))) * (1.0 - inside);
  let tint = vec3f(params.tintR, params.tintG, params.tintB);
  let appear = params.reveal;

  let color = vec3f(r, g, b) * inside + tint * (glow * params.glowIntensity);
  let alpha = (inside + glow * params.glowIntensity) * appear;

  // PREMULTIPLIED alpha — the convention every transparent surface in this
  // codebase uses (see carousel.wgsl.js).
  return vec4f(color * appear, alpha);
}
`;
