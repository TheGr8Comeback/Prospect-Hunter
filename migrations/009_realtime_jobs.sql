-- Enable Realtime on the jobs table so the worker gets notified instantly
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
