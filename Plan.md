# BioO3 Functional Plan and Roadmap

## Current Mapping

| Area | Code status | Notes |
|---|---|---|
| Registration with clinic/location, email, and password | Implemented | Name and location are provided together |
| Registration approval and rejection | Implemented | The administrator controls this from the Clinics section |
| Email notifications | Not planned for now | No SMTP configuration is required for the current workflow |
| Suspend, reactivate, and change email | Implemented | Administrator-only |
| Administrative access to data | Implemented | Works in the current modules |
| Clinic filtering | Implemented | Patients, inventory, calendar, dashboard, and Lab |
| Cash register filtering by clinic | Pending | Cash register does not exist yet |
| Reference values | Implemented | Global and editable only by the administrator |
| Prescription editable after analysis | Implemented | Can be changed and saved |
| Prescriber with registration number | Implemented | Council type and registration number |
| Prescriber on PDF | Implemented | Name and registration number appear in the printout |
| Analysis printing | Implemented | Page is ready for printing/PDF |
| Basic inventory | Implemented | Products, quantities, and prices |
| Batch, expiration date, supplier, and movements | Implemented | Advanced inventory records lots, suppliers, movements, linked users, clinics, patients, and plans |
| Global plan templates | Implemented | Administrator-managed templates with products, routes, frequencies, and sessions |
| Patient records and Prontuário | Implemented | Dedicated patient page with editable information, clinical history, consultations, and BioO3 Lab access |
| Patient plans | Implemented | Plans are exclusive to a patient and support quotes, activation, printing, PDF export, completion, and cancellation |
| Cash register and sales | Implemented | Clinic-scoped sales, price snapshots, discounts, installments, payments, and inventory links |
| Receipt and official invoice | Pending | Will require PDF generation and tax integration |

## Roadmap

1. **Finalize the registration and administration workflow**
   - Keep clinic registrations pending until reviewed by the administrator.
   - Allow the administrator to approve or reject registrations directly in the Clinics section.
   - Do not configure SMTP or send email notifications at this stage.
   - Maintain one access account per clinic.

2. **Plan templates**
   - The administrator creates global templates, such as hair loss and weight loss.
   - Allowed routes: intramuscular, intravenous, and subcutaneous.
   - Each template defines products, quantities, frequency, and sessions.
   - Frequencies: weekly, every two weeks, and monthly.
   - Default quantity of four sessions, always adjustable.
   - Only the administrator creates and maintains global templates.

3. **Patient plans**
   - The clinic selects a template and creates a plan for its patient.
   - The administrator can create a plan for any selected clinic.
   - The clinic can adapt sessions, frequency, and additional information.
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

- Registration uses a single field for the clinic name/location.
- Registration remains pending until administrative approval.
- The administrator can approve or reject registrations from the Clinics section.
- No email or SMTP configuration is required for the current approval workflow.
- Only the administrator can create global templates.
- The clinic and administrator can create plans for authorized patients.
- Clicking a patient opens the Prontuário page instead of a detail modal.
- Patient information is edited from the Prontuário page.
- Prontuário shows consultations, prescriptions, analyses, and dates.
- Plans belong exclusively to the selected patient.
- A BioO3 Lab analysis can be started from the patient’s Prontuário and linked to that patient.
- Patient plans support quote, activation, printing, PDF export, completion, and cancellation.
- Inventory supports suppliers, batches, expiration dates, and quantity by batch.
- Inventory movements preserve user, clinic, patient, plan, date, and reason.
- Sales and consumption movements warn about insufficient or expired stock without blocking the movement.
- Cash register supports manual sales and sales originating from patient plans.
- Sale items preserve the current inventory sale price used at the time of sale.
- Discounts, installments, payments, and payment history are stored independently from inventory.
- The administrator can view all sales or filter them by clinic.
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
- The administrator creates templates; the clinic applies and adapts the template for the patient.
- Exporting a plan means downloading a PDF.
- The base price is the product’s `salePrice`.
- The system will allow a sale even when inventory is incorrect.
- BioO3 will issue an official invoice for its half.
- The clinic will invoice its half in another system.
- Clinic registration approval is handled by the administrator in the Clinics section; email notifications are deferred.
