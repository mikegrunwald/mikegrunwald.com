// Shared fullscreen-triangle vertex shader.
// UV CONVENTION (locked project-wide): top-left origin —
// uv = pos * vec2(0.5, -0.5) + 0.5, so a texture written by one pass and
// sampled by the next round-trips identity in WebGPU's top-left texel space.
// Every pass binds a uniform struct whose FIRST field is texelSize: vec2f.
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
