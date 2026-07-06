/**
 * 生成一个可传给 React Query `refetchInterval` 的函数。
 * - SSR（无 document）：始终返回 ms（不阻塞 SSR）
 * - 客户端 document.hidden：返回 false（暂停轮询）
 * - 否则返回 ms（按分层节奏轮询）
 *
 * 必须返回函数而非值，才能让 React Query 在每次 tick 重新求值，
 * 从而实时响应 visibilitychange。
 *
 * 返回签名故意不接收 query 参数（`() => number | false`），
 * 让 TypeScript 结构性子类型系统能适配 wagmi 的 useReadContract /
 * useReadContracts 各种带具体 Error / QueryKey 泛型的 refetchInterval 签名。
 */
export function visibleRefetch(ms: number): () => number | false {
  return () => {
    if (typeof document === "undefined") {
      return ms;
    }
    return document.hidden ? false : ms;
  };
}
