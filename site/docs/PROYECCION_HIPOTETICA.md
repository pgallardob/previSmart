# Planning under explicit capital and pension hypotheses

**Sobrevivencia → Planificación** is separate from the current-age RP and from quotations. It models the registered mandatory balance, explicitly declared monthly deposits, a declared annual real return and a declared horizon (1–360 months). No return, future SP rate or future insurer price is filled in automatically.

## Method

The monthly effective rate is `(1 + annual real return)^(1/12) - 1`. Each month: `capital = previous capital × (1 + monthly rate) + end-of-month deposit`. Results are constant-purchasing-power CLP, not nominal future pesos or a projected future UF.

An optional pension hypothesis uses the family CNU engine at the future completed ages, with an explicitly declared hypothetical discount rate and the existing TM2020 tables held constant as a **scenario assumption**, not as a promise of future regulatory validity. The declared family is assumed alive with no new members; ordinary children reaching 24 are excluded, and projected children aged 18–23 require an explicit study-continuity hypothesis. No actual beneficiary field is changed.

The model does not replicate the AFP's official personalized projection, certify retirement eligibility, forecast returns or tax tables, grant benefits, include commissions/SIS/health, or generate insurer prices. It does not replace current-age calculations or supplied-source pension fields. Changing capital, family or assumptions invalidates the confirmation.

## Verification and rollback

`node --test rpa/test/proyeccion-rp.test.mjs` covers zero returns, effective monthly compounding, losses, bounds, future-rate requirements, source preservation and confirmation invalidation. Screen and PDF show the same declared assumptions and explicitly mark future amounts as hypothetical.

Rollback removes only planning controls and sections; current RP, survivor RP and source documents remain intact.
