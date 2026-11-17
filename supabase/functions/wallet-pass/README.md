# wallet-pass: UB Blockchain Passport in Apple Wallet

The attendee taps **Add to Apple Wallet** under their Passport (Profile → UB Blockchain Passport; shown on iPhone, iPad and Mac).
The app asks this function for a 5-minute signed link, Safari opens it, and Wallet shows "Add". The pass has the same QR as
the Passport card (door, merch desk, contacts), the name, the code, the dates, and "Checked in" once they've been through the door.
Each pass is signed with your Apple certificate. Until the secrets below are set, the function answers "Apple Wallet isn't set up yet."

## One-time setup (Apple Developer account)

1. **Pass Type ID**: developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+** → *Pass Type IDs*.
   Description `UBBW Passport`, identifier e.g. `pass.net.ubblockchainweek.passport`.
2. **Certificate**: open that Pass Type ID → *Create Certificate*. Make the CSR on a Mac (Keychain Access → Certificate Assistant →
   *Request a Certificate From a Certificate Authority*, saved to disk), upload it, download `pass.cer`, double-click to add it to Keychain.
3. **Export**: in Keychain → *My Certificates*, right-click "Pass Type ID: pass.net…" → *Export* → `pass.p12` with a password.
4. **Apple WWDR G4** intermediate: download `AppleWWDRCAG4.cer` from apple.com/certificateauthority.
5. **Convert to PEM** (any machine with OpenSSL; on OpenSSL 3 add `-legacy` if the .p12 won't open):
   ```
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass.pem
   openssl pkcs12 -in pass.p12 -nocerts -out pass.key          # set a PEM pass phrase when asked
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
6. **Secrets** (Supabase dashboard → Edge Functions → Secrets, or the CLI). Never commit these files.
   ```
   supabase secrets set PASS_TYPE_ID=pass.net.ubblockchainweek.passport APPLE_TEAM_ID=<10-char Team ID> \
     PASS_KEY_PASSPHRASE=<the PEM pass phrase> WALLET_LINK_SECRET=<any long random string> SITE_URL=https://ubblockchainweek.net
   supabase secrets set PASS_CERT_PEM="$(cat pass.pem)" PASS_KEY_PEM="$(cat pass.key)" WWDR_PEM="$(cat wwdr.pem)"
   ```
   Team ID: developer.apple.com → Membership. `SITE_URL` is where `/card/` lives (the QR links there).
7. **Deploy**: `supabase functions deploy wallet-pass --no-verify-jwt`
   (`--no-verify-jwt` because Safari's download can't send a sign-in header; the POST step checks the user itself through `app_me`,
   and the download link is HMAC-signed and expires after 5 minutes.)

## Test
On an iPhone: sign in to the app → Profile → UB Blockchain Passport → Add to Apple Wallet → Add. Scan the pass's QR with the
crew scanner: it should find the same person as the card QR.

## Images
`images.ts` holds the icon (29/58/87 px, from `public/icons/apple-touch-icon.png`) and the white logo (40/80/120 px tall, from
`public/brand/logo-white.webp`) as base64, so the function needs no static files. To change them, resize the new artwork with any
tool and replace the base64 strings.
