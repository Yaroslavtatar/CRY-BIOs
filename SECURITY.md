# Security Policy

## Supported Versions

Starting from version **1.2.0 Stable**, CRY BIOS enters the phase of stable releases. Active security support is provided only for the latest minor version within a major release.

| Version | Supported |
| ------ | --------------- |
| **1.2.x** (latest) | :white_check_mark: Active support |
| **1.1.x** and older | :x: Support discontinued |
| Forks and modified builds | :x: |

> **Recommendation**: Always use the latest version from the `main` branch to receive up-to-date security fixes.

## Responsible Disclosure of Vulnerabilities

If you discover a potential security vulnerability in CRY BIOS, **please DO NOT create a public Issue**. Instead, follow the responsible disclosure procedure:

### How to Report a Problem

1.  **Contact us privately** via email: **`ceo@cryteam.ru`**
2.  In your message, please provide as much detail as possible:
    *   Steps to reproduce the issue.
    *   The version where the vulnerability was found (e.g., 1.2.0).
    *   Potential impact (what could happen).
    *   (Optional) Suggestions for a fix or a workaround.

### What Happens Next

*   **Acknowledgment (within 48 hours)**: We will confirm receipt of your email and begin an investigation.
*   **Investigation (up to 7 days)**: We will confirm or refute the vulnerability. If confirmed, we will determine its severity (CVSS) and priority.
*   **Fix**: If the vulnerability is confirmed, we will release a patch in a new version. The release date depends on the complexity of the issue. We will notify you when the fix is ready.
*   **Credit**: We will publicly thank you in the release notes (if you don't object) but will not disclose details of the vulnerability until most users have installed the update.

### Exceptions and Clarifications

*   **Social Engineering**: If the issue involves phishing or user deception, it falls outside the scope of this document. We will handle such cases on a case-by-case basis.
*   **Incidents on the Official Node**: If you are exploiting a vulnerability on `bio.cryteam.ru`, please report it using the same method. This constitutes a violation of the Terms of Service.
*   **Outdated Forks**: We are not responsible for the security of forks and modified versions of the project.

## Sovereignty Philosophy

CRY BIOS provides you with sovereign control over your data, but this also imposes responsibility on you:
*   Always use the latest stable version.
*   Configure your own server securely (change default passwords, use HTTPS).
*   Review the code before running it if you are using a fork.

---

**Security Contact**: `ceo@cryteam.ru`
