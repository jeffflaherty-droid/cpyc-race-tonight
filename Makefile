# Convenience targets for sending email from Gmail.
#
# Requires the GMAIL_APP_PASSWORD environment secret (16-char Google App
# Password for flahertyjeff6@gmail.com). See CLAUDE.md for setup.
#
# Examples:
#   make send SUBJECT="Hi" BODY="Quick note"
#   make send TO="a@x.com,b@y.com" SUBJECT="Report" BODY="See below" \
#             HTML=page.html ATTACH=report.pdf
#   make send-dry SUBJECT="Test" BODY="Preview only"   # validate, no send

PY      ?= python3
SENDER  := $(PY) scripts/send_gmail.py

# Defaults: recipient falls back to jeffflaherty@gmail.com inside the script.
TO      ?=
SUBJECT ?=
BODY    ?=
HTML    ?=
ATTACH  ?=

# Assemble optional flags only when the variable is set.
_TO      = $(if $(TO),--to "$(TO)",)
_HTML    = $(if $(HTML),--html-file "$(HTML)",)
_ATTACH  = $(if $(ATTACH),--attach "$(ATTACH)",)
_ARGS    = $(_TO) --subject "$(SUBJECT)" --body "$(BODY)" $(_HTML) $(_ATTACH)

.PHONY: send send-dry

## send: send a real email (needs GMAIL_APP_PASSWORD)
send:
	$(SENDER) $(_ARGS)

## send-dry: build and preview the message without sending
send-dry:
	$(SENDER) $(_ARGS) --dry-run
