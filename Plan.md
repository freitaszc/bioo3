# BioO3 Functional Plan and Roadmap

## Current Mapping

| Area | Code status | Notes |
|---|---|---|
| Administrator-only access | Implemented | Public clinic registration and clinic-user login are disabled |
| Clinic management | Implemented | The administrator creates, edits, activates, inactivates, and removes empty clinics |
| Clinic WhatsApp destinations | Implemented | Each clinic stores the WhatsApp that receives its patient reports |
| Central WhatsApp sender | Implemented | Meta Embedded Signup, encrypted token, delivery queue, and status webhooks |
| Administrative access to data | Implemented | Works in the current modules |
| Clinic filtering | Implemented | Patients, inventory, calendar, dashboard, and Lab |
| Cash register filtering by clinic | Pending | Cash register does not exist yet |
| Reference values | Implemented | Global and editable only by the administrator |
| Prescription editable after analysis | Implemented | Can be changed and saved |
| Prescriber with registration number | Implemented | Council type and registration number |
| Prescriber on PDF | Implemented | Name and registration number appear in the printout |
| Analysis printing | Implemented | Page is ready for printing/PDF |
| Batch PDF analysis | Implemented | Up to 50 patients, persistent review, B12/D3 summary, private originals, and server reports |
| Basic inventory | Implemented | Products, quantities, and prices |
| Batch, expiration date, supplier, and movements | Implemented | Advanced inventory records lots, suppliers, movements, linked users, clinics, patients, and plans |
| Global plan templates | Retained for historical compatibility | No longer shown in navigation or required for new plans |
| Patient records and Prontuário | Implemented | Dedicated patient page with editable information, clinical history, consultations, and BioO3 Lab access |
| Patient plans | Implemented | Clinics create plans directly inside the patient’s Prontuário, keep product snapshots and estimated totals, and support quotes, activation, printing, PDF export, completion, and cancellation |
| Cash register and sales | Implemented | Clinic-scoped sales, price snapshots, discounts, installments, payments, and inventory links |
| Receipt and official invoice | Partially implemented | Receipt/PDF and 50% BioO3 fiscal-document tracking are available; official provider integration remains pending |

## Roadmap

1. **Administration and clinic organization**
   - Maintain a single useful administrator login.
   - Register clinics as organizational records without creating access accounts.
   - Store one WhatsApp destination per clinic and preserve inactive clinics with historical data.

2. **Product catalog**
   - The product catalog comes from the BioO3 Lab references and remains available when a clinic creates a patient plan.
   - Allowed routes: intramuscular, intravenous, and subcutaneous.
   - Each template defines prescribed products, preparation, application, quantity, unit, frequency, and default sessions.
   - The administrator defines the unit price for each product.
   - Frequencies: weekly, every two weeks, and monthly.
   - Default quantity of four sessions, always adjustable.
   - Global templates are not required for new plans; the previous template structure remains only for historical compatibility.

3. **Patient plans**
   - The clinic creates a plan directly for its patient without requiring a template.
   - The administrator can create a plan for any selected clinic.
   - The clinic can add prescribed products and adapt each product’s quantity, sessions, interval in days, unit price, frequency, and additional information.
   - Product preparation and application are copied from `references.json` and preserved in the patient-plan snapshot.
   - Statuses: quote, active, completed, and canceled.
   - Actions: create quote, activate, print, export PDF, and cancel.
   - Cancellation preserves history, sessions, and amounts.

4. **Advanced inventory**
   - Register suppliers, batches, expiration dates, and quantity per batch.
   - Record receipts, removals, sales, consumption by plan, and manual adjustments.
   - Keep a history with user, clinic, patient, plan, date, and reason.
   - Allow sales when inventory is insufficient or out of date.
   - Display a warning without blocking the sale and record the resulting movement.

5. **Cash register**
   - Create a module separate from inventory but connected to sales.
   - Allow sales originating from plans or manual sales.
   - Calculate amounts using the current sale price in inventory.
   - Store a copy of the price used to preserve historical data.
   - Apply a percentage discount and number of installments.
   - Record payments, installment status, and sales history.
   - Allow the administrator to view all clinics or filter for a specific clinic.

6. **Receipts and invoices**
   - Generate a PDF receipt with patient, clinic, plan, products, discount, installments, and payments.
   - Split the final amount 50% for BioO3 and 50% for the clinic.
   - Issue an official invoice only for the 50% belonging to BioO3.
   - Record that the other 50% will be invoiced by the clinic in another system.
   - Store the invoice number, amount, status, and document.
   - Choose and configure the tax provider before this phase.

## Planned Models and APIs

- Plans: `PlanTemplate`, `PlanTemplateItem`, `PatientPlan`, and `PlanSession`.
- Inventory: `Supplier`, `StockLot`, and `StockMovement`.
- Cash register: `Sale`, `SaleItem`, `Installment`, and `Payment`.
- Tax and billing: `Receipt` and `FiscalDocument`.
- APIs grouped under `/api/plan-templates`, `/api/patient-plans`, `/api/inventory`, `/api/cash`, and `/api/fiscal`.
- All operational entities will have `clinicId`.
- Clinics can access only their own data; the administrator can access aggregated data or a selected clinic.

## Tests and Acceptance Criteria

- Only the administrator can authenticate and access operational APIs.
- Clinics are created in the Clinics section with a valid WhatsApp destination.
- Clinics with historical data are inactivated instead of physically removed.
- Batch analysis separates patients, requires review, and persists only B12/D3 results and report status.
- WhatsApp bulk sending queues one report per altered patient and preserves delivery status.
- Clinics and the administrator can create plans directly for authorized patients.
- Clicking a patient opens the Prontuário page instead of a detail modal.
- Patient information is edited from the Prontuário page.
- Prontuário shows consultations, prescriptions, analyses, and dates.
- Plans belong exclusively to the selected patient.
- A BioO3 Lab analysis can be started from the patient’s Prontuário and linked to that patient.
- Patient plans display a product table and support quote, activation, printing, PDF export, completion, and cancellation.
- Plan creation can save a quote or immediately export the plan.
- Inventory supports suppliers, batches, expiration dates, and quantity by batch.
- Inventory movements preserve user, clinic, patient, plan, date, and reason.
- Sales and consumption movements warn about insufficient or expired stock without blocking the movement.
- Cash register supports manual sales and sales originating from patient plans.
- Sale items preserve the current inventory sale price used at the time of sale.
- Discounts, installments, payments, and payment history are stored independently from inventory.
- The administrator can view all sales or filter them by clinic.
- Receipts include the full sale and show the 50% BioO3 / 50% clinic split.
- Fiscal-document records represent only BioO3’s 50% and remain pending until a provider and credentials are configured.
- Sessions and frequency are adjustable.
- Quotes use inventory prices and preserve historical prices.
- Discounts, installments, and the 50% split are calculated correctly.
- A sale with insufficient inventory generates a warning but is completed.
- Every sale generates financial history and an inventory movement.
- Cancellation does not delete history.
- The PDF receipt shows the financial split.
- BioO3’s official invoice corresponds only to 50% of the final amount.
- The administrator can filter plans, inventory, and cash register data by clinic.

## Confirmed Assumptions

- “OK” means approved requirement.
- Name and location are entered in the same field.
- Clinics create plans directly for each patient using the shared prescribed-product catalog.
- Exporting a plan means downloading a PDF.
- The base price is the product’s `salePrice`.
- The system will allow a sale even when inventory is incorrect.
- BioO3 will issue an official invoice for its half.
- The clinic will invoice its half in another system.
- Clinics are organizational records managed by the administrator and do not have their own login.
