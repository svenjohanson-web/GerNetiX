# Identity API

Initialer Service-Kontrakt. Noch kein HTTP-Routing.

## AuthService

- `register_local(username, email, password, accepted_terms, password_repeat)`
- `verify_email(token)`
- `login_local(identifier, password)`
- `login_external(provider, provider_token_or_mock_payload)`
- `logout(session_id_or_token)`
- `request_password_reset(email)`
- `reset_password(token, new_password)`

## Provider

Provider implementieren:

- `authenticate(provider_token_or_mock_payload)`

Mock-Provider:

- `MockGoogleProvider`
- `MockAppleProvider`
- `MockMicrosoftProvider`
- `MockGitHubProvider`

## EmailService

- `send_verification_email(email, verification_link)`
- `send_password_reset_email(email, reset_link)`

`MockEmailService` versendet keine echte E-Mail und schreibt Links in Logs/Testausgabe.
