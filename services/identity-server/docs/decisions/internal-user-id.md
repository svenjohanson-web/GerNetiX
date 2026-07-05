# Entscheidung: Interne user_id ist fuehrend

## Entscheidung

Unabhaengig vom Registrierungsweg entsteht genau ein interner `UserAccount` mit eindeutiger `user_id`.

Spätere Module verwenden ausschliesslich diese interne `user_id`.

## Begruendung

Klassische Registrierung und externe Provider duerfen fachlich nicht zwei verschiedene Identitaetsmodelle erzeugen. Provider-IDs sind technische Fremdschluessel des Identity-Moduls und duerfen nicht in Learning, Device Management, Authorization, Billing oder anderen Domaenen verwendet werden.

## Konsequenzen

- `ExternalIdentity` kapselt Provider, `provider_user_id` und Provider-E-Mail.
- Public Account Responses enthalten keine E-Mail und keine Provider-ID.
- Provider koennen spaeter ergaenzt oder ersetzt werden, ohne andere Module umzubauen.
