# Roadmap

The current priority is 80% product and 20% data. The system already has ingestion, matching, comparison, basket optimization, and admin read UI. The next work should make those capabilities feel like a product before adding many more providers.

## Near Term: Product Intelligence

Focus: make LabPrice OS useful for daily pricing decisions.

- Improve the basket optimizer with clearer route recommendations, savings explanations, and provider tradeoffs.
- Extract an explicit Pricing Graph API from the current compare and basket logic when the logic becomes shared enough to deserve its own module.
- Expand market intelligence with better spread, promo, and provider coverage insights.
- Polish `/compare` and `/basket` as decision views, not data tables.
- Keep `/match` as a control panel where the UI suggests actions and `match:manual` remains the only manual write path.

## Data Scaling

Focus: widen coverage only where it improves product decisions.

- Stabilize Gemotest live crawling and fixture coverage.
- Expand DNKOM from the current partial catalog toward broader catalog coverage.
- Add provider expansion probes for CMD, Helix, KDL, and Citilab with Moscow regions and mock/probe catalog coverage.
- Keep INVITRO in probe mode until catalog structure, promo structure, region behavior, and anti-bot behavior are understood.
- Promote providers from probe/mock to live-parser one by one, starting with CMD or Helix; keep INVITRO last until access is stable.

## Normalization and Matching

Focus: protect quality while the catalog grows.

- Continue strict separation of `analysis`, `panel`, `complex`, and `unknown`.
- Improve confidence scoring and candidate explanations.
- Add aliases only when they improve safe matching.
- Preserve manual override as the highest-priority match state.

## Future Product Layer

Focus: turn the decision engine into a marketplace-like experience.

- Check-up baskets: predefined groups of tests with optimized provider routes.
- Alerts: price dropped, promo appeared, provider coverage changed.
- SEO vitrines for popular analyses and cities.
- Basket sharing and saved comparison scenarios.
- Practical recommendations such as "one lab is slightly more expensive but avoids a second visit".

## Guiding Rule

Do not scale data blindly. Improve product usefulness first, then add data where it makes the recommendations better.
