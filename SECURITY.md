# Security

BioO3 processes patient, clinical, laboratory, account, inventory, and financial information. Because the application may be used with real patient data, security and privacy are important parts of its development and deployment.

This repository contains the application's source code and development configuration. Development credentials, sample configurations, and local Docker settings should not be used directly in production.

Production deployments should be configured according to the security, privacy, and data-protection requirements that apply to the clinic.

## Reporting security issues

If you find a security issue, please do not open a public GitHub issue with details about the vulnerability.

Instead, use GitHub's private vulnerability reporting feature to report it directly through this repository.

When reporting an issue, include:

- A short description of the problem
- The affected part of the application
- Steps to reproduce it
- The possible impact
- A suggested fix, if you have one

Do not include passwords, API keys, private keys, patient information, medical documents, database exports, or other sensitive information in reports, logs, or screenshots.

Please report vulnerabilities privately so they can be reviewed and fixed before being posted publicly.

## Sensitive data

Never commit sensitive or production data to this repository, including:

- `.env` files
- API keys and access tokens
- JWT secrets
- Database credentials
- SMTP credentials
- Mux credentials and private keys
- WhatsApp or Meta credentials
- Payment or fiscal-provider credentials
- Private keys and certificates
- Production database backups or dumps
- Patient records
- Laboratory reports, PDFs, or scans
- Clinic, employee, prescriber, or financial records
- Production logs containing personal or sensitive information

Use test or synthetic data when developing, testing, or demonstrating the project.

The development seed script may read data from legacy files when they are available. Always verify the data being imported and never run development seed scripts against a production database.

## Patient and clinical data

Access to patient and clinical information should be limited to authorized users based on their role and responsibilities.

Production deployments should protect patient records, laboratory reports, generated documents, and other sensitive information from unauthorized access.

The clinic operating BioO3 is responsible for making sure its deployment and use of the application follows the privacy, healthcare, and data-protection requirements that apply to it.

## Clinical information

Laboratory analysis, prescriptions, treatment plans, and other clinical information generated or processed through BioO3 should be reviewed by qualified healthcare professionals when appropriate.

BioO3 is intended to support clinic workflows and should not replace professional medical judgment.
