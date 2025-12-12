# User Account Creation (Step-by-Step)

The currency converter now uses Supabase-managed authentication. Create users in Supabase (or with the optional `/api/signup` endpoint) and sign in through the login form.

## 1) Prerequisites
- Node.js 18+ installed locally
- Dependencies installed:
  ```bash
  npm install
  ```

## 2) Configure Supabase
1. In the project root, copy `.env.local.example` to `.env.local`.
2. Set your Supabase values:
   ```env
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   # Optional: adjust how long a server session lasts (minutes)
   LOGIN_SESSION_TTL_MINUTES=60
   ```
3. Save the file. These values are read by `server.js` at startup.

## 3) Create a user in Supabase (step-by-step)
1. Go to https://app.supabase.com and open your project.
2. In the left nav, choose **Auth** → **Users**.
3. Click **Add user** (or **Create new user**), then enter the email and password you want to use.
4. Leave "Send confirmation email" unchecked if you want the user active immediately, or keep it checked to require confirmation.
5. Click **Create user** to save.
6. (Optional) You can also create users via API by POSTing to `/api/signup` with `{ "email": "user@example.com", "password": "strong-password" }`.

## 4) Start the application
```bash
npm run dev
```
The app will start on http://localhost:3000.

## 5) Sign in with your Supabase account
1. Open http://localhost:3000 in your browser.
2. Enter the email and password of the Supabase user you created.
3. Submit the form to authenticate via Supabase and create a server session. If successful, the currency converter becomes available and your session remains active for the configured TTL.

## 6) Log out (optional)
Use the "Log Out" control in the UI to end the session. You can sign back in anytime with the same credentials.

## Notes and security tips
- Use strong passwords (12+ characters, mix of upper/lowercase, numbers, and symbols).
- In production, keep the Supabase anon key and any service keys in a secret manager or environment variable tooling. Do not commit secrets.
- Keep `.env.local` out of version control to avoid exposing credentials.
- You can rotate credentials at any time by updating `.env.local` and restarting the server.
- Schema: The app only relies on Supabase Auth's built-in `auth.users` table (email/password). No custom tables are required for login. If you add profile data, create a separate table linked to `auth.users.id`.

## Optional: SQL to create your own username/password table (not required)
Supabase Auth already stores passwords securely. Only use this if you need a custom table (passwords are hashed with bcrypt):

```sql
-- Enable pgcrypto for bcrypt
create extension if not exists pgcrypto;

-- Custom users table with username + bcrypt-hashed password
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (length(username) >= 3),
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- RLS policies (one-row-per-user model)
alter table app_users enable row level security;
create policy "Users can see their own row" on app_users
  for select using (auth.uid() = id);
create policy "Users can update their own row" on app_users
  for update using (auth.uid() = id);

-- Example insert (hashing password with bcrypt)
insert into app_users (username, password_hash)
values ('tabibito', crypt('pmisthekey', gen_salt('bf')));
```

To verify passwords in SQL, compare `password_hash = crypt('plaintext', password_hash)`. In application code, never store or log the plaintext password.
