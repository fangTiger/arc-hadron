const endpoints = [
  {
    method: "GET",
    path: "/v1/assets",
    title: "Asset catalog",
    description: "List tokenized RWA instruments, issuers, categories, share scale, and current offering state.",
  },
  {
    method: "GET",
    path: "/v1/orders/listings",
    title: "Sell-side listings",
    description: "Query active sell orders by token, seller, price range, or remaining share amount.",
  },
  {
    method: "GET",
    path: "/v1/orders/bids",
    title: "Buy-side bids",
    description: "Query active buy orders by token, bidder, price range, or remaining share amount.",
  },
  {
    method: "GET",
    path: "/v1/trades",
    title: "Trade tape",
    description: "Read primary sales, listing fills, bid fills, cancellations, and settlement transaction hashes.",
  },
  {
    method: "POST",
    path: "/v1/trades/broadcast",
    title: "Signed transaction broadcast",
    description:
      "Broadcast caller-signed raw transactions after partners prepare calldata and collect wallet authorization client-side.",
  },
];

const principles = [
  "API keys are issued directly by the HADRON team.",
  "No public application flow is exposed in the product.",
  "Every trading action remains bound to wallet authorization or a signed chain transaction.",
];

const tradingEndpoints = [
  {
    method: "POST",
    path: "/v1/orders/listings/prepare",
    title: "Prepare sell listing",
    description:
      "Build market contract calldata for list(tokenId, amount, pricePerShare) after the caller confirms ERC-1155 approval requirements.",
    fields: "tokenId, amount, pricePerShare, idempotencyKey",
    returns: "to, calldata, value, chainId, approvalRequired",
  },
  {
    method: "POST",
    path: "/v1/orders/bids/prepare",
    title: "Prepare buy bid",
    description:
      "Build calldata and native USDC value for placeBid(tokenId, amount, pricePerShare) without moving funds server-side.",
    fields: "tokenId, amount, pricePerShare, idempotencyKey",
    returns: "to, calldata, value, chainId",
  },
  {
    method: "POST",
    path: "/v1/orders/listings/{listingId}/buy/prepare",
    title: "Prepare listing purchase",
    description:
      "Read the active listing, build buy(listingId, amount) calldata, and return the native USDC value required for the caller-signed transaction.",
    fields: "amount, idempotencyKey",
    returns: "to, calldata, value, pricePerShare, chainId",
  },
  {
    method: "POST",
    path: "/v1/orders/bids/{bidId}/fill/prepare",
    title: "Prepare bid fill",
    description:
      "Read the active bid, build fillBid(bidId, amount) calldata, and flag the holder-side ERC-1155 approval requirement.",
    fields: "amount, idempotencyKey",
    returns: "to, calldata, value, pricePerShare, approvalRequired",
  },
  {
    method: "POST",
    path: "/v1/orders/cancel/prepare",
    title: "Prepare listing or bid cancellation",
    description:
      "Build cancel(orderId) or cancelBid(orderId) calldata while preserving the same chain ownership rules as the app.",
    fields: "orderType, orderId, idempotencyKey",
    returns: "to, calldata, value, chainId",
  },
  {
    method: "POST",
    path: "/v1/trades/broadcast",
    title: "Broadcast signed transaction",
    description:
      "Submit an already signed raw transaction to Arc RPC. HADRON never receives or stores the caller private key.",
    fields: "signedTx, idempotencyKey",
    returns: "txHash, status, explorerUrl",
  },
  {
    method: "GET",
    path: "/v1/transactions/{txHash}",
    title: "Transaction status",
    description:
      "Check broadcast, pending, confirmed, or reverted state for a transaction hash plus decoded HADRON action metadata.",
    fields: "txHash",
    returns: "status, confirmations, eventType, blockNumber",
  },
];

const errorCodes = [
  ["400 INVALID_ORDER", "Malformed amount, price, token, listing, or bid input."],
  ["401 INVALID_API_KEY", "Missing or disabled team-issued partner key."],
  ["409 NONCE_REPLAY", "Duplicate idempotencyKey or already-used signed payload."],
  ["422 SIGNATURE_REQUIRED", "Broadcast requires a caller-signed raw transaction."],
  ["429 RATE_LIMITED", "Partner request budget exceeded; retry after the returned interval."],
];

