#!/usr/bin/env node
const StellarSdk = require("stellar-sdk");
const fetch = require("node-fetch");
const chalk = require("chalk");
const cmd = require("command-line-args");
const readlineSync = require("readline-sync");

const opts = cmd([
  { name: "client-seed", type: String },
  { name: "issuer-seed", type: String },
  { name: "distribution-seed", type: String },
  { name: "asset", type: String, defaultValue: "LMC" },
  { name: "issue-amount", type: Number, defaultValue: 10000 },
  { name: "client-amount", type: Number, defaultValue: 0 }
]);

const server = new StellarSdk.Server("https://horizon-testnet.stellar.org");

const ASSET = opts["asset"] || "LMC";
const ISSUE_AMOUNT = opts["issue-amount"];
const AMOUNT_TO_CLIENT = opts["client-amount"];

function getPubKey(seed) {
  if (!seed) return null;
  return StellarSdk.Keypair.fromSecret(seed).publicKey();
}

console.log(
  chalk.green(
    `Creating ${ISSUE_AMOUNT} ${ASSET} from
   ${getPubKey(opts["issuer-seed"]) || "a random issuer"},
   to be distributed by
   ${getPubKey(opts["distribution-seed"]) || "a random distributer"}
   with ${AMOUNT_TO_CLIENT} given to
   ${getPubKey(opts["client-seed"]) || "a new client account"}
   on Testnet
   `
  )
);
readlineSync.question("Continue? ");

const accounts = {};
async function createAccount(name) {
  const pair = opts[`${name}-seed`]
    ? StellarSdk.Keypair.fromSecret(opts[`${name}-seed`])
    : StellarSdk.Keypair.random();
  console.log(
    chalk.green(`========== Creating/funding ${name} account ==========`)
  );
  console.log("> Seed: " + pair.secret());
  console.log("> Pub : " + pair.publicKey());

  await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
  accounts[name] = pair;
  return pair;
}

async function generate() {
  const issuerKey = await createAccount("issuer");
  const distributionKey = await createAccount("distribution");

  const asset = new StellarSdk.Asset(ASSET, issuerKey.publicKey());
  const [fee, distributionAccount] = await Promise.all([
    server.fetchBaseFee(),
    server.loadAccount(distributionKey.publicKey())
  ]);

  console.log(
    chalk.green("Creating trust-line and issuing to distribution account")
  );
  const trustAndIssueTx = new StellarSdk.TransactionBuilder(
    distributionAccount,
    {
      fee,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }
  )
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset,
        limit: String(ISSUE_AMOUNT)
      })
    )
    .addOperation(
      StellarSdk.Operation.payment({
        destination: distributionKey.publicKey(),
        asset,
        amount: String(ISSUE_AMOUNT),
        source: issuerKey.publicKey()
      })
    )
    .setTimeout(100)
    .build();
  trustAndIssueTx.sign(issuerKey);
  trustAndIssueTx.sign(distributionKey);
  const issueResult = await server.submitTransaction(trustAndIssueTx);

  if (AMOUNT_TO_CLIENT > 0) {
    const clientKey = await createAccount("client");
    console.log(chalk.green(`Sending ${AMOUNT_TO_CLIENT} ${ASSET} to client`));
    const clientAccount = await server.loadAccount(clientKey.publicKey());
    const sendToClientTx = new StellarSdk.TransactionBuilder(clientAccount, {
      fee,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: clientKey.publicKey(),
          asset,
          amount: String(AMOUNT_TO_CLIENT),
          source: distributionKey.publicKey()
        })
      )
      .setTimeout(100)
      .build();
    sendToClientTx.sign(clientKey);
    sendToClientTx.sign(distributionKey);
    await server.submitTransaction(sendToClientTx);
  }

  Object.keys(accounts).forEach(name => {
    console.log(
      chalk.green(
        `> ${name}: https://stellar.expert/explorer/testnet/account/${accounts[
          name
        ].publicKey()}`
      )
    );
  });
}

generate();
