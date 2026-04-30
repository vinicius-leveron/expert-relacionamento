-- Migration: Track async worker touches for journey nurturing/reengagement

ALTER TABLE public.journey_progress
ADD COLUMN IF NOT EXISTS last_nurturing_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reengagement_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.journey_progress.last_nurturing_sent_at IS 'Last time the worker sent the daily nurturing touch';
COMMENT ON COLUMN public.journey_progress.last_reengagement_sent_at IS 'Last time the worker sent an inactivity reengagement touch';
