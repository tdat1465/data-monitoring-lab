-- Migration: Add PostgreSQL NOTIFY trigger for real-time SSE
-- Run this once in your PostgreSQL database

-- Create function to notify on flights_predictions changes
CREATE OR REPLACE FUNCTION notify_prediction_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'prediction_update',
    json_build_object(
      'flight_key', COALESCE(NEW.flight_key, OLD.flight_key),
      'action', TG_OP,
      'predict_delay_minutes', NEW.predict_delay_minutes,
      'predicted_at', NEW.predicted_at
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT on flights_predictions
DROP TRIGGER IF EXISTS trg_prediction_insert ON flights_predictions;
CREATE TRIGGER trg_prediction_insert
  AFTER INSERT ON flights_predictions
  FOR EACH ROW
  EXECUTE FUNCTION notify_prediction_update();

-- Create trigger for UPDATE on flights_predictions
DROP TRIGGER IF EXISTS trg_prediction_update ON flights_predictions;
CREATE TRIGGER trg_prediction_update
  AFTER UPDATE ON flights_predictions
  FOR EACH ROW
  WHEN (OLD.predict_delay_minutes IS DISTINCT FROM NEW.predict_delay_minutes
     OR OLD.predicted_at IS DISTINCT FROM NEW.predicted_at)
  EXECUTE FUNCTION notify_prediction_update();

-- Also notify on flights_current_snapshot status changes (for real-time status updates)
CREATE OR REPLACE FUNCTION notify_status_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'status_update',
    json_build_object(
      'flight_key', NEW.flight_key,
      'action', 'UPDATE',
      'status_group', NEW.status_group,
      'status_raw', NEW.status_raw,
      'updated_at', NOW()::text
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status updates
DROP TRIGGER IF EXISTS trg_status_update ON flights_current_snapshot;
CREATE TRIGGER trg_status_update
  AFTER UPDATE ON flights_current_snapshot
  FOR EACH ROW
  WHEN (OLD.status_group IS DISTINCT FROM NEW.status_group
     OR OLD.status_raw IS DISTINCT FROM NEW.status_raw)
  EXECUTE FUNCTION notify_status_update();

-- Verify triggers exist
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table IN ('flights_predictions', 'flights_current_snapshot');
