/**
 * Laravel uses Softonic GraphQL client with Basic auth:
 * ClientBuilder::build(config('api-urls.graphQlMonitoring'), ['auth' => config('keys.graphQl')]);
 * keys.php: 'graphQl' => ['user1', 'password']
 *
 * Override via MONITORING_GRAPHQL_USER / MONITORING_GRAPHQL_PASSWORD.
 */
export function monitoringGraphQlHeaders(): Record<string, string> {
  const user = process.env.MONITORING_GRAPHQL_USER ?? "user1";
  const password =
    process.env.MONITORING_GRAPHQL_PASSWORD ??
    /* Same default as new-monitoring/config/keys.php (already in repo) */
    "rMqBnVpeTfEWrBV$";

  const token = Buffer.from(`${user}:${password}`, "utf8").toString("base64");

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Basic ${token}`,
  };
}
