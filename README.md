# create-stellar-token

Create a custom Stellar token on Testnet.  You can specify keys for any of the accounts used.  If no seed is specified random accounts will be created for you.  All parameters are optional.

`--issuer-seed=[seed]` Private key for the issuing account

`--distribution-seed=[seed]` Private key for the distribution account

`--client-seed=[seed]` Private key for a client account to receive a disbursement.

`--asset=[code]` Asset name

`--issue-amount=[number]` Amount of asset to issue

`--client-amount=[number]` Amount of asset to send to client

## Usage

`npx create-stellar-token`

`npx create-stellar-token --asset=MYUSD --issue-amount=100000 --client-amount=100`