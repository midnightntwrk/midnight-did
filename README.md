# Midnight DID

This GitHub repository contains the Midnight DID method specification and reference implementation in TypeScript.

The main purpose of creating a new DID method is to make it a first-class citizen of the Midnight blockchain and solve the following challenges:
- provide a W3C DID Core specification-compliant method that is compatible with other DID methods and Self-Sovereign Identity platforms.
- support Midnight platform cryptography (JubJub + Poseidon hash)
- enable DID resolution via the Midnight JS library and smart contract.
- support signing and signature verification both within and outside smart contracts.

## Repository structure

- w3c-spec - the Midnight DID method specification
- contract - smart-contract implementation of the Midnight DID
- domain - common classes, interfaces, and implementations for DID, DIDDocument, and DIDResolver
- did - the Midnight DID TypeScript implementation
- api - the API implementation of the Midnight DID to support create, update, resolve, and deactivate operations.
- cli - Node.js console application to manage the Midnight DID
- resolver - Node.js implementation of the Midnight DID resolver

### LICENSE

Apache 2.0.

### README.md

Provides a brief description for users and developers who want to understand the purpose, setup, and usage of the repository.

### SECURITY.md

Provides a brief description of the Midnight Foundation's security policy and how to properly disclose security issues.

### CONTRIBUTING.md

Provides guidelines for how people can contribute to the Midnight project.

### CODEOWNERS

Defines repository ownership rules.

### ISSUE_TEMPLATE

Provides templates for reporting various types of issues, such as: bug report, documentation improvement and feature request.

### PULL_REQUEST_TEMPLATE

Provides a template for a pull request.

### CLA Assistant

The Midnight Foundation appreciates contributions, and like many other open source projects asks contributors to sign a contributor
License Agreement before accepting contributions. We use CLA assistant (https://github.com/cla-assistant/cla-assistant) to streamline the CLA
signing process, enabling contributors to sign our CLAs directly within a GitHub pull request.

### Dependabot

The Midnight Foundation uses GitHub Dependabot feature to keep our projects dependencies up-to-date and address potential security vulnerabilities. 

### Checkmarx

The Midnight Foundation uses Checkmarx for application security (AppSec) to identify and fix security vulnerabilities.
All repositories are scanned with Checkmarx's suite of tools including: Static Application Security Testing (SAST), Infrastructure as Code (IaC), Software Composition Analysis (SCA), API Security, Container Security and Supply Chain Scans (SCS).

### Unito

Facilitates two-way data synchronization, automated workflows, and streamlined processes between: Jira, GitHub issues and Github project Kanban board. 

# TODO - New Repo Owner

### Software Package Data Exchange (SPDX)
Include the following Software Package Data Exchange (SPDX) short-form identifier in a comment at the top headers of each source code file.

