// Shared fullscreen-triangle vertex shader.
// UV CONVENTION (locked project-wide): top-left origin —
// uv = pos * vec2(0.5, -0.5) + 0.5, so a texture written by one pass and
// sampled by the next round-trips identity in WebGPU's top-left texel space.
// Every pass binds a uniform struct whose FIRST field is texelSize: vec2f.
//
// vT/vB SIGN CONVENTION — intentional, not a bug:
// vT/vB deliberately KEEP the original WebGL offset signs
// (vT = uv + texelSize.y, vB = uv - texelSize.y). Under the flipped
// (top-left-origin) uv above, "vT" therefore numerically points
// DOWN-screen, not up. This looks backwards at a glance but is
// load-bearing: every fluid fragment shader is a verbatim port of the
// WebGL originals and assumes these exact signs — including the
// divergence shader's boundary checks (vT.y > 1.0 / vB.y < 0.0), which
// would silently break if the signs were "corrected" in isolation.
// The end-to-end simulation is mirror-equivariant, so with unflipped
// pointer input and direct top-left display sampling this yields exact
// screen parity with the WebGL original.
// DO NOT swap these signs without conjugating every y-comparison in
// every fragment shader that consumes vT/vB.
export const VERTEX_WGSL = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) vUv: vec2f,
  @location(1) vL: vec2f,
  @location(2) vR: vec2f,
  @location(3) vT: vec2f,
  @location(4) vB: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let pos = positions[vi];
  var out: VSOut;
  out.position = vec4f(pos, 0.0, 1.0);
  let uv = pos * vec2f(0.5, -0.5) + 0.5;
  out.vUv = uv;
  out.vL = uv - vec2f(uniforms.texelSize.x, 0.0);
  out.vR = uv + vec2f(uniforms.texelSize.x, 0.0);
  out.vT = uv + vec2f(0.0, uniforms.texelSize.y);
  out.vB = uv - vec2f(0.0, uniforms.texelSize.y);
  return out;
}
`;
