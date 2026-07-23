ALTER TABLE model_configs
  ADD COLUMN IF NOT EXISTS input_price_per_mtok NUMERIC NOT NULL DEFAULT 0.5 CHECK (input_price_per_mtok >= 0),
  ADD COLUMN IF NOT EXISTS output_price_per_mtok NUMERIC NOT NULL DEFAULT 3 CHECK (output_price_per_mtok >= 0);

-- Preserve the pricing behavior that existed before prices moved into model_configs.
UPDATE model_configs
SET input_price_per_mtok = CASE
      WHEN lower(id) LIKE 'gemini-3-flash%' OR lower(id) LIKE 'gemini-2.5-flash%' OR lower(id) LIKE 'gpt-4o-mini%' THEN 0.15
      WHEN lower(id) LIKE 'gemini-3.1-pro%' OR lower(id) LIKE 'gemini-2.5-pro%' THEN 1.25
      WHEN lower(id) LIKE 'gpt-5.2%' THEN 1.75
      WHEN lower(id) LIKE 'gpt-4o%' THEN 2.5
      WHEN lower(id) LIKE 'claude-sonnet%' THEN 3
      WHEN lower(id) LIKE 'claude-haiku%' THEN 0.8
      ELSE input_price_per_mtok
    END,
    output_price_per_mtok = CASE
      WHEN lower(id) LIKE 'gemini-3-flash%' OR lower(id) LIKE 'gemini-2.5-flash%' OR lower(id) LIKE 'gpt-4o-mini%' THEN 0.6
      WHEN lower(id) LIKE 'gemini-3.1-pro%' THEN 5
      WHEN lower(id) LIKE 'gemini-2.5-pro%' OR lower(id) LIKE 'gpt-4o%' THEN 10
      WHEN lower(id) LIKE 'gpt-5.2%' THEN 14
      WHEN lower(id) LIKE 'claude-sonnet%' THEN 15
      WHEN lower(id) LIKE 'claude-haiku%' THEN 4
      ELSE output_price_per_mtok
    END;

COMMENT ON COLUMN model_configs.input_price_per_mtok IS
  'USD cost per one million input tokens used by Credits metering';
COMMENT ON COLUMN model_configs.output_price_per_mtok IS
  'USD cost per one million output tokens used by Credits metering';
