"# Taline Chehoury Portfolio

Static portfolio and browser-based admin studio, deployed from `dist/` on Vercel. The studio uses Supabase Auth, Postgres, and Storage; it does not require a framework, build step, or code editing to manage the site.

## Admin dashboard

Open `/admin/` on the deployed site. Admins can:

- Edit the site name, search title and description, hero, selected-work introduction, biography, skills, and contact details.
- Add, edit, delete, and drag to reorder projects, including descriptions, contribution details, dark/light presentation, and up to six images per project.
- Upload and reuse project images from Supabase Storage.
- Browse and preview all 31 images already included in the portfolio, and select them directly in the project editor.
- Choose one of four design presets, customize colors, and hide or show site sections.
- Save drafts automatically and publish by committing the selected content to GitHub; Vercel deploys the production branch.

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
5. Sign in at `/admin/`. The studio imports the existing portfolio into a draft the first time. Edit, wait until the save indicator says **All changes saved**, and select **Publish changes**. Changes are published to Supabase immediately so visitors can see them. Once the GitHub publisher is configured, the same action also commits `dist/portfolio-content.json` to GitHub and Vercel deploys it from the production branch. The dashboard reports separately if the live update succeeded but the GitHub commit did not.

## GitHub publishing setup

Publishing makes a real commit to the Vercel-connected GitHub repository. GitHub credentials are kept in Supabase Edge Function secrets and never sent to the browser.

1. In GitHub, create a **fine-grained personal access token** restricted to this one repository. Grant **Contents: Read and write** (and the default Metadata read access). Do not paste this token into chat, the site code, or GitHub.
2. Install and sign in to the [Supabase CLI](https://supabase.com/docs/guides/cli), then deploy the server-side publisher from the repository root:

   ```powershell
   supabase login
   supabase functions deploy publish-portfolio --project-ref zqohztxxtqytrysbhzfe
   ```

3. In **Supabase → Edge Functions → Secrets**, add:

   | Secret | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | The fine-grained GitHub token from step 1 |
   | `GITHUB_REPOSITORY` | GitHub owner and repository, e.g. `taline/name-of-repo` |
   | `GITHUB_BRANCH` | The production branch in **Vercel → Project Settings → Git → Production Branch** |
   | `PORTFOLIO_ORIGIN` | `https://taline-chehoury-portfolio.vercel.app` |

4. Confirm that Vercel is connected to the same GitHub repository and automatically deploys commits to that production branch.
5. Publish from `/admin/`. A successful GitHub publish displays a link to the commit. Supabase makes the content live immediately; the public site uses that published content first and the committed JSON as a fallback.

If you do not know the GitHub repository name or production branch, find them in the Vercel project settings before adding the function secrets. The dashboard deliberately cannot commit directly from browser code because that would expose the GitHub write token.

## Credential safety

Keep database passwords, secret/service-role keys, and JWT signing secrets private. If any privileged credential is exposed in a chat, log, or repository, rotate or revoke it in Supabase. Do not add privileged credentials to this repository. The admin studio only needs the project URL and publishable key in its public browser configuration.

## Local preview

Serve `dist/` over HTTP (rather than opening `index.html` as a `file://` URL), then visit `/admin/`. The Supabase database setup and an authorized admin account are still required to sign in and save content."
