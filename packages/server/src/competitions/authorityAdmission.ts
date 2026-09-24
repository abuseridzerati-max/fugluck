import { performance } from 'node:perf_hooks';
import type { MatchmakingSocket } from '../matchmaking/socketAuth';

export const ADMISSION_SAMPLE_COUNT = 20;
export const ADMISSION_P95_LIMIT_MS = 100;
export const ADMISSION_JITTER_LIMIT_MS = 30;

export function admissionSummary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const complete = sorted.length === ADMISSION_SAMPLE_COUNT && sorted.every(v => Number.isFinite(v) && v >= 0);
  const p95RttMs = complete ? sorted[18] : null;
  const medianRttMs = complete ? sorted[9] : null;
  const jitterMs = p95RttMs === null || medianRttMs === null ? null : p95RttMs - medianRttMs;
  return { sampleCount: sorted.length, p95RttMs, medianRttMs, jitterMs,
    accepted: complete && p95RttMs! <= ADMISSION_P95_LIMIT_MS && jitterMs! <= ADMISSION_JITTER_LIMIT_MS };
}

/** Fresh server-clock socket RTT at readiness. No database dependency or client timestamp. */
export function measureAdmission(socket: Pick<MatchmakingSocket, 'timeout' | 'once' | 'off' | 'connected'>) {
  return new Promise<ReturnType<typeof admissionSummary>>(resolve => {
    const samples: number[] = [];
    let sent = 0, finished = false;
    const done = () => {
      if (finished) return;
      finished = true; clearInterval(probes); clearTimeout(timeout);
      socket.off('disconnect', done);
      resolve(admissionSummary(samples));
    };
    const probes = setInterval(() => {
      if (sent++ >= ADMISSION_SAMPLE_COUNT) return;
      const began = performance.now();
      let acknowledged = false;
      // Socket.IO also expires its acknowledgement callback when a client
      // never responds, so repeated sessions cannot accumulate pending acks.
      socket.timeout(1500).emit('authority:probe', (error: Error | null) => {
        if (error || finished || acknowledged) return;
        acknowledged = true; samples.push(performance.now() - began);
        if (samples.length === ADMISSION_SAMPLE_COUNT) done();
      });
    }, 250);
    const timeout = setTimeout(done, 6500);
    socket.once('disconnect', done);
    if (!socket.connected) done();
  });
}
