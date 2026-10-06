-- Enable Row Level Security
ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Automation" ENABLE ROW LEVEL SECURITY;

-- Create Policies to scope by homeId
CREATE POLICY device_isolation ON "Device"
  USING ("homeId" = current_setting('app.current_home_id')::text);

CREATE POLICY room_isolation ON "Room"
  USING ("homeId" = current_setting('app.current_home_id')::text);

CREATE POLICY automation_isolation ON "Automation"
  USING ("homeId" = current_setting('app.current_home_id')::text);
