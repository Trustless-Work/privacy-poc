/**
 * Shared RPC client + indexer construction for a deployment. Every persona
 * page and the wallet need the same `{rpcUrl, networkPassphrase, contracts}`
 * ChainClient and the same conditional IndexerClient — this is the one place
 * that builds them.
 */
import { ChainClient, IndexerClient, UmbraHistoryClient } from "@ctd/sdk";
import type { Deployment } from "./deployment";

export function clientsFor(deployment: Deployment): {
  client: ChainClient;
  indexer?: IndexerClient;
  accountHistory?: UmbraHistoryClient;
} {
  const client = new ChainClient({
    rpcUrl: deployment.rpcUrl,
    networkPassphrase: deployment.networkPassphrase,
    contracts: deployment.contracts,
  });
  const indexer = deployment.indexerUrl
    ? new IndexerClient({ baseUrl: deployment.indexerUrl })
    : undefined;
  const accountHistory = deployment.accountHistoryUrl
    ? new UmbraHistoryClient({ baseUrl: deployment.accountHistoryUrl })
    : undefined;
  return { client, indexer, accountHistory };
}
