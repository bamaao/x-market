-- P2.6 UMA DVM adapter: distinguish arbitration case finalization path
ALTER TABLE arbitration_cases
  ADD COLUMN IF NOT EXISTS arbitration_adapter TEXT NOT NULL DEFAULT 'builtin';

CREATE INDEX IF NOT EXISTS idx_arbitration_adapter ON arbitration_cases(arbitration_adapter);
