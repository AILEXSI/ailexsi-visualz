/**
 * Instanced GPU filaments. Draws into the currently bound framebuffer.
 * Geometry is static; instance id + uniforms drive the wave.
 */

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
flat out float v_id;
out float v_edge;
uniform float u_time;
uniform float u_kick;
uniform float u_bass;
uniform float u_drop;
uniform float u_seed;
uniform float u_count;
uniform vec2 u_res;

uint hash(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
float rnd(uint x) { return float(hash(x)) / 4294967295.0; }

void main() {
  float id = float(gl_InstanceID);
  v_id = id;
  v_edge = abs(a_corner.y);
  uint sid = uint(u_seed) + uint(gl_InstanceID) * 17u;
  float phase = rnd(sid) * 6.2831853;
  float freq = 1.6 + rnd(sid + 3u) * 2.4;
  float depth = 0.25 + rnd(sid + 81u) * 0.75;
  float amp = (0.045 + u_bass * 0.16 + u_kick * 0.05 + u_drop * 0.07) * (0.55 + depth);
  float yOff = (id / max(u_count - 1.0, 1.0) - 0.5) * 0.42;
  float t = a_corner.x;
  float y = yOff + sin(t * 6.2831853 * freq + phase + u_time * (0.35 + depth * 0.4)) * amp;
  float w = 0.004 + (1.0 - depth) * 0.01 + u_kick * 0.003;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 pos = vec2(t * 2.0 - 1.0, y * 2.0);
  pos.y += a_corner.y * w * aspect;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
flat in float v_id;
in float v_edge;
out vec4 o;
uniform float u_kick;
uniform vec3 u_color;
void main() {
  float a = (1.0 - v_edge) * (0.28 + u_kick * 0.22);
  o = vec4(u_color * (0.7 + 0.3 * fract(v_id * 0.17)), a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("filament shader alloc");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "filament compile fail");
  }
  return s;
}

export type FilamentPass = {
  draw(opts: {
    count: number;
    timeSec: number;
    kick: number;
    bass: number;
    drop: number;
    seed: number;
    width: number;
    height: number;
    color: [number, number, number];
  }): void;
  destroy(): void;
};

export function createFilamentPass(gl: WebGL2RenderingContext): FilamentPass | null {
  let prog: WebGLProgram;
  try {
    const p = gl.createProgram();
    if (!p) return null;
    const v = compile(gl, gl.VERTEX_SHADER, VERT);
    const f = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, "a_corner");
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    prog = p;
  } catch {
    return null;
  }

  const SEG = 64;
  const verts = new Float32Array((SEG + 1) * 2 * 2);
  let o = 0;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    verts[o++] = t; verts[o++] = -1;
    verts[o++] = t; verts[o++] = 1;
  }
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const loc = {
    time: gl.getUniformLocation(prog, "u_time"),
    kick: gl.getUniformLocation(prog, "u_kick"),
    bass: gl.getUniformLocation(prog, "u_bass"),
    drop: gl.getUniformLocation(prog, "u_drop"),
    seed: gl.getUniformLocation(prog, "u_seed"),
    count: gl.getUniformLocation(prog, "u_count"),
    res: gl.getUniformLocation(prog, "u_res"),
    color: gl.getUniformLocation(prog, "u_color"),
  };

  return {
    draw(opts) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(loc.time, opts.timeSec);
      gl.uniform1f(loc.kick, opts.kick);
      gl.uniform1f(loc.bass, opts.bass);
      gl.uniform1f(loc.drop, opts.drop);
      gl.uniform1f(loc.seed, opts.seed);
      gl.uniform1f(loc.count, opts.count);
      gl.uniform2f(loc.res, opts.width, opts.height);
      gl.uniform3f(loc.color, opts.color[0], opts.color[1], opts.color[2]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, opts.count);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.BLEND);
    },
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    },
  };
}
