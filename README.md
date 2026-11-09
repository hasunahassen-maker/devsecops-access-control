# DineDesk API

A local Node 24 and Express demo with in-memory staff and orders. Payments are
simulated. Staff and orders are reset on each restart.

1. Run `npm ci` and `npm test`.
2. Copy `.env.example` to `.env`. Set an invented demo seed password
   and a locally generated JWT key of at least 32 characters.
3. Run `npm start`. The server listens on `127.0.0.1:3000`.
4. POST JSON with `email` and `password` to `/api/auth/login`. Demo
   accounts use addresses such as `bole-waiter@example.test`,
   `piassa-manager@example.test` and `admin@example.test`, and share the
   demo seed password. Send the returned token as an Authorization Bearer
   header. Keep the token and password out of logs and submitted evidence.

## GitHub submission

Create a private repository named `devsecops-access-control`, push these files
to its default branch, and invite your instructor. If you cannot add the
instructor, the assignment permits a public repository with that choice
disclosed in the answers. Check the API tests run under Actions and copy the
URL of the green run.

In Settings → Secrets and variables → Actions, create an invented repository
secret called `DINEDESK_DEMO_KEY`. In Actions, run **Check demo secret** on the
default branch. Copy the successful run URL and the line
`DINEDESK_DEMO_KEY is configured` into the answers. Then delete the demo
secret and record that deletion. The assignment accepts these text outputs
and run links as evidence.
