#!/usr/bin/env python3
"""
send_gmail.py — send a real email from a Gmail account via SMTP.

This is the reusable "send from Gmail" mechanism. It sends as
flahertyjeff6@gmail.com (the same account the weekly Azure backup report
is sent from) using a Gmail App Password supplied through the environment.

The password is NEVER stored in this file. It is read at runtime from the
GMAIL_APP_PASSWORD environment variable (a 16-character Google App Password).

--------------------------------------------------------------------------
Environment variables
--------------------------------------------------------------------------
  GMAIL_APP_PASSWORD   (required)  16-char Google App Password for the sender.
  GMAIL_SENDER         (optional)  From address. Default: flahertyjeff6@gmail.com

--------------------------------------------------------------------------
Usage
--------------------------------------------------------------------------
  python3 scripts/send_gmail.py \
      --to a@example.com,b@example.com \
      --subject "Hello" \
      --body "Plain text body" \
      [--html "<p>Rich body</p>" | --html-file page.html] \
      [--body-file body.txt] \
      [--cc c@example.com] [--bcc d@example.com] \
      [--attach file1.pdf --attach file2.xlsx] \
      [--dry-run]

  --dry-run validates everything and prints the message without sending
  (does not require GMAIL_APP_PASSWORD), useful for testing.

Exit codes: 0 = sent (or dry-run OK), 2 = usage/validation error,
            3 = missing credential, 4 = SMTP/send error.
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path

DEFAULT_SENDER = "flahertyjeff6@gmail.com"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465  # implicit TLS


def _split_addrs(value: str | None) -> list[str]:
    if not value:
        return []
    return [a.strip() for a in value.replace(";", ",").split(",") if a.strip()]


def build_message(args: argparse.Namespace, sender: str) -> EmailMessage:
    to_addrs = _split_addrs(args.to)
    cc_addrs = _split_addrs(args.cc)
    bcc_addrs = _split_addrs(args.bcc)
    if not (to_addrs or cc_addrs or bcc_addrs):
        sys.exit("error: at least one --to/--cc/--bcc recipient is required")

    body = args.body
    if args.body_file:
        body = Path(args.body_file).read_text(encoding="utf-8")
    if body is None:
        body = ""

    html = args.html
    if args.html_file:
        html = Path(args.html_file).read_text(encoding="utf-8")

    msg = EmailMessage()
    msg["From"] = sender
    if to_addrs:
        msg["To"] = ", ".join(to_addrs)
    if cc_addrs:
        msg["Cc"] = ", ".join(cc_addrs)
    msg["Subject"] = args.subject or ""
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    for path_str in args.attach or []:
        p = Path(path_str)
        if not p.is_file():
            sys.exit(f"error: attachment not found: {p}")
        ctype, encoding = mimetypes.guess_type(p.name)
        if ctype is None or encoding is not None:
            ctype = "application/octet-stream"
        maintype, subtype = ctype.split("/", 1)
        msg.add_attachment(
            p.read_bytes(), maintype=maintype, subtype=subtype, filename=p.name
        )

    # Store the full envelope (incl. Bcc) on the object for the sender to use.
    msg._envelope_rcpts = to_addrs + cc_addrs + bcc_addrs  # type: ignore[attr-defined]
    return msg


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Send email from Gmail via SMTP.")
    parser.add_argument("--to", help="Comma-separated To recipients")
    parser.add_argument("--cc", help="Comma-separated Cc recipients")
    parser.add_argument("--bcc", help="Comma-separated Bcc recipients")
    parser.add_argument("--subject", help="Subject line")
    parser.add_argument("--body", help="Plain-text body")
    parser.add_argument("--body-file", help="Read plain-text body from a file")
    parser.add_argument("--html", help="HTML body (alternative part)")
    parser.add_argument("--html-file", help="Read HTML body from a file")
    parser.add_argument(
        "--attach", action="append", help="Attach a file (repeatable)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print without sending (no credential needed)",
    )
    args = parser.parse_args(argv)

    sender = os.environ.get("GMAIL_SENDER", DEFAULT_SENDER).strip()
    msg = build_message(args, sender)
    rcpts = msg._envelope_rcpts  # type: ignore[attr-defined]

    if args.dry_run:
        print("DRY RUN — message NOT sent")
        print(f"From:    {sender}")
        print(f"Rcpts:   {', '.join(rcpts)}")
        print(f"Subject: {msg['Subject']}")
        print(f"Attachments: {len(args.attach or [])}")
        return 0

    app_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if not app_password:
        print(
            "error: GMAIL_APP_PASSWORD is not set in the environment.\n"
            "Generate a 16-char App Password for the sender account at\n"
            "  https://myaccount.google.com/apppasswords\n"
            "then set it as the GMAIL_APP_PASSWORD environment secret.",
            file=sys.stderr,
        )
        return 3

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(sender, app_password)
            server.send_message(msg, from_addr=sender, to_addrs=rcpts)
    except smtplib.SMTPAuthenticationError:
        print(
            "error: SMTP authentication failed. Check that GMAIL_APP_PASSWORD is a\n"
            "valid App Password for "
            f"{sender} (not the normal account password), and that 2-Step\n"
            "Verification is enabled on that account.",
            file=sys.stderr,
        )
        return 4
    except Exception as exc:  # noqa: BLE001 - surface any SMTP failure cleanly
        print(f"error: failed to send: {exc}", file=sys.stderr)
        return 4

    print(f"sent: from {sender} to {', '.join(rcpts)} — subject: {msg['Subject']!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
