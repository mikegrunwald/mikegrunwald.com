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

@fragment
fn main(fsInput: VSOutput) -> @location(0) vec4f {
  let centered = fsInput.uv - 0.5;
  let dist = length(centered) * 2.0; // 0 at center → ~1.41 at corners

  // Radial reveal mask grows with params.reveal, softened by params.feather.
  let edge = params.reveal;
  let mask = 1.0 - smoothstep(edge - params.feather, edge, dist);
  if (mask <= 0.0) { discard; }

  // Subtle displacement toward the edges, animated by time.
  let wobble = params.distortion * sin(params.time + dist * 6.2831);
  let baseUv = coverUv(fsInput.uv + centered * wobble, params.uvScale);

  // Chromatic offset on R/B channels.
  let off = params.chroma * centered;
  let r = textureSample(revealTexture, revealSampler, baseUv + off).r;
  let g = textureSample(revealTexture, revealSampler, baseUv).g;
  let b = textureSample(revealTexture, revealSampler, baseUv - off).b;

  // PREMULTIPLIED alpha — the convention every transparent surface in this
  // codebase uses (see carousel.wgsl.js). mask drives both channels.
  return vec4f(r, g, b, 1.0) * mask;
}
`;
