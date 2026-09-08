# W3C DID Method registry posture

Status: **`decision-pending-ownership-confirmation`**.

The W3C DID Extensions registry already contains a [`midnight` entry](https://github.com/w3c/did-extensions/blob/de7836c8c4b51fde9500f5fa093e17f5229ec99d/methods/midnight.json) linked to IAMX material. The Midnight method specification retains IAMX attribution and contact history. This is a possible continuity/update case, not an available name for a second registration.

## Open decision

The registry decision remains open. After maintainers confirm ownership and contact continuity, they must explicitly choose whether to update the existing registration or record a decision not to update it. No automation in this repository opens a registry pull request, and a duplicate `midnight` registration must never be created.

Before making that decision, maintainers must confirm:

1. authority to update the existing IAMX-linked entry;
2. current owner and public contact details;
3. the stable public specification URL; and
4. whether the 0.6 DID Core 1.0 evidence is sufficient while DID Core 1.1 and DID Resolution remain failed pending issue #447.

External suite output is retention-bound CI evidence, not immutable release evidence. The [issue #446 approval to execute the pinned suite and publish exact-commit derived results](https://github.com/midnightntwrk/midnight-did/issues/446#issuecomment-5569537724) does not decide or authorize a registry submission. The evidence is not W3C certification, W3C endorsement, registry inclusion, or proof of resolver-service interoperability.
