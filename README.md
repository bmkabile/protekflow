# ProtekFlow patch: password reset, signup fix, security lockdown

Copy these files over the same paths in the repo (nothing else changes), then:

1. **Create `.env.local`** from `.env.local.example`. Paste the anon key and service role key from
   Supabase Dashboard -> Project Settings -> API. Restart `npm run dev` after saving.
2. **Run the SQL** in order in the Supabase SQL Editor: 001, 002, 003, 004, 005.
3. **Supabase Dashboard -> Authentication -> URL Configuration**
   - Site URL: your production URL (http://localhost:3000 while testing)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
4. **(Recommended) Authentication -> Email Templates -> Reset Password**: change the link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
   so reset links also work when opened on a different device or browser.
5. **Authentication -> SMTP Settings**: add a real SMTP provider before launch. Supabase's built-in
   mailer is heavily rate limited and is for testing only.
6. Delete `proxy.ts` from the repo root (stale duplicate of `src/middleware.ts`).
