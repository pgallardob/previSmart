# Client-first pension decision document

The generated document opens with results, comparable amounts and practical cases. Calculation methods and complete source details remain in a technical appendix for the advisor, rather than occupying the first pages.

## Reading order

1. **Overview:** recorded mandatory balance, gross RP reference, available quotes and dated UF. Selected SCOMP capital is shown separately when available.
2. **Income table:** gross base amount, indicative net amount, twelve equal base payments and source/conditions. Missing information stays pending, not zero.
3. **Visual comparison:** zero-based bars for available monetary alternatives. Greater income alone is not an automatic recommendation; clauses and capital/date differences remain relevant.
4. **Practical cases:** validated RP simulation with 10% lower/current/10% higher calculation capital, family survivor percentages, temporary-increase phases when documented, and separately recorded physical-office comparison.
5. **Technical appendix:** original calculations, inputs, unresolved fields, source dates and traceability are retained.

## Numeric safeguards

- RP capital cases hold the existing CNU, age, family and rate constant. They are mathematical sensitivity exercises, **not forecasts, insurer quotations or permission to withdraw capital**.
- The twelve-payment column uses twelve times the displayed rounded monthly base. It does not promise future income, include temporary increases or add granted public benefits.
- RP simulations and imported/manual insurer offers retain distinct origins. Missing annuity quotations are not generated from RP amounts.
- Net figures require declared health/plan and a valid tax table; commissions, other unreported adjustments and possible health exemptions require review.
- Negative physical-offer differences remain numeric. Comparisons require the existing like-for-like declaration.
- The front section shows up to eight insurer entries, retaining a selected late entry; all originals remain in the appendix.

## Output and verification

The screen uses accessible SVG bars plus equivalent textual tables; narrow layouts stack table cells instead of introducing horizontal scrolling. PDF charts are local vector graphics, with multi-column tables and repeated headers. The screen appendix is collapsed initially, opens for browser printing, and returns to its prior state afterwards. The PDF always includes it after the client section.

Screen charts are capped at their 480-pixel design width instead of being enlarged with the page. Rows use a compact 36-pixel pitch and 20-pixel bars; monetary labels remain accompanied by full textual tables. Application headings use Inter with a restrained hierarchy (page heading at most 1.25rem); form controls and normal reading text are not reduced. The native PDF composition is unchanged by these screen adjustments.

Health is never inferred as Fonasa, and an unknown Isapre plan is not treated as zero. A declared AFP charge in a simulated RP is shown separately from gross pension and from the health/tax model; its cash-flow effect does not assume a tax deduction. Missing health/plan information keeps net amounts pending on screen and in the client document.

## Client language and internal review

The standard screen, browser print and native PDF now contain the client reading only: amounts, alternatives, family examples, missing information expressed as next actions, and a plain-language explanation of where the figures came from. They do not include actuarial formulas, table identifiers, raw validation errors or the previous technical appendix. Native PDF charts and table layout are unchanged.

Internal calculations and provenance remain in the model so the advisor can audit the arithmetic. An internal renderer call may explicitly request `{ incluirRevisionAsesor: true }`; ordinary client actions never enable that option. Missing information is not concealed or converted into a fabricated amount. Regression tests verify both the default client output and the separate internal review without changing stored client data.

`rpa/test/informe-cliente.test.mjs` checks arithmetic, hypothetical labels, missing data, source selection, negative differences and escaped markup. The isolated browser test checks 320/390/768/1280 layouts, chart bounds, print-state restoration, first-page results, later appendix content and unchanged client data.
