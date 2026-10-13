# Expanded CNU family coverage

The family engine extends the existing CNU calculation with MI-H-2020 and MI-M-2020 mortality, invalid children, parents, unmarried-filial parents, civil partners and survivor-only CNU. The previously validated holder/spouse/non-invalid-children path is reused unchanged.

## Sources and scope

- [SP Annex 7: Capitales necesarios](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3262.html), sections 1 and 2, checked 13 October 2026.
- [SP mortality NCG 306](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html) selects MI mortality for invalid holders and beneficiaries.
- [SP Note 9](https://www.spensiones.cl/portal/institucional/594/w3-article-16151.html), pages 20–22, provides additional published CNU examples.
- The original pinned CMF workbook and hash are unchanged. `herramientas/importar-tm2020.py` now reproduces all five TM2020 tables.

One declared family is supported. AUC requires explicit common-child declarations. Parents cannot coexist with higher-priority beneficiary types in the supplied group. Concurrent spouse/filial-parent/civil-partner groups are rejected: joint survival, entitlement and redistribution must not be approximated by dividing percentages without evidence.

These are integer-age actuarial components, not a final AFP pension, SIS settlement, eligibility decision or insurer price. Survivor pension amounts additionally require applicable capital, accrued months, share allocation and the special orphan rules in [Retiro Programado](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3223.html).

## Reproducibility and source discrepancy

`node --test rpa/test/cnu.test.mjs rpa/test/cnu-familia.test.mjs` verifies preserved retirement examples, the invalid-holder example, all three published survivor totals, component sums, family shares and rejected inputs.

Note 9 page 21 prints survivor components `7.879290 + 2.181210 + 2.346073`, which sum to `12.406573`, but prints total `12.406665`. The Annex 7 formulas with the pinned tables give `7.879290 + 2.181243 + 2.346132 = 12.406665`. Tests preserve the algebra and published total; they do not tune calculations to the inconsistent printed child components. The page 20 invalid-holder total differs by one unit in the sixth decimal when rounded component values are summed; tolerance is `0.000002`.

Rollback removes the expanded family module and MI table selection/data additions. The original three-table retirement path and its stored client inputs remain intact.
