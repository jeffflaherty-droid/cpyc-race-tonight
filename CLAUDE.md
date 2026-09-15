# Project notes for Claude

## Sending email — "send from Gmail"

**IMPORTANT — cloud vs desktop:** cloud sessions (claude.ai/code) **block
outbound SMTP** (only HTTPS-via-proxy egress is allowed), so
`scripts/send_gmail.py` will hang at the connection step there — do NOT
attempt it in a cloud session. In a cloud session, instead create a **Gmail
draft** via the Gmail connector addressed to the recipient and tell the user
to press Send — that flow is proven to work. The real SMTP send below works
in **desktop/local** sessions, where the network is open and the user's
`.env` (see the perx project folder) holds `SMTP_PASSWORD`.

When the user says **"send an email from Gmail"** (or "send from gmail", "email
this to me", etc.), send a **real email** using the reusable sender script.
Do **not** just create a Gmail draft, and do not re-investigate how sending
works — the mechanism is fixed and documented here.

**Mechanism:** `scripts/send_gmail.py` sends via Gmail SMTP
(`smtp.gmail.com:465`) as **flahertyjeff6@gmail.com** — the same account the
weekly Azure backup report is sent from.

**Command (script or Makefile one-liner):**

```bash
# Direct:
python3 scripts/send_gmail.py --subject "..." --body "..." \
  [--to a@x.com,b@y.com] [--html-file page.html] [--attach file.pdf]

# Shorter, via Makefile:
make send SUBJECT="..." BODY="..." [TO="a@x.com"] [HTML=page.html] [ATTACH=f.pdf]
make send-dry SUBJECT="..." BODY="..."   # preview, no send
```

If `--to`/`TO` is omitted, it defaults to `jeffflaherty@gmail.com`.

**Credentials (auto-detected from the environment):**
The script reads the App Password from the **first** of these env vars that is
set, so it works with an existing secret whatever it's named:
`GMAIL_APP_PASSWORD`, `GMAIL_PASSWORD`, `GMAIL_PASS`, `EMAIL_APP_PASSWORD`,
`EMAIL_PASSWORD`, `EMAIL_PASS`, `SMTP_APP_PASSWORD`, `SMTP_PASSWORD`,
`SMTP_PASS`, `MAIL_PASSWORD`. The From address is likewise auto-detected from
`GMAIL_SENDER`/`GMAIL_USER`/`SMTP_USER`/… (default `flahertyjeff6@gmail.com`).

The password is **never** stored in the repo. If none of those vars is set,
the script exits with code 3 and prints setup instructions — relay those to
the user rather than falling back to a draft. If you don't know which name the
existing automation uses, just set `GMAIL_APP_PASSWORD` and it will be picked
up.

**Default recipient:** if the user says "send it to me" without an address,
use `jeffflaherty@gmail.com`.

**Testing without sending:** add `--dry-run` to validate the message and
recipients without needing the credential.
