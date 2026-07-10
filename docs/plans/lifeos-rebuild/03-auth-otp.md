# Prompt 03 — Auth reliability: email OTP primary + token_hash fallback

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Make sign-in work every time from any device or mail client: 6-digit OTP screen with resend cooldown, verifyOtp server action, token_hash handling in /auth/callback, rate-limited send, friendly error copy. Supabase dashboard template changes documented step by step.

## Scope

IN: app/login/*, app/auth/*, lib/auth/*, docs for Supabase config. OUT: guest mode, passkeys, session storage refactors, proxy changes.

Estimated size: S-M. Recommended model: Fable/Opus Effort Max.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
