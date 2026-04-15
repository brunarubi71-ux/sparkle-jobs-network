
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS main_property_photo text,
  ADD COLUMN IF NOT EXISTS door_code text,
  ADD COLUMN IF NOT EXISTS supply_code text,
  ADD COLUMN IF NOT EXISTS lockbox_code text,
  ADD COLUMN IF NOT EXISTS gate_code text,
  ADD COLUMN IF NOT EXISTS alarm_instructions text,
  ADD COLUMN IF NOT EXISTS parking_instructions text,
  ADD COLUMN IF NOT EXISTS number_of_guests integer,
  ADD COLUMN IF NOT EXISTS guest_stay_length integer;
