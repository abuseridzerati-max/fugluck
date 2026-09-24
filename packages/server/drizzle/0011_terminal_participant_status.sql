-- Correct mutable participant projections of existing terminal decisions.
-- Ledger, receipts, decisions, scores, audits and historical match results are untouched.
-- A void has no competition placement; SUBMITTED remains the existing completed
-- result state and FORFEITED remains a deliberate forfeit's terminal state.
UPDATE competition_participants p SET status='VOIDED', rank=NULL, prize_won_minor=0
FROM competition_instances i
WHERE p.instance_id=i.id AND i.status='VOIDED'
  AND (p.status IS DISTINCT FROM 'VOIDED' OR p.rank IS NOT NULL OR p.prize_won_minor<>0);
--> statement-breakpoint
UPDATE competition_participants p SET status='CANCELLED', rank=NULL, prize_won_minor=0
FROM competition_instances i
WHERE p.instance_id=i.id AND i.status='CANCELLED'
  AND (p.status IS DISTINCT FROM 'CANCELLED' OR p.rank IS NOT NULL OR p.prize_won_minor<>0);
--> statement-breakpoint
UPDATE competition_participants p SET status='SUBMITTED'
FROM competition_instances i
WHERE p.instance_id=i.id AND i.status='SETTLED' AND p.status IN ('REGISTERED','PLAYING','DISCONNECTED');
