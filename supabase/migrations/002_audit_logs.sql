-- Audit Logs & Soft Delete for Peserta

ALTER TABLE peserta ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
  entity_type TEXT NOT NULL DEFAULT 'peserta',
  entity_id UUID NOT NULL,
  old_data JSONB DEFAULT NULL,
  new_data JSONB DEFAULT NULL,
  actor_name TEXT NOT NULL,
  actor_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_public_read" ON audit_logs
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

CREATE POLICY "audit_logs_public_insert" ON audit_logs
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

CREATE INDEX idx_audit_logs_event ON audit_logs(event_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_id);
CREATE INDEX idx_peserta_deleted ON peserta(event_id, is_deleted);
