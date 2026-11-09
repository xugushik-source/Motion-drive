# GitHub / Vercel — 2026-11-09

Repository: https://github.com/xugushik-source/Motion-drive
Vercel project: motion-drive (Harut / harut3).
Node 24, npm ci, npm run build. Production branch: main.

The owner authorized publication in this conversation. Existing local features are preserved.
On Vercel (`VERCEL=1`) the website intentionally uses contact-only mode:
- Four language versions, supplied original logo displayed with CSS cropping of screenshot padding.
- Public branch addresses, phones and hours from https://jnews.ge/162061/ (26 August 2026), corroborated by https://www.instagram.com/avtoshkola_akhalkalaki/; checked 9 November 2026.
- Booking page offers direct telephone links and Instagram. No messages are sent automatically.
- No registration, bookings, chat or admin mutations are accepted; API returns 503 before parsing/storing personal data. `/api/me` returns null.
- The SQLite instance is in memory and holds no visitor records. Never enable writes to this database on Vercel.
- Existing local SQLite features remain available outside Vercel. Online accounts and bookings require a durable database migration before activation.
- Demo car photos retain their demo labels; no unlicensed school images were imported.
- No payment processing, paid AI calls, fabricated reviews, prices or exam questions.
- Noindex remains in place while copy/translations/legal materials are reviewed.

Vercel Git integration deploys changes from GitHub; no repository secrets are needed for this integration.

## Online booking release — implementation ready

Added a PostgreSQL adapter (`pg`, bound parameters, TLS verification, pool of 3),
private `motion_drive` schema and restricted app-only role. Local SQLite remains
available for isolated development. SQL: `db/postgres.sql`, `db/access.sql`.
The production feature gate now requires `DATABASE_URL`; it never falls back to
an ephemeral database for visitor accounts or bookings.

Booking requires a published free slot. Students choose an available day and
hour in Georgia time. Submission reserves that slot while awaiting confirmation.
Transactions lock schedule/booking rows, with a unique database index as the final
protection against simultaneous bookings. Cancellation releases the hour;
rescheduling transfers the reservation. Booked slots cannot be closed underneath
an active booking. Operators can split a work period into lesson slots, confirm,
cancel and reschedule bookings, and answer escalated chat requests. Operators
cannot publish CMS content or grant roles.

Four role-specific routes: `/[locale]/account`, `/operator`, `/instructor`, `/admin`.
Role grants require an existing admin or trusted `scripts/manage-user.ts` command;
public registration always creates students. No public/default staff passwords.

Private Vercel Blob store `motion-drive-media` was created and connected to this
project. The upload/read adapter uses private Blob on Vercel and authenticated
`/api/files` routes; local development retains files on disk. Server uploads are
limited to 3 MiB to fit Vercel's function request limits. No production media
upload has been tested yet because staff accounts require the database.

The on-site chatbot now handles sourced school FAQ in four languages. Admins can
add knowledge and aliases; unknown questions can be stored and answered by staff
once PostgreSQL is connected. Read-only FAQ works even before database activation;
no claims of automatic handoff are made in that mode. Paid model calls remain off.
This is a knowledge-base assistant, not a fine-tuned model. No outbound messages,
SMS, email notifications, Meta integrations or payment provider were activated.

### Pending production database decision

Supabase quoted $0/month but rejected creation: the owner has reached the limit
of 2 active Free projects. No existing project was paused/deleted/upgraded.
An isolated schema in `order-profit-factory` was proposed and awaits approval.
No tables, accounts or data in either existing Supabase project were changed.
After approval, provision the private schema and role, place DATABASE_URL in
Vercel Production Secrets, verify the pooler connection, then redeploy and test
production registration/booking persistence before reporting activation.
