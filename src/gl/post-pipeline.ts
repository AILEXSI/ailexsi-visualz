/**
 * WebGL2 post stack — own code.
 * bright extract → separable blur → combine + chroma + grain + vignette
 */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const EXTRACT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform float u_thresh;
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float m = smoothstep(u_thresh, u_thresh + 0.25, l);
  o = vec4(c * m, 1.0);
}`;

const BLUR = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform vec2 u_texel;
void main() {
  vec2 stepv = u_dir * u_texel;
  vec3 c = texture(u_src, v_uv).rgb * 0.227027;
  c += texture(u_src, v_uv + stepv * 1.384615).rgb * 0.316216;
  c += texture(u_src, v_uv - stepv * 1.384615).rgb * 0.316216;
  c += texture(u_src, v_uv + stepv * 3.230769).rgb * 0.070270;
  c += texture(u_src, v_uv - stepv * 3.230769).rgb * 0.070270;
  o = vec4(c, 1.0);
}`;

const COMBINE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform sampler2D u_bloom;
uniform float u_bloomAmt;
uniform float u_chroma;
uniform float u_grain;
uniform float u_time;
uniform float u_vignette;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = v_uv;
  vec2 off = (uv - 0.5) * u_chroma * 0.012;
  vec3 base;
  base.r = texture(u_src, uv + off).r;
  base.g = texture(u_src, uv).g;
  base.b = texture(u_src, uv - off).b;
  vec3 bloom = texture(u_bloom, uv).rgb;
  vec3 col = base + bloom * u_bloomAmt;
  float g = (hash(uv * vec2(1920.0, 1080.0) + u_time) - 0.5) * u_grain;
  col += g;
  float v = 1.0 - u_vignette * pow(length(uv - 0.5) * 1.45, 2.2);
  col *= v;
  col = col / (col + vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader alloc");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "compile fail");
  }
  return s;
}

function program(gl, fs) {
  const p = gl.createProgram();
  if (!p) throw new Error("program alloc");
  const v = compile(gl, gl.VERTEX_SHADER, VERT);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, "a_pos");
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "link fail");
  }
  return p;
}

function makeTarget(gl, w, h) {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("fbo alloc");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

export function createGlPost(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  let extractP, blurP, combineP;
  try {
    extractP = program(gl, EXTRACT);
    blurP = program(gl, BLUR);
    combineP = program(gl, COMBINE);
  } catch {
    return null;
  }

  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const srcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let w = Math.max(2, canvas.width);
  let h = Math.max(2, canvas.height);
  let bw = Math.max(2, Math.floor(w / 2));
  let bh = Math.max(2, Math.floor(h / 2));
  let bright = makeTarget(gl, bw, bh);
  let ping = makeTarget(gl, bw, bh);
  let pong = makeTarget(gl, bw, bh);

  const loc = {
    extractSrc: gl.getUniformLocation(extractP, "u_src"),
    extractThresh: gl.getUniformLocation(extractP, "u_thresh"),
    blurSrc: gl.getUniformLocation(blurP, "u_src"),
    blurDir: gl.getUniformLocation(blurP, "u_dir"),
    blurTexel: gl.getUniformLocation(blurP, "u_texel"),
    cSrc: gl.getUniformLocation(combineP, "u_src"),
    cBloom: gl.getUniformLocation(combineP, "u_bloom"),
    cAmt: gl.getUniformLocation(combineP, "u_bloomAmt"),
    cChroma: gl.getUniformLocation(combineP, "u_chroma"),
    cGrain: gl.getUniformLocation(combineP, "u_grain"),
    cTime: gl.getUniformLocation(combineP, "u_time"),
    cVig: gl.getUniformLocation(combineP, "u_vignette"),
  };

  function rebuild(nw, nh) {
    w = Math.max(2, nw); h = Math.max(2, nh);
    bw = Math.max(2, Math.floor(w / 2)); bh = Math.max(2, Math.floor(h / 2));
    gl.deleteTexture(bright.tex); gl.deleteFramebuffer(bright.fbo);
    gl.deleteTexture(ping.tex); gl.deleteFramebuffer(ping.fbo);
    gl.deleteTexture(pong.tex); gl.deleteFramebuffer(pong.fbo);
    bright = makeTarget(gl, bw, bh);
    ping = makeTarget(gl, bw, bh);
    pong = makeTarget(gl, bw, bh);
  }

  function drawQuad() {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    resize(nw, nh) { canvas.width = nw; canvas.height = nh; rebuild(nw, nh); },
    composite(srcCanvas, controls, timeSec) {
      if (srcCanvas.width !== w || srcCanvas.height !== h) {
        rebuild(srcCanvas.width, srcCanvas.height);
        canvas.width = srcCanvas.width;
        canvas.height = srcCanvas.height;
      }
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);

      gl.viewport(0, 0, bw, bh);
      gl.useProgram(extractP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bright.fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(loc.extractSrc, 0);
      gl.uniform1f(loc.extractThresh, 0.42);
      drawQuad();

      gl.useProgram(blurP);
      gl.uniform1i(loc.blurSrc, 0);
      gl.uniform2f(loc.blurTexel, 1 / bw, 1 / bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, ping.fbo);
      gl.bindTexture(gl.TEXTURE_2D, bright.tex);
      gl.uniform2f(loc.blurDir, 1, 0);
      drawQuad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pong.fbo);
      gl.bindTexture(gl.TEXTURE_2D, ping.tex);
      gl.uniform2f(loc.blurDir, 0, 1);
      drawQuad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, ping.fbo);
      gl.bindTexture(gl.TEXTURE_2D, pong.tex);
      gl.uniform2f(loc.blurDir, 1.6, 0);
      drawQuad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pong.fbo);
      gl.bindTexture(gl.TEXTURE_2D, ping.tex);
      gl.uniform2f(loc.blurDir, 0, 1.6);
      drawQuad();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(combineP);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(loc.cSrc, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pong.tex);
      gl.uniform1i(loc.cBloom, 1);
      gl.uniform1f(loc.cAmt, controls.bloom);
      gl.uniform1f(loc.cChroma, controls.chroma);
      gl.uniform1f(loc.cGrain, controls.grain);
      gl.uniform1f(loc.cTime, timeSec);
      gl.uniform1f(loc.cVig, controls.vignette);
      drawQuad();
    },
    destroy() {
      gl.deleteProgram(extractP);
      gl.deleteProgram(blurP);
      gl.deleteProgram(combineP);
    },
  };
}
