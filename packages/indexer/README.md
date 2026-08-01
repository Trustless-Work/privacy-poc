# Indexer package

Adapts the reference Goldsky indexer and handler API. Complete event history is load-bearing because Soroban RPC retains only a recent window and confidential balance openings are reconstructed from events.

The client must validate indexed data against on-chain commitments; the indexer is not a source of cryptographic truth.
