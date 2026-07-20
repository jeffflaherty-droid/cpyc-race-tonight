# Project notes for Claude

## Sending email — "send from Gmail"

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

**Credentials (already expected in the environment):**
- `GMAIL_APP_PASSWORD` — 16-char Google App Password for the sender. Required.
- `GMAIL_SENDER` — optional override of the From address
  (defaults to `flahertyjeff6@gmail.com`).

The password is **never** stored in the repo; the script reads it from the
environment at runtime. If `GMAIL_APP_PASSWORD` is missing, the script exits
with code 3 and prints setup instructions — relay those to the user rather
than falling back to a draft.

**Default recipient:** if the user says "send it to me" without an address,
use `jeffflaherty@gmail.com`.

**Testing without sending:** add `--dry-run` to validate the message and
recipients without needing the credential.
