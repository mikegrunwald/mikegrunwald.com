// Minimal textured-quad shaders for a carousel ring plane. No custom vertex
// logic needed — position/uv passthrough via the auto-injected `Attributes`
// struct and `getOutputPosition()` chunk (same mechanism Phase 2 Task 4
// resolved for Plane; [VERIFY-API #1] in CarouselScene.js confirms it
// generalizes to plain Mesh — Mesh.mjs's own `super(renderer, null, params)`
// goes through the identical Geometry/RenderPipelineEntry machinery).
export const CAROUSEL_VERTEX = /* wgsl */ `
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

export const CAROUSEL_FRAGMENT = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

// #33c5f3 — the same cyan as .media's box-shadow on the work detail pages
// (src/routes/work/[slug]/+page.svelte). Hardcoded rather than passed as a
// uniform to avoid a vec3f in the uniform block: vec3f aligns to 16 bytes and
// mis-sizing that struct has already cost this project a debugging session.
const GLOW_COLOR = vec3f(0.2, 0.773, 0.953);

// Signed distance to a rounded box centred at the origin. Negative inside,
// zero on the edge, positive outside. Standard formulation: shrink the box by
// the corner radius, take the distance to that smaller box, then subtract the
// radius back off.
fn sdRoundedBox(p: vec2f, halfExtent: vec2f, radius: f32) -> f32 {
  // Clamp so a radius larger than the box cannot invert the shape.
  let r = min(radius, min(halfExtent.x, halfExtent.y));
  let q = abs(p) - halfExtent + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn main(fsInput: VSOutput) -> @location(0) vec4f {
  // The quad is LARGER than the video (params.quadHalf vs params.videoHalf) so
  // later work has room to draw outside the video's edge. Convert uv into
  // plane-local WORLD units first — doing the geometry in world units rather
  // than normalized uv keeps corners circular on a non-square plane, instead of
  // stretching with the aspect ratio.
  let p = (fsInput.uv - vec2f(0.5)) * 2.0 * params.quadHalf;

  // Video uv: p mapped back into 0..1 across the video's extent only. Outside
  // the video this goes beyond 0..1, which is why the region is masked below
  // rather than relying on the sampler's clamp.
  let videoUv = (p / params.videoHalf) * 0.5 + vec2f(0.5);

  // MUST be textureSampleBaseClampToEdge, NOT textureSample.
  //
  // gpu-curtains binds a video MediaTexture as WGSL \`texture_external\`
  // (MediaTexture.mjs:14 defaults \`useExternalTextures: true\`, and :503 then
  // selects the "externalVideo" source type). WGSL has no \`textureSample\`
  // overload accepting \`texture_external\` — only \`textureSampleBaseClampToEdge\`
  // takes one. Using \`textureSample\` here compiles fine as text but fails at
  // pipeline creation with "no matching call to
  // textureSample(texture_external, sampler, vec2<f32>)".
  //
  // That failure is far more destructive than a missing texture: gpu-curtains'
  // GPUDeviceManager.animate() is \`this.render(); this.animationFrameID =
  // requestAnimationFrame(...)\` — the throw from the failed pipeline escapes
  // render(), so the rAF is NEVER re-armed and the ENTIRE canvas freezes on its
  // last frame, taking the fluid and hero particles down with it. Verified: this
  // is exactly what happened.
  let video = textureSampleBaseClampToEdge(videoTexture, videoSampler, videoUv);

  // Vertical darkening, matching ProjectHeader's :after gradient on the work
  // detail pages. Symmetric about the midpoint: darkest at top and bottom,
  // lightest in the middle. abs(uv.y - 0.5) * 2 gives 1 at both edges and 0 at
  // the centre, so one mix reproduces the three-stop CSS gradient exactly.
  let edgeT = abs(fsInput.uv.y - 0.5) * 2.0;
  let darkness = mix(params.gradientMid, params.gradientEdge, edgeT);
  let graded = video.rgb * (1.0 - darkness);

  let d = sdRoundedBox(p, params.videoHalf, params.cornerRadius);

  // Antialias across roughly one pixel. fwidth(d) is the screen-space rate of
  // change of the distance field, so this stays a constant apparent width as
  // the plane rotates toward or away from the camera — a fixed epsilon would
  // go hard-edged up close and mushy far away.
  let aa = max(fwidth(d), 1e-5);
  let fill = 1.0 - smoothstep(-aa, aa, d);

  // Border hugging the inside of the edge, matching .media's 1px border on the
  // detail page. abs(d) < borderWidth selects a band centred on the edge; the
  // fill mask above then trims its outer half so the border never extends past
  // the video's silhouette.
  let border = (1.0 - smoothstep(params.borderWidth - aa, params.borderWidth + aa, abs(d))) * fill;
  let rgb = mix(graded, GLOW_COLOR, border);

  // Outer glow: falls off with distance OUTSIDE the shape (d > 0). Squared
  // falloff rather than linear so it reads closer to a Gaussian box-shadow.
  let outerT = 1.0 - clamp(d / max(params.glowRadius, 1e-5), 0.0, 1.0);
  let outer = outerT * outerT * (1.0 - fill);

  // Inset glow: mirrors it inside the shape (d < 0), brightest at the edge.
  let innerT = 1.0 - clamp(-d / max(params.glowInset, 1e-5), 0.0, 1.0);
  let inner = innerT * innerT * fill;

  // hover already carries hoverGlowBoost from the scene, so it is an additive
  // multiplier on top of the resting strength rather than a replacement.
  let strength = params.glowStrength * (1.0 + params.hover);

  // The inset glow brightens pixels the video already covers; the outer glow
  // adds coverage where there was none, so only it contributes alpha.
  let litRgb = rgb + GLOW_COLOR * inner * strength;
  let outerA = clamp(outer * strength, 0.0, 1.0);
  let alpha = clamp(fill + outerA, 0.0, 1.0);

  // Composite the outer glow's colour in proportionally to the alpha it added,
  // so the pad region is glow-coloured and the video region is unaffected.
  let rgbOut = select(
    (litRgb * fill + GLOW_COLOR * outerA) / max(alpha, 1e-5),
    litRgb,
    alpha <= 0.0
  );

  // PREMULTIPLIED alpha — the convention every transparent surface in this
  // codebase uses (FluidScene, LogoParticlesScene, GrainPass). Returning
  // straight alpha here produces a bright fringe where the video meets the pad.
  return vec4f(rgbOut * alpha, alpha);
}
`;