export default function DeveloperApiPage() {
  return (
    <main className="hadron-shell pb-20 pt-6 text-text sm:pb-24 sm:pt-9">
      <div
        className="grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
        data-reading-layout
      >
        <section className="min-w-0 space-y-10" data-developer-api-docs>
          <div className="border-y border-border/80 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neon">
              HADRON Developer Surface
            </p>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.12] tracking-normal text-text sm:text-4xl">
              Developer API for market queries and signed trading workflows
            </h1>
            <p
              className="mt-4 max-w-3xl text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6"
              data-api-copy
            >
              A lightweight REST interface for partners that need to inspect RWA instruments,
              order depth, and settlement activity while keeping transaction authority at the wallet
              or signed-transaction layer.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="border border-neon/35 bg-neon/10 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neon">
                Read-only query APIs are live
              </div>
              <div className="border border-border/80 bg-panel/45 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Trading APIs require issued keys
              </div>
            </div>
          </div>

          <section aria-labelledby="access-model" className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Access
              </p>
              <h2 id="access-model" className="mt-2 text-xl font-semibold text-text">
                Team-issued keys, no public signup
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {principles.map((principle) => (
                <div
                  className="border border-border/80 bg-panel/45 p-4 text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6"
                  key={principle}
                >
                  {principle}
                </div>
              ))}
            </div>
            <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
              <code>{`Authorization: Bearer hadron_live_xxx
X-Hadron-Client: partner-desk
Content-Type: application/json`}</code>
            </pre>
          </section>

          <section aria-labelledby="rest-surface" className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                REST surface
              </p>
              <h2 id="rest-surface" className="mt-2 text-xl font-semibold text-text">
                Query first, trade with explicit signatures
              </h2>
            </div>
            <div className="divide-y divide-border/70 border border-border/80">
              {endpoints.map((endpoint) => (
                <article
                  aria-label={`${endpoint.method} ${endpoint.path}`}
                  className="grid gap-3 bg-panel/35 p-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-start sm:p-5"
                  key={`${endpoint.method} ${endpoint.path}`}
                >
                  <div className="font-mono text-xs uppercase tracking-[0.14em]">
                    <span className={endpoint.method === "GET" ? "text-neon" : "text-up"}>
                      {endpoint.method}
                    </span>
                    <span className="ml-2 text-text">{endpoint.path}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text">{endpoint.title}</h3>
                    <p className="mt-1 text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
                      {endpoint.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="examples" className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Examples
              </p>
              <h2 id="examples" className="mt-2 text-xl font-semibold text-text">
                Minimal request shapes
              </h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`curl https://api.hadron.exchange/v1/orders/listings?tokenId=1 \\
  -H "Authorization: Bearer hadron_live_xxx"`}</code>
              </pre>
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`POST /v1/trades/broadcast
{
  "signedTx": "0x02f8...",
  "idempotencyKey": "desk-20260707-002"
}`}</code>
              </pre>
            </div>
          </section>

          <section aria-labelledby="trading-api" className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Trading API
              </p>
              <h2 id="trading-api" className="mt-2 text-xl font-semibold text-text">
                Practical order operations, still wallet-authorized
              </h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
                These endpoints are callable with a team-issued API key. Prepare routes return
                calldata and value; broadcast accepts only caller-signed raw transactions.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {tradingEndpoints.map((endpoint) => (
                <article
                  aria-label={`${endpoint.method} ${endpoint.path}`}
                  className="border border-border/80 bg-panel/35 p-4 sm:p-5"
                  key={`${endpoint.method} ${endpoint.path}`}
                >
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em]">
                    <span className={endpoint.method === "GET" ? "text-neon" : "text-up"}>
                      {endpoint.method}
                    </span>
                    <span className="text-text">{endpoint.path}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-text">{endpoint.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
                    {endpoint.description}
                  </p>
                  <dl className="mt-4 grid gap-2 border-t border-border/70 pt-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                    <div className="grid gap-1 sm:grid-cols-[88px_minmax(0,1fr)]">
                      <dt className="text-muted">Request</dt>
                      <dd className="text-text-dim">{endpoint.fields}</dd>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-[88px_minmax(0,1fr)]">
                      <dt className="text-muted">Returns</dt>
                      <dd className="text-text-dim">{endpoint.returns}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`POST /v1/orders/listings/prepare
{
  "tokenId": "1",
  "amount": "1050",
  "pricePerShare": "1012500000000000000",
  "idempotencyKey": "desk-20260707-001"
}`}</code>
              </pre>
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`{
  "to": "0xmarket...",
  "chainId": 5042002,
  "functionName": "list",
  "calldata": "0x...",
  "value": "0",
  "approvalRequired": true
}`}</code>
              </pre>
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`POST /v1/orders/listings/{listingId}/buy/prepare
{
  "amount": "200",
  "idempotencyKey": "desk-20260707-002"
}`}</code>
              </pre>
              <pre className="hadron-scroll-frame border border-border/80 bg-bg/80 p-3 font-mono text-[11px] leading-5 text-text sm:p-4 sm:text-xs sm:leading-6">
                <code>{`{
  "functionName": "buy",
  "calldata": "0x...",
  "value": "202500000000000000000",
  "pricePerShare": "1012500000000000000"
}`}</code>
              </pre>
            </div>
          </section>

          <section aria-labelledby="error-model" className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Error model
              </p>
              <h2 id="error-model" className="mt-2 text-xl font-semibold text-text">
                Small set of predictable failures
              </h2>
            </div>
            <div className="divide-y divide-border/70 border border-border/80">
              {errorCodes.map(([code, description]) => (
                <div
                  className="grid gap-2 bg-panel/35 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-5"
                  key={code}
                >
                  <div className="font-mono text-xs uppercase tracking-[0.12em] text-down">
                    {code}
                  </div>
                  <p className="text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="min-w-0 space-y-4 border-y border-border/80 py-5 lg:sticky lg:top-24">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Boundary
            </p>
            <h2 className="mt-2 text-lg font-semibold text-text">No hosted custody</h2>
          </div>
          <p className="text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
            The lightweight API does not hold user assets, generate private keys, or submit
            discretionary orders on behalf of partners. Buy, sell, bid, cancel, and fill flows
            require explicit wallet authority before they touch Arc testnet.
          </p>
          <dl className="space-y-3 border-t border-border/70 pt-4 font-mono text-[10px] uppercase tracking-[0.16em]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Network</dt>
              <dd className="text-text">Arc testnet</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Settlement</dt>
              <dd className="text-text">Native USDC</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Custody</dt>
              <dd className="text-text">Caller wallet</dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
