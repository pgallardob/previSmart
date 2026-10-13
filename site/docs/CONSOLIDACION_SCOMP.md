# Optional emailed SCOMP → consolidated proposal → physical-offer comparison

A client-specific SCOMP PDF can be imported locally and combined with AFP certificates. The generated document remains PreviSmart's own simulation, not a new insurer quotation or contract acceptance. Independent AFP/RP analysis is still available without a SCOMP.

## Advisor workflow

1. In **Captura**, choose **Subir SCOMP recibido por correo**, select the PDF and save it.
2. Review the extracted identity, capital, pension, beneficiaries, offer amounts, clauses and dates; confirm **Importar al expediente**. Unrecognized SCOMP files or mismatched RUTs are not activated as sources.
3. In **Propuesta y ofertas**, keep **AFP + SCOMP consolidado**, select the imported certificate and choose an **Oferta base para el escenario final**. This choice does not accept an offer.
4. Review the consolidated screen document. It shows both AFP and SCOMP amounts and dates, recognized profile differences, original document ID/hash, original quote amounts, current-UF conversions and the selected scenario. Net calculations require declared health information and a valid tax table.
5. After obtaining the physical office offer, record its insurer, monthly UF amount, receipt date and paper reference separately. Confirm matching insurer, modality, premium, beneficiary group, guarantees and clauses before comparing amounts.
6. Generate the new PDF. An older downloaded PDF never updates itself. Changing source, base offer, client data or UF invalidates the prior ready-download link.

## Data preservation

| Source | Preserved behavior |
|---|---|
| AFP portal balance | Never replaced by SCOMP's total capital destined for pension |
| Historical cartola | Retains its separate cutoff and original provenance |
| Uploaded SCOMP | Original PDF plus a whitelisted per-document extraction; identity matched by RUT |
| Manual/prior offers | Not deleted by importing another certificate |
| Selected original offer | Read from the document snapshot, not from a manually edited copy |
| Physical office offer | Separate operator record tied to the certificate and base-offer index |

Different balances can refer to different account scope and dates. They are shown side by side, not treated automatically as errors. Existing declared profile/beneficiary data is not silently replaced. Other certificates remain selectable; re-importing the same original does not duplicate its original offers. Deleting an original through Captura makes that source unavailable for consolidation while retaining the derived audit record.

## Comparison and limits

- Monthly difference: `physical UF − selected SCOMP UF`.
- Both amounts are converted with the **same dated UF reference**, not compared using pesos from unrelated UF dates.
- Annual arithmetic difference: `12 × (rounded physical monthly CLP − rounded base monthly CLP)`, only under the matching conditions declared by the advisor. Temporary or deferred increases must not be treated as unchanged lifelong payments.
- No automatic quote scaling when the AFP balance changes; only the issuer can reprice the insurance offer.
- Expired recorded validity is disclosed as historical, not a current quotation.
- RUT matching and a local SHA-256 identify the record and bytes; they do not verify an issuer signature or authenticate a document.
- No external insurer access, offer acceptance, contract issuance or pension transfer is performed by this workflow.

Verification: `rpa/test/consolidacion-scomp.test.mjs` covers source preservation, identity, repeat imports, source switching and comparison guards. The isolated browser regression uploads and reads a synthetic PDF, confirms its import, selects a base, records a physical comparison and reads the resulting PDF back without changing the extracted original.
