# Project requirements

- Continue the existing СберСеллер · Чудозвери app; preserve gameplay, art and branding.
- User requirement: always display and preload the 2× Retina variant directly, including Telegram Mini App. Do not select via devicePixelRatio or image-set. Export 1×/2×, check each sprite frame, alpha, and mobile loading cost. Use `artBackground`/`artPreloadUrl` and update the export manifest. Keep source art. Describe upscaling accurately; do not claim it creates native detail.
- Keep stage backgrounds stationary. Animate the pet separately; never apply button press scaling to the whole scene.
- Tests/typecheck/build must run before publication. Real Telegram/phone QA is separate from automated checks and must be reported honestly.
- Use the existing Sites project and GitHub PR. Back up source, history and build without secrets. User-facing dates/times use Europe/Moscow.
