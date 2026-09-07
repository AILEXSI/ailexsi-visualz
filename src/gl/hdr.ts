/**
 * HDR render-target probe. Never assume RGBA16F works.
 * Returns RGBA8 fallback when EXT_color_buffer_float is missing
 * or the test FBO is incomplete.
 */

export type HdrFormat = {
  hdr: boolean;
  internalFormat: number;
  format: number;
  type: number;
  label: "RGBA16F" | "RGBA8";
};

export type GlProbe = {
  getExtension(name: string): unknown;
  RGBA: number;
  RGBA8: number;
  RGBA16F?: number;
  UNSIGNED_BYTE: number;
  HALF_FLOAT?: number;
  FLOAT?: number;
};

export function chooseHdrFormat(gl: GlProbe): HdrFormat {
  const rgba = gl.RGBA;
  const byte = gl.UNSIGNED_BYTE;
  const fallback: HdrFormat = {
    hdr: false,
    internalFormat: gl.RGBA8 ?? 0x8058,
    format: rgba,
    type: byte,
    label: "RGBA8",
  };

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) return fallback;
  if (gl.RGBA16F == null || gl.HALF_FLOAT == null) return fallback;

  return {
    hdr: true,
    internalFormat: gl.RGBA16F,
    format: rgba,
    type: gl.HALF_FLOAT,
    label: "RGBA16F",
  };
}

export function framebufferIsComplete(gl: {
  checkFramebufferStatus(target: number): number;
  FRAMEBUFFER: number;
  FRAMEBUFFER_COMPLETE: number;
}): boolean {
  return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
}
