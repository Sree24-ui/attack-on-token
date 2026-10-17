# Attack on Token — Hackathon Submission

**Live demo:** https://attack-on-token.onrender.com (free tier: allow about a minute for the first load)
**Repo:** https://github.com/Sree24-ui/attack-on-token
**AI conversation log:** [AI_CONVERSATION_LOG.md](AI_CONVERSATION_LOG.md)

## Pitch

**Titan Cloud** looks like a polished enterprise SaaS portal for "token governance". In practice it's a rage-bait gauntlet. To withdraw your organization's single token, you have to get past a login built to fail you and survive a dashboard full of dark patterns. Then you have to out-argue **TOKEN TITAN**, a smug AI gatekeeper. Your suffering is measured with a live **frustration index** and saved forever in the **Hall of Shame**.

The joke is the contrast: a trustworthy interface whose interactions keep betraying you.

## How we built it (from our build log)

1. **v0: arcade prototype.** An empty folder became a zero-dependency Node app (`node:http` + `node:sqlite`) with a cookie wall, escalating password rules, a rigged CAPTCHA, an AI chat and a SQLite leaderboard. We published it to GitHub.
2. **Design pass.** We moved animations off layout properties (`transform` instead of `width`), removed the glow effects, and fixed color contrast to meet WCAG AA.
3. **Organizer rule: at most 2 pages.** We refactored into exactly two routes, `/` (login portal) and `/dashboard`. Everything else became tabs, modals, popovers and drawers. A test enforces the limit.
4. **Honest AI.** With `ANTHROPIC_API_KEY` set, the Titan runs on Claude. Without one, it uses a clearly labeled scripted fallback. Every reply carries `source: claude | scripted`, so a scripted reply is never shown as live AI.
5. **Deployed on Render (free plan).** We tried a paid persistent disk first, then switched to the free plan.
6. **Rage pack.** Based on research into dark patterns (confirmshaming, roach motel, nagging, fake urgency) and the r/badUIbattles community, we added popup notifications, blocking alerts, a roach-motel sign-out flow, a slider phone input, a broken volume control and shaking buttons.

## Rage-bait features

**Login portal (`/`)**
- A cookie "Reject" link that runs away, then accepts everything anyway
- A sign-in button that dodges your cursor; sign-in never works
- Forgot password: "sent to an email address. Not necessarily yours."
- Password rules revealed one at a time: digits summing to 13, a month, "titan" backwards, an emoji, a prime length
- A strength meter that says "Weak" for the perfect password
- Show-password that lasts only 1.5 seconds
- A Terms checkbox that unchecks itself
- Username "already taken" (by you)
- Provisioning progress that runs 12% → 87% → 34% → 99%
- "Tia" the help bubble, who keeps coming back

**Dashboard (`/dashboard`)**
- Popup notifications every 18 seconds; dismissing them spawns "notifications about dismissed notifications"
- Blocking alerts: a session-expiry countdown ("you are not inactive"), and an unsaved-changes warning when nothing has changed
- A newsletter nag with confirmshaming decline buttons ("No. I am a bad person.")
- A fake-urgency countdown that resets itself; dismiss it and it comes back
- A roach-motel sign-out: a double-negative "Cancel signing out?", a mandatory exit survey, then a "100% off ($0 → $0)" retention offer
- A rigged CAPTCHA, then the Titan chat (it never gives in before your 4th message)
- Settings: a phone number you enter with a slider (±1 buttons), a volume control that jumps to a random value, and toggles that switch themselves off
- Shaking buttons: random primary buttons jitter, and Verify, Send and Create account tremble when you hover over them
- A rage-click detector, and a browser "Leave site?" prompt

## Tech

- Node 24+ with no npm dependencies
- SQLite through the built-in `node:sqlite`
- Vanilla HTML, CSS and JS
- Claude API through `fetch`, with a scripted fallback
- `node:test` suite (5 tests, including the two-page constraint)
- Hosted on Render

## Run locally

```bash
npm start   # http://localhost:3000
npm test
ANTHROPIC_API_KEY=sk-ant-... npm start   # optional: live AI Titan
```

---

# Demo video script (about 2.5 minutes, screen recording)

**Before recording:** open the live URL one minute ahead so it's awake. Use a fresh browser tab and hide your bookmarks bar.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Login page, still | "This is Titan Cloud, a totally normal enterprise portal. Let's sign in." |
| 0:10 | Hover over **Reject** on the cookie bar a few times, then click it | "I'd like to reject cookies… it runs away. And rejecting accepts all 9,437 anyway." |
| 0:20 | Type an email and password; hover over **Sign in** (it dodges); press Enter twice | "The sign-in button dodges me. Wrong password, and now I don't even have an account." |
| 0:32 | Click **Forgot password?**, then **Continue with SSO** | "Reset link sent to *an* email address. SSO? My administrator is the Titan." |
| 0:40 | When Tia pops up, click **No thanks** | "Tia wants to help. She'll be back." |
| 0:45 | **Create account**: type a password slowly so the rules appear one by one | "Digits must add up to 13. A month. 'Titan' backwards. An emoji. A prime length." |
| 1:00 | Paste `Maynatit🪙49` and point at the strength meter | "Perfect password. Strength: Weak." |
| 1:05 | Tick Terms (it unchecks), tick it again, click **Create account** twice | "Terms unticked itself. Username taken… by me." |
| 1:15 | Provisioning bar | "87%… 34%… progress." |
| 1:22 | Dashboard: let popups slide in; dismiss one | "Looks professional, right? Then the notifications start, and they never stop." |
| 1:32 | Point at the urgency banner; dismiss it | "My withdrawal window closes in 4:59. Forever." |
| 1:38 | When the newsletter nag appears, read the decline button aloud | "'No thanks, I don't like free tokens.'" |
| 1:45 | **Withdraw token** → CAPTCHA: fail once, then pick only 🪙 | "Select all tokens. Wrong. Some were tokens of appreciation." |
| 1:58 | Titan chat: send 5 arguments, then "please" | "Meet the Titan, an AI that roasts every argument. It can run on Claude; this is the labeled scripted mode." |
| 2:12 | Victory modal → **Join Hall of Shame** | "One token, worth $0.000003. And the Hall of Shame remembers." |
| 2:20 | Settings: drag the phone slider, change the volume | "Enter your phone number with a slider. Volume set to 73%. Close enough." |
| 2:28 | Avatar → **Sign out**: "Yes, cancel" keeps you in; then go through the survey and the offer | "Signing out is a three-step negotiation. Thanks for watching Attack on Token." |

**Tip:** keep the frustration index (top KPI card) in frame. Watching it climb is the punchline.
