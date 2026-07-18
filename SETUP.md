# Prospect Hunter — Setup

4 steps, ~15 min. Everything runs in Docker.

## Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- A free **Supabase** project (https://supabase.com).

---

**1. Get the code**
```bash
git clone <your-repo> prospect-hunter
cd prospect-hunter
```

**2. Create the database**
Open **[schema.sql](https://github.com/TheGr8Comeback/Prospect-Hunter/blob/main/schema.sql)**
in your browser, click the copy icon (top-right of the file) to copy all of it,
then in Supabase → **SQL Editor** → **New query** → paste → **Run**.
> ✅ Done once. No connection string to configure. No text editor needed.

**3. Configure your keys**
```bash
cp .env.example .env
```
> This command is silent — no message means it worked.

Open the new `.env` file in a plain text editor:
- **Mac**: `open -e .env`
- **Windows**: `notepad .env`

Replace the 3 placeholder values with your real keys (Supabase → **Settings → API**):
- `NEXT_PUBLIC_SUPABASE_URL` ← Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← anon public
- `SUPABASE_SERVICE_ROLE_KEY` ← service_role (click "Reveal" to see it)

Save (`Cmd+S` / `Ctrl+S`) and close. Nothing else to fill in.

**4. Launch**
```bash
docker compose up --build
```
Wait until you see `Ready on http://localhost:3000`, then open
**http://localhost:3000** — you land straight in the dashboard, no login.

---

To stop: `Ctrl+C`. To restart: `docker compose up`.
After a `git pull`: `docker compose up --build`.

> 🆘 Stuck? **Turn off your VPN** (it breaks Docker), and make sure you're
> inside the project folder when you run the commands.
