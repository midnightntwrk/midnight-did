# `credentials-iso-registry`

Compact-native ISO code types shared by Midnight credential families.

## Purpose

This package provides bounded numeric types for values that recur across
credential families:

- `CountryCode`
- `CurrencyCode`
- `LanguageCode`
- `RegionCode`
- `GenderCode`

Using numeric codes keeps the values:

- Compact-friendly
- easy to compare inside circuits
- reusable across multiple credential schemas

The presentation layer can always render these values back to human-readable
text off-chain.

## Current Scope

The current prototype uses the ISO registry directly in the passport family and
reserves it as the shared source of truth for future credential families such as
driving license, national ID, and AML/KYC.

## Validation

```sh
npm run all -w credentials-iso-registry
```
