// Result ownership and casual result boundary checks. Prize competitions use
// durable Level 3 authority decisions; client scores cannot settle them.
import { lifecycleEngine, CompetitionLifecycleError } from "../packages/server/src/competitions/lifecycleEngine.ts";
import { determineDisconnectOutcome, determineMatchOutcome } from "../packages/server/src/validation/matchOutcome.ts";
import type { SidedSubmission } from "../packages/server/src/validation/matchOutcome.ts";

let passed = 0, failed = 0;
function check(label: string, ok: boolean) { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`); if (ok) passed++; else failed++; }
const report = (score: number): SidedSubmission => ({ score });

console.log("Result ownership and casual-score boundary check\n");
void (async () => {
  try {
    await lifecycleEngine.submitScore({ instanceId: "fixture", userId: "user", score: 999999 });
    check("legacy competition score submission is rejected", false);
  } catch (error) {
    check("legacy competition score submission requires live authority", error instanceof CompetitionLifecycleError && error.code === "LIVE_AUTHORITY_REQUIRED");
  }

  const higher = report(42), lower = report(17), same = report(42);
  const unequal = determineMatchOutcome(higher, lower);
  check("higher casual report wins only a non-prize casual result", unequal.a === "win" && unequal.b === "loss");
  const tie = determineMatchOutcome(higher, same);
  check("equal casual reports resolve as a draw", tie.a === "draw" && tie.b === "draw");
  const clientReported = determineMatchOutcome(report(999999), lower);
  check("casual comparison remains non-authoritative and separate from TEST GEL competitions", clientReported.a === "win" && clientReported.b === "loss");
  const absent = determineMatchOutcome(null, null);
  check("two missing casual results void without a winner", absent.a === "void" && absent.b === "void");
  const absentA = determineMatchOutcome(null, lower);
  check("one absent casual result does not invent an opposing score", absentA.a === "loss" && absentA.b === "win");
  const absentB = determineMatchOutcome(higher, null);
  check("the remaining casual submission is compared consistently", absentB.a === "win" && absentB.b === "loss");
  const disconnectNoReport = determineDisconnectOutcome(null);
  check("disconnect while both are playing does not produce a draw escape", disconnectNoReport.a === "loss" && disconnectNoReport.b === "win");
  const disconnectWithReport = determineDisconnectOutcome(lower);
  check("disconnect outcome respects remaining casual result", disconnectWithReport.a === "loss" && disconnectWithReport.b === "win");
  const triviaPrimary = determineMatchOutcome({ score: 1, correctCount: 4, totalResponseTicks: 50 }, { score: 99, correctCount: 3, totalResponseTicks: 20 });
  check("trivia correct-answer count remains the primary casual ranking", triviaPrimary.a === "win" && triviaPrimary.b === "loss");
  const triviaSpeed = determineMatchOutcome({ score: 1, correctCount: 4, totalResponseTicks: 40 }, { score: 99, correctCount: 4, totalResponseTicks: 50 });
  check("trivia aggregate response time remains its tie breaker", triviaSpeed.a === "win" && triviaSpeed.b === "loss");
  const triviaDraw = determineMatchOutcome({ score: 1, correctCount: 4, totalResponseTicks: 40 }, { score: 1, correctCount: 4, totalResponseTicks: 40 });
  check("equal trivia metrics resolve as a draw", triviaDraw.a === "draw" && triviaDraw.b === "draw");

  console.log(`\nResult ownership check: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
})();
