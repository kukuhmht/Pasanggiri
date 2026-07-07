-- Pasanggiri SaaS — Initial Schema
-- Run via Supabase Dashboard → SQL Editor

-- ====================== ORGANIZATIONS ======================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'expired')),
  berlaku_hingga DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================== MEMBERSHIPS ======================
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- ====================== EVENTS ======================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  subjudul TEXT DEFAULT '',
  tahun INT NOT NULL DEFAULT 2026,
  prefix TEXT NOT NULL DEFAULT 'EVT',
  slug TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ====================== KONTINGEN ======================
CREATE TABLE IF NOT EXISTS kontingen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  kode TEXT NOT NULL,
  UNIQUE(event_id, kode)
);

-- ====================== PESERTA ======================
CREATE TABLE IF NOT EXISTS peserta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  no_urut TEXT NOT NULL,
  kategori TEXT NOT NULL,
  golongan TEXT NOT NULL,
  kontingen_id UUID REFERENCES kontingen(id) ON DELETE SET NULL,
  anggota JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, no_urut)
);

-- ====================== GELANGGANG ======================
CREATE TABLE IF NOT EXISTS gelanggang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  peserta_aktif_id UUID REFERENCES peserta(id) ON DELETE SET NULL,
  antrian JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================== AKSES JURI (PIN) ======================
CREATE TABLE IF NOT EXISTS akses_juri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  keterangan TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  berlaku_hingga DATE,
  terakhir_dipakai TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================== PENILAIAN ======================
CREATE TABLE IF NOT EXISTS penilaian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  peserta_id UUID NOT NULL REFERENCES peserta(id) ON DELETE CASCADE,
  posisi_juri TEXT NOT NULL,
  nama_juri TEXT NOT NULL,
  nilai JSONB NOT NULL DEFAULT '{}',
  waktu_detik INT NOT NULL DEFAULT 0,
  keluar_gelanggang INT NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, peserta_id, posisi_juri)
);

-- ====================== ROW LEVEL SECURITY ======================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE gelanggang ENABLE ROW LEVEL SECURITY;
ALTER TABLE akses_juri ENABLE ROW LEVEL SECURITY;
ALTER TABLE penilaian ENABLE ROW LEVEL SECURITY;

-- Organizations: user sees own org
CREATE POLICY "org_member_select" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Memberships: user sees own memberships
CREATE POLICY "membership_select" ON memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "membership_insert" ON memberships
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND role = 'owner')
    OR user_id = auth.uid()
  );

-- Events: visible to org members + public
CREATE POLICY "events_member_select" ON events
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    OR is_public = true
  );

CREATE POLICY "events_member_all" ON events
  FOR ALL USING (
    org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
  );

-- Kontingen: same as events
CREATE POLICY "kontingen_access" ON kontingen
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  );

-- Allow public read for kontingen (for registration)
CREATE POLICY "kontingen_public_read" ON kontingen
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

-- Peserta: org members can manage, public can read & insert (for registration)
CREATE POLICY "peserta_member" ON peserta
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  );

CREATE POLICY "peserta_public_insert" ON peserta
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

CREATE POLICY "peserta_public_read" ON peserta
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

-- Gelanggang
CREATE POLICY "gelanggang_access" ON gelanggang
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  );

-- Penilaian
CREATE POLICY "penilaian_access" ON penilaian
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  );

CREATE POLICY "penilaian_public_read" ON penilaian
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE is_public = true)
  );

-- Akses Juri
CREATE POLICY "akses_juri_access" ON akses_juri
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  );

-- ====================== INDEXES ======================
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_events_org ON events(org_id);
CREATE INDEX idx_peserta_event ON peserta(event_id);
CREATE INDEX idx_penilaian_event ON penilaian(event_id);
CREATE INDEX idx_penilaian_peserta ON penilaian(peserta_id);
