# Survivor RP from separately reviewed remnant capital

**Sobrevivencia → Sobrevivencia RP** models beneficiary payments using survivor-only CNU and a separately declared remnant capital. It does not apply a simple percentage to the living holder's simulated RP, pretend the current AFP balance is the balance at death, or promote group income to an individual's PGU/BAC/CEV base.

## Inputs

Declare remnant capital, its non-future date, document/review reference, accrued months (including explicit zero), and the full reviewed beneficiary group. Each beneficiary needs birth date, sex, invalidity/study declarations where relevant, and AUC common-child declarations. Changing inputs invalidates the review confirmation.

## Method and safeguards

- [SP Retiro Programado, section 4(b)](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3223.html): exclude holder CNU, calculate the annuality, divide by twelve and apply each beneficiary's proportion.
- [SP Annex 7](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3262.html): family-specific survivor CNU; the existing validated mortality engine is reused.
- Ordinary orphan-only groups require a supplied pension/reference for the twice-reference cap. No reference is derived from a balance or invented remuneration history.
- A single ordinary 23-year-old child additionally requires declared actual months until age 24. Its payment is remnant capital divided by those months, capped as applicable; it is not an annual CNU payment. Accrued-month combinations in this special case require a specific calculation and remain blocked.
- No minimum-pension adjustment, SIS settlement, commission, health deduction, tax or granted benefit is invented. Concurrent adult family groups and unverified rights remain blocked.

The client section shows group payments and the technical appendix records the source, CNU, rate, cap and special rule. Source AFP balances and supplied pensions remain untouched. The family total is never reused as the holder's pension.

## Verification

`node --test rpa/test/simulacion-sobrevivencia-rp.test.mjs` verifies exclusion of holder CNU, source preservation, group/individual isolation, orphan caps, the 23-year-old rule and review invalidation. All clients and references in tests are synthetic.

Rollback removes only this separate scenario and its controls/report section, not the living-holder RP engine or stored AFP documents.
