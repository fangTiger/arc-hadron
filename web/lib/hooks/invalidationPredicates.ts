import type { Query } from "@tanstack/react-query";

type QueryPredicate = (query: Query) => boolean;

interface ReadContractOptions {
  address?: string;
  functionName?: string;
}

interface ReadContractsOptions {
  contracts?: readonly ReadContractOptions[];
}

export function matchesFunctionName(names: readonly string[]): QueryPredicate {
  const set = new Set(names);

  return (query) => {
    const key = query.queryKey;

    if (!Array.isArray(key) || key.length < 2) {
      return false;
    }

    const [kind, options] = key as [unknown, unknown];

    if (kind === "readContract") {
      const fn = (options as ReadContractOptions | undefined)?.functionName;

      return typeof fn === "string" && set.has(fn);
    }

    if (kind === "readContracts") {
      const contracts = (options as ReadContractsOptions | undefined)?.contracts;

      if (!Array.isArray(contracts)) {
        return false;
      }

      return contracts.some((contract) => {
        const fn = contract.functionName;

        return typeof fn === "string" && set.has(fn);
      });
    }

    return false;
  };
}

export function matchesContract(address: `0x${string}`): QueryPredicate {
  const target = address.toLowerCase();

  return (query) => {
    const key = query.queryKey;

    if (!Array.isArray(key) || key.length < 2) {
      return false;
    }

    const [kind, options] = key as [unknown, unknown];

    if (kind === "readContract") {
      const addr = (options as ReadContractOptions | undefined)?.address;

      return typeof addr === "string" && addr.toLowerCase() === target;
    }

    if (kind === "readContracts") {
      const contracts = (options as ReadContractsOptions | undefined)?.contracts;

      if (!Array.isArray(contracts)) {
        return false;
      }

      return contracts.some((contract) => {
        const addr = contract.address;

        return typeof addr === "string" && addr.toLowerCase() === target;
      });
    }

    return false;
  };
}

export function matchesAll(...predicates: QueryPredicate[]): QueryPredicate {
  return (query) => predicates.length > 0 && predicates.every((predicate) => predicate(query));
}

export function matchesAny(...predicates: QueryPredicate[]): QueryPredicate {
  return (query) => predicates.some((predicate) => predicate(query));
}

export type { QueryPredicate };
