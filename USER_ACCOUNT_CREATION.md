# User Account Creation (Step-by-Step)

The currency converter uses a simple, environment-driven login. To create a new user account, you define the username and password in environment variables and then sign in through the login form.

## 1) Prerequisites
- Node.js 18+ installed locally
- Dependencies installed:
  ```bash
  npm install
  ```

## 2) Create your account credentials
1. In the project root, create a `.env.local` file if it doesn't exist.
2. Add your desired login values (replace the example values with your own):
   ```env
   APP_USERNAME=myuser
   APP_PASSWORD=super-secret-password
   # Optional: adjust how long a login session lasts (minutes)
   LOGIN_SESSION_TTL_MINUTES=60
   ```
3. Save the file. These values are read by `server.js` at startup.

## 3) Start the application
```bash
npm run dev
```
The app will start on http://localhost:3000.

## 4) Sign in with your new account
1. Open http://localhost:3000 in your browser.
2. Enter the username and password you set in `.env.local`.
3. Submit the form to create a session. If successful, the currency converter becomes available and your session remains active for the configured TTL.

## 5) Log out (optional)
Use the "Log Out" control in the UI to end the session. You can sign back in anytime with the same credentials.

## Notes and security tips
- If you do not set `APP_USERNAME`/`APP_PASSWORD`, the defaults are `admin` / `password123` (development only). Always override these for real use.
- Keep `.env.local` out of version control to avoid exposing credentials.
- You can rotate credentials at any time by updating `.env.local` and restarting the server.
