# `social` — UBBW social panel back end

Posts to the UBBW Facebook Page, Instagram and X from `/staff/social`, sends scheduled posts, and pulls
comments, X mentions and DMs into one inbox. Tables, crew API and the photo bucket: `supabase/migrations/0062_social.sql`.

## 1. Database
```
npm run db:migrate      # applies 0062_social.sql
```

## 2. Accounts (owner, by hand)
1. **Facebook Page**: "UB Blockchain Week", created from your personal FB account.
2. **Instagram**: switch it to a Professional (Business) account and link it to the Page (Instagram → Settings → Accounts Center, or Page settings → Linked accounts).
3. **X account** for UBBW.

## 3. Meta app → `FB_PAGE_ID`, `FB_PAGE_TOKEN`, `IG_USER_ID`, `META_APP_SECRET`
1. developers.facebook.com → Create app → **Business**. Add the products **Facebook Login for Business**, **Instagram** (API setup with Facebook login), **Messenger** and **Webhooks**.
2. Graph API Explorer → choose the app → User token with:
   `pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, pages_read_user_content, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages, business_management`
3. Swap it for a long-lived user token (Access Token Debugger → Extend), then `GET /me/accounts`. The Page's `access_token` there **does not expire**, so that's `FB_PAGE_TOKEN`, and its `id` is `FB_PAGE_ID`.
4. `GET /{FB_PAGE_ID}?fields=instagram_business_account` → `IG_USER_ID`.
5. App settings → Basic → App secret → `META_APP_SECRET`.

While the app is in **development mode**, posting, comments and webhooks work for the Page you admin. DMs from the public need
**App Review** (pages_messaging, instagram_manage_messages) plus Business Verification. Until then, only people with a role on the app show up as DMs.

## 4. X → `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` (optional `X_USER_ID`)
developer.x.com, **signed in as the UBBW account** → Project + App → User authentication settings: **Read and write and Direct message**.
Keys and tokens → API Key + Secret, then generate the **Access Token + Secret** (after setting the permission, so they carry it).
Add credits in the Developer Console: the API is pay-per-use. To keep reads cheap, mentions are pulled every 15 minutes and DMs only when someone taps Refresh.

## 5. Secrets + deploy
```
supabase secrets set FB_PAGE_ID=… FB_PAGE_TOKEN=… IG_USER_ID=… META_APP_SECRET=… META_VERIFY_TOKEN=<any random string> \
  X_API_KEY=… X_API_SECRET=… X_ACCESS_TOKEN=… X_ACCESS_SECRET=… SOCIAL_CRON_SECRET=<random 32+ chars>
supabase functions deploy social --no-verify-jwt
```
Accounts without secrets just show "Not connected", so you can start with Meta only.

## 6. Webhook (instant comments and DMs)
Meta app → Webhooks:
- Callback URL: `https://<project-ref>.supabase.co/functions/v1/social`
- Verify token: the same `META_VERIFY_TOKEN`
- **Page**: subscribe to `feed` and `messages`. **Instagram**: `comments` and `messages`.
- Then subscribe the Page to the app: `POST /{FB_PAGE_ID}/subscribed_apps?subscribed_fields=feed,messages` (with the Page token).

Without the webhook, the cron below still pulls comments every 5 minutes.

## 7. Cron (scheduled posts + pull): run once in the Supabase SQL editor
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('<same SOCIAL_CRON_SECRET>', 'social_cron_secret');
select cron.schedule('social-every-minute', '* * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/social',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000)
$$);
```
To stop it: `select cron.unschedule('social-every-minute');`

## What it supports
| | Facebook | Instagram | X |
|---|---|---|---|
| Text post | ✓ | needs a photo | ✓ (280 chars) |
| 1–4 photos | ✓ (album) | ✓ (carousel) | ✓ |
| Schedule | ✓ | ✓ | ✓ |
| Comments / mentions in the inbox + reply | ✓ | ✓ | mentions ✓ |
| DMs + reply | after App Review | after App Review | ✓ (paid reads) |

Not yet: video and reels, link previews, editing or deleting a post that's already live.
