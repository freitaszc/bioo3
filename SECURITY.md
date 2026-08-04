# Security Policy

## Scope

BioO3 is an application that can process patient, clinical, laboratory, account, inventory, and financial information. This policy applies to the code and configuration in this repository.

The project is under active development. A public repository does not mean that the application is approved for production use or for storing regulated health information.

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue.

Use GitHub's private vulnerability reporting or security advisory workflow for this repository when available. If private reporting is unavailable, contact the repository maintainers through the owner's GitHub profile and ask for a private security contact. Include:

- A short description of the vulnerability and its impact
- The affected component, route, or version/commit
- Reproduction steps or a minimal proof of concept
- Any suggested mitigation

Do not include passwords, API keys, private keys, patient information, medical reports, database exports, or other sensitive data in the report. Redact logs and screenshots before sharing them.

Please allow maintainers reasonable time to investigate and remediate a report before public disclosure.

## Never commit sensitive data

The following must remain outside Git and outside public issue or pull-request content:

- `.env` files and deployment secrets
- JWT, SMTP, Mux, database, payment, or fiscal-provider credentials
- Private keys and certificates
- PostgreSQL dumps, backups, or local database files
- Uploaded laboratory reports, PDFs, scans, or generated patient documents
- Real patient, clinic, employee, prescriber, or financial records
- Production logs that contain identifiers, request data, or personal information

Use synthetic fixtures for tests and demonstrations. The development seed script can read legacy JSON files from a sibling `Web/` directory when present; verify those files before running it and never point it at a production database.

## Deployment baseline

Before deploying the application:

1. Generate a unique, high-entropy `JWT_SECRET` and store it in a secret manager.
2. Use unique database and administrator credentials; never use the defaults from local Docker Compose in production.
3. Use HTTPS, set `NODE_ENV=production`, and restrict `CLIENT_ORIGIN` to trusted origins.
4. Do not expose PostgreSQL directly to the public internet. Restrict database, storage, and administrative access by network and role.
5. Keep uploads and generated documents in private storage with authenticated access, encryption, retention controls, and access logging.
6. Configure backups, restore testing, monitoring, alerting, and an incident-response process.
7. Run dependency and container updates regularly, review lockfile changes, and test security fixes before deployment.
8. Have qualified privacy, legal, and clinical stakeholders review the system and its data flows for the jurisdictions where it will operate.

## Credential or data exposure response

If a secret may have been exposed:

1. Revoke or rotate it immediately.
2. Review access logs and identify affected systems and time windows.
3. Remove the secret from the working tree and Git history as appropriate; deleting a file in a later commit does not invalidate an exposed credential.
4. Preserve relevant evidence without copying sensitive data into issues or chat.
5. Assess whether personal or regulated information was accessed and follow the applicable notification and response requirements.

## Safe handling of clinical output

Laboratory analysis, prescriptions, plans, and other clinical output must be reviewed by qualified professionals. This software is not a substitute for clinical judgment, diagnosis, treatment, or legal and regulatory review.
