/**
 * WebGL2 post: extract → weighted bloom → feedback → tonemap.
 * Optional GPU filaments draw into scene FBO before bloom.
 */

import { bloomMips } from "./mip";
import { BLOOM_WEIGHTS, bloomThreshold } from "./bloom-config";
import { chooseHdrFormat, framebufferIsComplete, type HdrFormat } from "./hdr";
import { createFilamentPass } from "./filaments";

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;
const EXTRACT = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_src; uniform float u_thresh;
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float m = smoothstep(u_thresh, u_thresh + 0.22, l);
  o = vec4(c * m, 1.0);
}`;
const BLUR = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_src; uniform vec2 u_dir; uniform vec2 u_texel;
void main() {
  vec2 stepv = u_dir * u_texel;
  vec3 c = texture(u_src, v_uv).rgb * 0.227027;
  c += texture(u_src, v_uv + stepv * 1.384615).rgb * 0.316216;
  c += texture(u_src, v_uv - stepv * 1.384615).rgb * 0.316216;
  c += texture(u_src, v_uv + stepv * 3.230769).rgb * 0.070270;
  c += texture(u_src, v_uv - stepv * 3.230769).rgb * 0.070270;
  o = vec4(c, 1.0);
}`;
const COPY_W = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_src; uniform float u_weight;
void main() { o = vec4(texture(u_src, v_uv).rgb * u_weight, 1.0); }`;
const COMBINE = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_src; uniform sampler2D u_bloom; uniform sampler2D u_prev;
uniform float u_bloomAmt; uniform float u_feedback; uniform float u_chroma;
uniform float u_grain; uniform float u_time; uniform float u_vignette;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = v_uv;
  vec2 off = (uv - 0.5) * u_chroma * 0.010;
  vec3 base;
  base.r = texture(u_src, uv + off).r;
  base.g = texture(u_src, uv).g;
  base.b = texture(u_src, uv - off).b;
  vec3 bloom = texture(u_bloom, uv).rgb;
  vec3 prev = texture(u_prev, uv).rgb;
  vec3 col = base + bloom * u_bloomAmt;
  float fb = clamp(u_feedback, 0.0, 0.55);
  col = mix(col, max(col, prev * 0.94), fb);
  col += (hash(uv * vec2(1920.0, 1080.0) + floor(u_time * 24.0)) - 0.5) * u_grain;
  col *= 1.0 - u_vignette * pow(length(uv - 0.5) * 1.45, 2.2);
  col = col / (col + vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader alloc");
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log || "compile fail");
  }
  return s;
}
function program(gl: WebGL2RenderingContext, fs: string) {
  const p = gl.createProgram();
  if (!p) throw new Error("program alloc");
  const v = compile(gl, gl.VERTEX_SHADER, VERT);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, "a_pos"); gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link fail");
  return p;
}
type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, fmt: HdrFormat): Target {
  const tex = gl.createTexture(); const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("fbo alloc");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, fmt.type, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (!framebufferIsComplete(gl)) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); throw new Error("framebuffer incomplete"); }
  return { tex, fbo, w, h };
}
function kill(gl: WebGL2RenderingContext, t: Target) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }

export type PostControls = {
  bloom: number; chroma: number; grain: number; vignette: number; feedback?: number;
  gpuFilaments?: boolean; songTimeMs?: number; kick?: number; bass?: number; drop?: number;
  trackSeed?: number; filamentCount?: number; filamentColor?: [number, number, number];
};
export type GlPost = {
  resize(nw: number, nh: number): void;
  composite(srcCanvas: HTMLCanvasElement, controls: PostControls, timeSec: number): void;
  destroy(): void;
  capabilities(): { hdr: boolean; label: HdrFormat["label"]; filaments: boolean };
};

export function createGlPost(canvas: HTMLCanvasElement): GlPost | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  let chosen = chooseHdrFormat(gl);
  if (chosen.hdr) {
    try { const probe = makeTarget(gl, 4, 4, chosen); kill(gl, probe); }
    catch { chosen = chooseHdrFormat({ getExtension: () => null, RGBA: gl.RGBA, RGBA8: gl.RGBA8, UNSIGNED_BYTE: gl.UNSIGNED_BYTE }); }
  }
  let extractP: WebGLProgram, blurP: WebGLProgram, copyP: WebGLProgram, combineP: WebGLProgram;
  try { extractP = program(gl, EXTRACT); blurP = program(gl, BLUR); copyP = program(gl, COPY_W); combineP = program(gl, COMBINE); }
  catch { return null; }
  const filaments = createFilamentPass(gl);
  const vao = gl.createVertexArray(); const buf = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const srcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const locExtract = { src: gl.getUniformLocation(extractP, "u_src"), thresh: gl.getUniformLocation(extractP, "u_thresh") };
  const locBlur = { src: gl.getUniformLocation(blurP, "u_src"), dir: gl.getUniformLocation(blurP, "u_dir"), texel: gl.getUniformLocation(blurP, "u_texel") };
  const locCopy = { src: gl.getUniformLocation(copyP, "u_src"), weight: gl.getUniformLocation(copyP, "u_weight") };
  const locCombine = {
    src: gl.getUniformLocation(combineP, "u_src"), bloom: gl.getUniformLocation(combineP, "u_bloom"),
    prev: gl.getUniformLocation(combineP, "u_prev"), bloomAmt: gl.getUniformLocation(combineP, "u_bloomAmt"),
    feedback: gl.getUniformLocation(combineP, "u_feedback"), chroma: gl.getUniformLocation(combineP, "u_chroma"),
    grain: gl.getUniformLocation(combineP, "u_grain"), time: gl.getUniformLocation(combineP, "u_time"),
    vig: gl.getUniformLocation(combineP, "u_vignette"),
  };
  let w = Math.max(2, canvas.width), h = Math.max(2, canvas.height);
  let levels: Target[] = [], ping: Target[] = [], pong: Target[] = [];
  let bloomFull!: Target, sceneTarget!: Target, feedbackA!: Target, feedbackB!: Target, fbFlip = false;
  function allocLevels() {
    const mips = bloomMips(w, h);
    levels.forEach((t) => kill(gl, t)); ping.forEach((t) => kill(gl, t)); pong.forEach((t) => kill(gl, t));
    if (bloomFull) kill(gl, bloomFull); if (sceneTarget) kill(gl, sceneTarget);
    if (feedbackA) kill(gl, feedbackA); if (feedbackB) kill(gl, feedbackB);
    levels = mips.map((m) => makeTarget(gl, m.w, m.h, chosen));
    ping = mips.map((m) => makeTarget(gl, m.w, m.h, chosen));
    pong = mips.map((m) => makeTarget(gl, m.w, m.h, chosen));
    bloomFull = makeTarget(gl, w, h, chosen); sceneTarget = makeTarget(gl, w, h, chosen);
    feedbackA = makeTarget(gl, w, h, chosen); feedbackB = makeTarget(gl, w, h, chosen);
  }
  allocLevels();
  function drawQuad() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function blurLevel(i: number, src: WebGLTexture) {
    const t = levels[i];
    gl.viewport(0, 0, t.w, t.h); gl.useProgram(blurP);
    gl.uniform1i(locBlur.src, 0); gl.uniform2f(locBlur.texel, 1 / t.w, 1 / t.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ping[i].fbo); gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform2f(locBlur.dir, 1, 0); drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pong[i].fbo); gl.bindTexture(gl.TEXTURE_2D, ping[i].tex);
    gl.uniform2f(locBlur.dir, 0, 1); drawQuad();
  }
  return {
    capabilities() { return { hdr: chosen.hdr, label: chosen.label, filaments: !!filaments }; },
    resize(nw, nh) { canvas.width = nw; canvas.height = nh; w = Math.max(2, nw); h = Math.max(2, nh); allocLevels(); },
    composite(srcCanvas, controls, timeSec) {
      if (srcCanvas.width !== w || srcCanvas.height !== h) {
        w = Math.max(2, srcCanvas.width); h = Math.max(2, srcCanvas.height);
        canvas.width = w; canvas.height = h; allocLevels();
      }
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.fbo); gl.viewport(0, 0, w, h);
      gl.useProgram(copyP); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(locCopy.src, 0); gl.uniform1f(locCopy.weight, 1); drawQuad();
      if (controls.gpuFilaments && filaments) {
        filaments.draw({
          count: Math.max(1, Math.min(48, controls.filamentCount ?? 24)),
          timeSec, kick: controls.kick ?? 0, bass: controls.bass ?? 0, drop: controls.drop ?? 0,
          seed: controls.trackSeed ?? 19770822, width: w, height: h,
          color: controls.filamentColor ?? [1.0, 0.55, 0.28],
        });
      }
      const sceneTex = sceneTarget.tex;
      gl.viewport(0, 0, levels[0].w, levels[0].h); gl.useProgram(extractP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, levels[0].fbo);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(locExtract.src, 0); gl.uniform1f(locExtract.thresh, bloomThreshold()); drawQuad();
      blurLevel(0, levels[0].tex);
      gl.useProgram(copyP); gl.uniform1i(locCopy.src, 0); gl.uniform1f(locCopy.weight, 1);
      for (let i = 1; i < levels.length; i++) {
        gl.viewport(0, 0, levels[i].w, levels[i].h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, levels[i].fbo);
        gl.bindTexture(gl.TEXTURE_2D, pong[i - 1].tex); drawQuad();
        blurLevel(i, levels[i].tex);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFull.fbo); gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(copyP); gl.uniform1i(locCopy.src, 0);
      for (let i = 0; i < pong.length; i++) {
        gl.uniform1f(locCopy.weight, BLOOM_WEIGHTS[i] ?? 0);
        gl.bindTexture(gl.TEXTURE_2D, pong[i].tex); drawQuad();
      }
      gl.disable(gl.BLEND);
      const prev = fbFlip ? feedbackA : feedbackB; const next = fbFlip ? feedbackB : feedbackA;
      gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo); gl.viewport(0, 0, w, h); gl.useProgram(combineP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(locCombine.src, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomFull.tex); gl.uniform1i(locCombine.bloom, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, prev.tex); gl.uniform1i(locCombine.prev, 2);
      gl.uniform1f(locCombine.bloomAmt, controls.bloom);
      gl.uniform1f(locCombine.feedback, Math.max(0, Math.min(0.55, controls.feedback ?? 0.16)));
      gl.uniform1f(locCombine.chroma, controls.chroma);
      gl.uniform1f(locCombine.grain, controls.grain);
      gl.uniform1f(locCombine.time, timeSec);
      gl.uniform1f(locCombine.vig, controls.vignette);
      drawQuad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(copyP); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, next.tex);
      gl.uniform1i(locCopy.src, 0); gl.uniform1f(locCopy.weight, 1); drawQuad();
      fbFlip = !fbFlip;
    },
    destroy() {
      levels.forEach((t) => kill(gl, t)); ping.forEach((t) => kill(gl, t)); pong.forEach((t) => kill(gl, t));
      kill(gl, bloomFull); kill(gl, sceneTarget); kill(gl, feedbackA); kill(gl, feedbackB);
      gl.deleteProgram(extractP); gl.deleteProgram(blurP); gl.deleteProgram(copyP); gl.deleteProgram(combineP);
      filaments?.destroy();
    },
  };
}
