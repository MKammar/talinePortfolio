"# Taline Chehoury Portfolio

Static portfolio and browser-based admin studio, deployed from `dist/` on Vercel. The studio uses Supabase Auth, Postgres, and Storage; it does not require a framework, build step, or code editing to manage the site.

## Admin dashboard

Open `/admin/` on the deployed site. Admins can:

- Edit the site name, search title and description, hero, selected-work introduction, biography, skills, and contact details.
- Add, edit, delete, and drag to reorder projects, including descriptions, contribution details, dark/light presentation, and up to six images per project.
- Upload and reuse project images from Supabase Storage.
- Choose one of four design presets, customize colors, and hide or show site sections.
- Save drafts automatically and publish the selected version to the public portfolio.

The admin page has no public sign-up form. Only Supabase accounts explicitly listed in `public.portfolio_admins` can edit or publish content.

## One-time Supabase setup

1. In the Supabase dashboard for this project, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the content tables, access policies, admin check, and public image bucket.
2. In **Authentication → Users**, create the admin account with an email and password.
3. Copy that user's **UUID** from the Users page. In SQL Editor, run the following, replacing the example UUID with the copied UUID:

   ```sql
   insert into public.portfolio_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

4. Deploy the repository to Vercel. The browser configuration in [`dist/assets/supabase-config.js`](./dist/assets/supabase-config.js) contains only the Supabase project URL and **publishable** key; those are intended to be public. Never put a Supabase secret key, service-role key, database password, or JWT signing secret in this file or any browser code.
5. Sign in at `/admin/`. The studio imports the existing portfolio into a draft the first time. Edit, wait until the save indicator says **All changes saved**, and select **Publish changes** to make it public.

## Credential safety

Keep database passwords, secret/service-role keys, and JWT signing secrets private. If any privileged credential is exposed in a chat, log, or repository, rotate or revoke it in Supabase. Do not add privileged credentials to this repository. The admin studio only needs the project URL and publishable key in its public browser configuration.

## Local preview

Serve `dist/` over HTTP (rather than opening `index.html` as a `file://` URL), then visit `/admin/`. The Supabase database setup and an authorized admin account are still required to sign in and save content."
