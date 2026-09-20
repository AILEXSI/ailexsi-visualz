/** Deterministic isolated tests for wave-history core (no canvas / no LEXI). */
import { describe, expect, it } from "vitest";
import {
  SR, FFT_SIZE, HOP, BANDS, HISTORY, ATTACK_SEC, RELEASE_SEC,
  normalizeBands, createRing, pushRing, ringRow, analyzePcmToRing, bandIndexForHz,
} from "./wave-core";
import { pcmSinus, pcmKick, pcmBassSweep, pcmHighTransients } from "./pcm-signals";

describe("wave-core-fft-v2-tested", () => {
  it("ports the prototype suite at 43/43", () => {
    let passed = 0, failed = 0;
    const results: { name: string; ok: boolean; detail: string }[] = [];

    function ok(name: string, cond: boolean, detail = "") {
      if (cond) { passed++; results.push({ name, ok: true, detail }); }
      else { failed++; results.push({ name, ok: false, detail }); }
    }

    function peakBand(row: Float32Array) {
      let b = 0, v = -1;
      for (let i = 0; i < row.length; i++) if (row[i]! > v) { v = row[i]!; b = i; }
      return { b, v };
    }

    function bassEnergy(row: Float32Array, maxB = 8) {
      let s = 0;
      for (let i = 0; i <= maxB; i++) s += row[i] ?? 0;
      return s;
    }

    function assertFiniteRing(ring: ReturnType<typeof analyzePcmToRing>, label: string) {
      let finite = true;
      for (let a = 0; a < ring.count; a++) {
        const row = ringRow(ring, a);
        for (let i = 0; i < BANDS; i++) if (!Number.isFinite(row[i]!)) finite = false;
      }
      ok(label + " finite", finite);
    }

    // --- Silence ---
    {
      const pcm = new Float32Array(SR * 2);
      const ring = analyzePcmToRing(pcm);
      ok("silence ring capacity HISTORY", ring.rows.length === HISTORY, `rows=${ring.rows.length}`);
      let allZero = true;
      for (let a = 0; a < ring.count; a++) {
        const row = ringRow(ring, a);
        for (let i = 0; i < BANDS; i++) if (row[i] !== 0) allZero = false;
      }
      assertFiniteRing(ring, "silence");
      ok("silence all zeros", allZero, `count=${ring.count}`);
    }

    // --- Normalize / clamp extremes ---
    {
      const z = normalizeBands(new Float32Array(BANDS));
      ok("normalize silence zeros", [...z].every((v) => v === 0 && Number.isFinite(v)));
      const huge = new Float32Array(BANDS); huge[10] = 1e9; huge[20] = 5e8;
      const n = normalizeBands(huge);
      ok("normalize huge finite 0..1", [...n].every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
      ok("normalize peak ~1 at max bin", Math.abs(n[10]! - 1) < 1e-6, `n10=${n[10]}`);
      const neg = new Float32Array(BANDS); neg[0] = -5; neg[1] = 2;
      const nn = normalizeBands(neg);
      ok("normalize with negatives finite >=0", [...nn].every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
    }

    // --- Known sinus band ---
    {
      const f = 220;
      const expectBand = bandIndexForHz(f);
      const ring = analyzePcmToRing(pcmSinus(3.2, f));
      assertFiniteRing(ring, "sinus220");
      const { b, v } = peakBand(ringRow(ring, 0));
      ok("sinus220 peak near expected band", Math.abs(b - expectBand) <= 1, `peak=${b} expect=${expectBand} v=${v.toFixed(3)}`);
      ok("sinus220 peak strong", v > 0.7, `v=${v}`);
      const local = ringRow(ring, 0)[Math.max(0, b - 1)]! + ringRow(ring, 0)[b]! + ringRow(ring, 0)[Math.min(BANDS - 1, b + 1)]!;
      const far = ringRow(ring, 0)[Math.min(BANDS - 1, b + 30)]! + ringRow(ring, 0)[Math.min(BANDS - 1, b + 40)]!;
      ok("sinus220 narrow ridge", local > far * 5, `local=${local.toFixed(3)} far=${far.toFixed(3)}`);
    }

    // --- Two sinus frequencies ---
    {
      const fA = 220, fB = 880;
      const eA = bandIndexForHz(fA), eB = bandIndexForHz(fB);
      ok("expected bands differ", eA !== eB && eB > eA, `eA=${eA} eB=${eB}`);
      const pA = peakBand(ringRow(analyzePcmToRing(pcmSinus(3.2, fA)), 0)).b;
      const pB = peakBand(ringRow(analyzePcmToRing(pcmSinus(3.2, fB)), 0)).b;
      ok("measured bands differ", pA !== pB && pB > pA, `pA=${pA} pB=${pB}`);
      ok("220 band correct", Math.abs(pA - eA) <= 1, `pA=${pA} eA=${eA}`);
      ok("880 band correct", Math.abs(pB - eB) <= 2, `pB=${pB} eB=${eB}`);
    }

    // --- Bass sweep monotonic in time ---
    {
      const ring = analyzePcmToRing(pcmBassSweep(3.2));
      assertFiniteRing(ring, "sweep");
      const ages = [80, 60, 40, 20, 0];
      const peaks = ages.map((a) => peakBand(ringRow(ring, a)).b);
      let mono = true;
      for (let i = 1; i < peaks.length; i++) if (peaks[i]! < peaks[i - 1]! - 1) mono = false;
      ok("sweep peak rises toward newer rows", mono && peaks[peaks.length - 1]! > peaks[0]! + 3,
        `peaks@${ages}=[${peaks.join(",")}]`);
    }

    // --- Kick bass + decay ---
    {
      const ring = analyzePcmToRing(pcmKick(3.2));
      assertFiniteRing(ring, "kick");
      let bestA = 0, bestE = -1;
      for (let a = 0; a < Math.min(HISTORY, ring.count); a++) {
        const e = bassEnergy(ringRow(ring, a), 6);
        if (e > bestE) { bestE = e; bestA = a; }
      }
      const { b } = peakBand(ringRow(ring, bestA));
      ok("kick peak in bass bands", b <= 8, `peakBand=${b} age=${bestA} bassE=${bestE.toFixed(3)}`);
      ok("kick bass energy significant", bestE > 0.5, `bassE=${bestE}`);
      const eFar = bassEnergy(ringRow(ring, Math.min(HISTORY - 1, bestA + 40)), 6);
      ok("kick far history quieter than peak", eFar < bestE * 0.85,
        `bestE=${bestE.toFixed(3)} eFar=${eFar.toFixed(3)} bestA=${bestA}`);
      const hopSec = HOP / SR;
      ok("release constant 0.35", RELEASE_SEC === 0.35, `R=${RELEASE_SEC}`);
      ok("history spans > 2*release", HISTORY * hopSec > RELEASE_SEC * 2, `span=${(HISTORY * hopSec).toFixed(2)}s`);
    }

    // --- Highs separated peaks ---
    {
      const ring = analyzePcmToRing(pcmHighTransients(3.2));
      assertFiniteRing(ring, "highs");
      // Use high-band energy (70..) — global mean is tiny because most bands stay dark.
      function highE(row: Float32Array) { let s = 0; for (let i = 70; i < BANDS; i++) s += row[i] ?? 0; return s; }
      const series: number[] = [];
      for (let a = 0; a < Math.min(HISTORY, ring.count); a++) series.push(highE(ringRow(ring, a)));
      const maxM = Math.max(...series), minM = Math.min(...series);
      ok("highs temporal dynamic range", maxM > minM * 3 + 0.05, `max=${maxM.toFixed(3)} min=${minM.toFixed(3)}`);
      const peakAges: number[] = [];
      for (let a = 1; a < series.length - 1; a++) {
        if (series[a]! > 0.35 && series[a]! >= series[a - 1]! && series[a]! >= series[a + 1]!) peakAges.push(a);
      }
      ok("highs multiple temporal peaks", peakAges.length >= 2, `n=${peakAges.length} @ ${peakAges.slice(0, 8)}`);
      if (peakAges.length >= 2) {
        const a0 = peakAges[0]!, a1 = peakAges[1]!;
        const mid = Math.floor((a0 + a1) / 2);
        ok("highs gap between events", series[mid]! < Math.min(series[a0]!, series[a1]!) * 0.75,
          `m0=${series[a0]!.toFixed(3)} mid=${series[mid]!.toFixed(3)} m1=${series[a1]!.toFixed(3)}`);
      }
      let loudA = 0;
      for (let a = 0; a < series.length; a++) if (series[a]! > series[loudA]!) loudA = a;
      const loud = ringRow(ring, loudA);
      const low = bassEnergy(loud, 10);
      const high = highE(loud);
      ok("highs energy on right bands", high > low, `high=${high.toFixed(3)} low=${low.toFixed(3)} age=${loudA}`);
    }

    // --- Ring wrap ---
    {
      const ring = createRing();
      ok("ring has HISTORY rows", ring.rows.length === HISTORY);
      for (let i = 0; i < HISTORY + 40; i++) {
        const row = new Float32Array(BANDS);
        row[0] = i + 1;
        pushRing(ring, row);
      }
      ok("ring count capped at 96", ring.count === HISTORY, `count=${ring.count}`);
      ok("ring newest marker", ringRow(ring, 0)[0] === HISTORY + 40, `got=${ringRow(ring, 0)[0]}`);
      ok("ring age1 marker", ringRow(ring, 1)[0] === HISTORY + 39, `got=${ringRow(ring, 1)[0]}`);
      ok("ring oldest marker", ringRow(ring, HISTORY - 1)[0] === 41, `got=${ringRow(ring, HISTORY - 1)[0]}`);
      let ordered = true;
      for (let a = 0; a < HISTORY - 1; a++) {
        if (!(ringRow(ring, a)[0]! > ringRow(ring, a + 1)[0]!)) ordered = false;
      }
      ok("ring wrap temporal order", ordered);
    }

    // --- Determinism ---
    {
      const pcm = pcmSinus(3.2, 220);
      const r1 = analyzePcmToRing(pcm);
      const r2 = analyzePcmToRing(pcm);
      let same = r1.count === r2.count;
      for (let a = 0; a < r1.count && same; a++) {
        const a1 = ringRow(r1, a), a2 = ringRow(r2, a);
        for (let b = 0; b < BANDS; b++) if (a1[b] !== a2[b]) same = false;
      }
      ok("identical PCM → identical history", same);
      const r3 = analyzePcmToRing(pcmSinus(3.2, 220));
      let same2 = r1.count === r3.count;
      for (let a = 0; a < r1.count && same2; a++) {
        const a1 = ringRow(r1, a), a3 = ringRow(r3, a);
        for (let b = 0; b < BANDS; b++) if (a1[b] !== a3[b]) same2 = false;
      }
      ok("fresh identical PCM still deterministic", same2);
    }

    // --- Meta constants ---
    ok("FFT_SIZE 2048", FFT_SIZE === 2048);
    ok("BANDS 96", BANDS === 96);
    ok("HISTORY 96", HISTORY === 96);
    ok("ATTACK 0.08", ATTACK_SEC === 0.08);
    ok("RELEASE 0.35", RELEASE_SEC === 0.35);
    ok("HOP 512", HOP === 512);
    ok("SR 44100", SR === 44100);

    const fails = results.filter((r) => !r.ok);
    expect(fails, fails.map((f) => `${f.name} :: ${f.detail}`).join(" | ")).toEqual([]);
    expect(passed).toBe(43);
    expect(failed).toBe(0);
    expect(passed + failed).toBe(43);
  });
});
