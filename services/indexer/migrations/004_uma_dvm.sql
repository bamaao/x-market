-- Copyright (c) 2026 zouyc zouyccq@gmail.com.
-- All rights reserved.
--
-- Licensed under the Business Source License 1.1 (BSL 1.1).
-- You may not use this file except in compliance with the License.
--
-- Change Date: 2031-01-01
-- On the Change Date, or the fourth anniversary of the first publicly available
-- distribution of the code under the BSL, whichever comes first, the code
-- automatically becomes available under the Apache License 2.0.

-- P2.6 UMA DVM adapter: distinguish arbitration case finalization path
ALTER TABLE arbitration_cases
  ADD COLUMN IF NOT EXISTS arbitration_adapter TEXT NOT NULL DEFAULT 'builtin';

CREATE INDEX IF NOT EXISTS idx_arbitration_adapter ON arbitration_cases(arbitration_adapter);
