// Pure frame-time / heap watchdog for the particle scene safety valve
// (see .superpowers/sdd/p2-safety-valve-report.md). Deterministic and
// side-effect free: no Date/performance/rAF calls inside — the caller
// samples once per frame with its own already-measured frameMs/heapMB and
// this module tracks state purely from the sequence of sample() calls, so
// it is fully unit-testable without any timing mocks.
//
// Two independent failure modes, either of which can force a 'kill':
//
// 1. Sustained slow frames — a rolling window of the last `windowSize`
//    frames (spec: 120) tracks how many had frameMs > badFrameMs. Each time
//    that count *rises* above badFrameLimit (edge-triggered — crossing from
//    "not over" to "over", not every sample while over) counts as one
//    "occurrence": the first occurrence returns 'degrade', the second (and
//    every one after) returns/stays 'kill'. Edge-triggering (rather than
//    firing on every sample while the window is over-threshold) is what
//    lets 'degrade' be a single, one-time transition a caller can safely
//    react to (e.g. halve opacity once) instead of re-applying its
//    degrade action every frame. A later occurrence can only happen after
//    the window drops back under the limit (bad frames aged out or frames
//    got healthy again) and then breaches a second time.
//
// 2. Heap growth — the first `checkEvery` heapMB samples establish a
//    baseline (their median, to resist a single early outlier). Once the
//    baseline is set, any later sample whose heapMB exceeds
//    baseline + heapGrowthMB forces an immediate 'kill', independent of
//    frame-time state.
//
// Both 'degrade' and 'kill' are one-way for the guard's lifetime: once
// killed, every subsequent sample() returns 'kill' regardless of input.
export function createBudgetGuard({
	badFrameMs = 80,
	badFrameLimit = 10,
	heapGrowthMB = 300,
	checkEvery = 30,
	windowSize = 120
} = {}) {
	let frameIndex = 0;
	// Queue of frame indices (ascending) at which frameMs > badFrameMs.
	const badFrameHistory = [];
	let overThreshold = false; // current rolling-window "count > badFrameLimit" state
	let occurrences = 0; // number of rising edges of overThreshold seen so far

	let heapSamples = [];
	let heapBaseline = null; // median of the first `checkEvery` heapMB samples, then frozen

	let phase = 'ok'; // 'ok' | 'degraded' | 'killed'

	function median(values) {
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
	}

	function sample({ frameMs, heapMB } = {}) {
		frameIndex++;

		if (phase === 'killed') return 'kill';

		let killedThisCall = false;
		let degradedThisCall = false;

		// --- 1. rolling bad-frame window ---
		if (typeof frameMs === 'number' && frameMs > badFrameMs) {
			badFrameHistory.push(frameIndex);
		}
		// Evict entries older than the window. An entry at frameIndex `f` is
		// still inside the last `windowSize` frames as of the current frame
		// while `frameIndex - f < windowSize`; once that's no longer true it
		// has aged out for good (frames only move forward).
		while (badFrameHistory.length && frameIndex - badFrameHistory[0] >= windowSize) {
			badFrameHistory.shift();
		}
		const isOver = badFrameHistory.length > badFrameLimit;
		if (isOver && !overThreshold) {
			occurrences++;
			if (occurrences === 1 && phase === 'ok') {
				phase = 'degraded';
				degradedThisCall = true;
			} else if (occurrences >= 2) {
				phase = 'killed';
				killedThisCall = true;
			}
		}
		overThreshold = isOver;

		// --- 2. heap growth (independent of frame-time state above) ---
		if (!killedThisCall && typeof heapMB === 'number') {
			if (heapBaseline === null) {
				heapSamples.push(heapMB);
				if (heapSamples.length >= checkEvery) {
					heapBaseline = median(heapSamples);
					heapSamples = null; // no longer needed, drop the reference
				}
			} else if (heapMB - heapBaseline > heapGrowthMB) {
				phase = 'killed';
				killedThisCall = true;
			}
		}

		if (killedThisCall) return 'kill';
		if (degradedThisCall) return 'degrade';
		return 'ok';
	}

	return { sample };
}
