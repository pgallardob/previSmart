# Retiro programado: actuarial simulation, not an AFP quotation

PreviSmart can simulate a gross monthly retirement pension with the current mandatory balance and a declared, complete, non-disabled family. It does not issue a SCOMP certificate or an insurer quotation.

## Inputs and safeguards

- Holder and every beneficiary: birth date and explicitly declared sex. Sex is never inferred from names or relationships.
- One reviewed family: spouse, civil partner, unmarried-filial parent, non-disabled/invalid children, or parents without higher-priority beneficiaries. AUC requires explicit common-child declarations; concurrent adult groups fail closed. Formula coverage and reference discrepancies: [CNU_FAMILIAS.md](CNU_FAMILIAS.md).
- Operator confirmation of the complete family for this scenario. Changes to the family invalidate that confirmation. Extended rights, invalidity or recalculation also require explicit review and a document reference.
- Pending accrued pension months (`z`), explicitly including zero if none exist.
- Current mandatory balance by default. A separately declared pension capital is optional and requires amount, non-future date, source reference and confirmation; it never overwrites the AFP balance. Unknown APV, bonds, retained balances and SIS contributions are not included automatically.

The scenario uses **completed integer ages** at the calculation date, not an AFP-certified actuarial age, and assumes applicable beneficiary rights for the reviewed group. It does not establish legal eligibility or settle SIS. A declared AFP charge can be shown separately with its source and monthly cash-flow effect; absent charges remain unknown. No regulatory adjustment is invented. Health, tax and benefits require their own inputs.

## Reproducible method

1. Improve each TM2020 mortality probability using that age's annual factors from 2021 through the cohort year. Factors through 2036 are supplied; the final factor repeats thereafter.
2. Form cohort survival probabilities recursively: `S(0)=1`, `S(t+1)=S(t)×(1−q(age+t,year+t))`.
3. Holder CNU: discounted survival sum minus `11/24`. Add the spouse/child components from SP Technical Note 9, equations 10–16. Components are rounded to six decimals.
4. Monthly RP scenario: `mandatory balance / (12×CNU + z)`. No separate mortuary-capital deduction is made in this RP formula.

The bundled rate reference is **3.67% annually from October 2026**, Circular 2425, with a verified scenario window of October–December 2026. The rate resolver selects reviewed dated parameters and never extends a stale rate automatically. Each result carries its interval, source and review provenance. Invalidity and reference recalculations require a declared start/event date from 1 July 2023, reviewed rights/capital and the declared invalidity grade. Historical events remain outside this TM2020 scenario; dates from July 2029 require review of the replacement mortality tables.

## Sources and verification

| Source | Use |
|---|---|
| [SP Technical Note 9, November 2024](https://www.spensiones.cl/portal/institucional/594/w3-article-16151.html) | Equations and published CNU examples on pages 17–18 |
| [SP Compendium: Retiro Programado](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3223.html) | Annual RP denominator `CNU + z/12` |
| [SP mortality tables](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10625.html) | TM2020 normative framework |
| [CMF workbook](https://www.cmfchile.cl/portal/principal/623/articles-99359_recurso_1.xlsx) | RV-M-2020, CB-H-2020 and B-M-2020 probabilities and annual factors |
| [SP current RP rates](https://www.spensiones.cl/apps/tasas/tasdescto.php) | Circular 2425, 2 October 2026 |

Workbook SHA-256: `5c8a01aa2dd8b356038d33894b77bc765e1fa2281d53c8e336c750a74feab747`. `herramientas/importar-tm2020.py` reproduces the bundled data using Python's standard library and rejects unexpected source hashes. No Stata source code is redistributed or executed.

`rpa/test/cnu.test.mjs` compares the three published family examples component-by-component, with tolerance `0.000002`, and checks missing inputs, stale family confirmation, invalid rates and unchanged client data. Run with the project's pinned Node runtime.

The simulated result stays separate from `saldo.pensionEstimadaUF`/`CLP`: those fields remain supplied-source values. In 1.3.49 the shared monthly reference automatically falls back to this scenario when no supplied pension exists, feeding Benefits, Net pension, Survivorship, Modalities and the proposal/report without a SCOMP input or repeated manual entry. The origin remains visible, and changing balances updates dependent calculations without persisting a stale simulated amount as a manual override. Explicit manual amounts remain overrides. A supplied pension always takes priority.

The report displays the actuarial assumptions, CNU components and missing inputs. An RP simulation never establishes an insurer's price, annuity minimum eligibility or insurer bankruptcy coverage. Early-retirement/ELD comparisons remain scenario indicators, not granted rights. A missing spouse sex cannot be solved by an Internet search: the advisor must obtain and record it from the client.
