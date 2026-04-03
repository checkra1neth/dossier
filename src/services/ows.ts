/**
 * Thin wrapper around OWS (Open Wallet Standard) operations.
 *
 * Uses the Node SDK for wallet info and shells out to the OWS CLI
 * for transaction signing (the CLI is a Rust binary).
 */

import { execSync } from "node:child_process";
import {
  getWallet as owsGetWallet,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";

export interface WalletInfo {
  name: string;
  address: string;
}

/**
 * Look up an OWS wallet by name and return its EVM address.
 */
export function getWalletInfo(walletName: string): WalletInfo {
  const wallet = owsGetWallet(walletName);
  if (!wallet) throw new Error(`OWS wallet "${walletName}" not found`);

  const evmAccount = wallet.accounts.find(
    (a: { chainId: string }) => a.chainId.startsWith("eip155:"),
  );
  if (!evmAccount) {
    throw new Error(`No EVM account in wallet "${walletName}"`);
  }

  return { name: walletName, address: evmAccount.address as string };
}

/**
 * List all OWS wallets with their EVM addresses.
 */
export function listAllWallets(): WalletInfo[] {
  const wallets = owsListWallets();
  return wallets
    .map((w: { name: string }) => {
      try {
        return getWalletInfo(w.name);
      } catch {
        return null;
      }
    })
    .filter((w): w is WalletInfo => w !== null);
}

/**
 * Sign and broadcast a raw transaction via the OWS CLI.
 * Returns the CLI output (typically the transaction hash).
 */
export function signAndSendTx(
  walletName: string,
  chain: string,
  txHex: string,
): string {
  const cmd = `ows sign send-tx --chain ${chain} --wallet "${walletName}" --tx "${txHex}" --no-passphrase 2>&1`;
  const result = execSync(cmd, { encoding: "utf-8", timeout: 30_000 });
  return result.trim();
}

/**
 * Sign a raw transaction without broadcasting.
 * Returns the signed transaction hex.
 */
export function signTx(
  walletName: string,
  chain: string,
  txHex: string,
): string {
  const cmd = `ows sign tx --chain ${chain} --wallet "${walletName}" --tx "${txHex}" --no-passphrase 2>&1`;
  const result = execSync(cmd, { encoding: "utf-8", timeout: 30_000 });
  return result.trim();
}
