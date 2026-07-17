/**
 * The node to force-emit when a dependency-respecting (Kahn) topological sort stalls on a cycle:
 * the git-earliest member of a condensation-source SCC — one no member of which is reached by an
 * edge from outside it, so nothing that must be emitted first is left waiting, leaving only the
 * single unavoidable same-cycle inversion. `successors(n)` lists the nodes that must be emitted
 * AFTER `n` (n → m ⇒ n before m), the same direction the caller's Kahn consumes; `rank` is the
 * deterministic git-order tie-break. A stall always holds a source, so the git-earliest fallback
 * only bounds the search rather than trusting that invariant.
 *
 * SCC membership is orientation-independent, so the two Kahn spines that break cycles this way —
 * file grain in `book.ts` (dependencies-first) and chunk grain in `chapters.ts` (call-path) —
 * share this one policy instead of maintaining two Tarjans in lockstep.
 */
export function sourceSccToBreak<T>(
  nodes: readonly T[],
  successors: (n: T) => Iterable<T>,
  rank: (n: T) => number,
): T {
  const present = new Set(nodes);
  const sccs = stronglyConnected(nodes, successors, present);
  const sccOf = new Map<T, number>();
  sccs.forEach((scc, i) => scc.forEach((n) => sccOf.set(n, i)));

  const hasExternalPred = new Array<boolean>(sccs.length).fill(false);
  for (const u of nodes) {
    for (const v of successors(u)) {
      if (!present.has(v)) continue;
      const sv = sccOf.get(v)!;
      if (sv !== sccOf.get(u)!) hasExternalPred[sv] = true;
    }
  }

  const earlier = (a: T, b: T) => (rank(a) <= rank(b) ? a : b);
  let best: T | undefined;
  for (let i = 0; i < sccs.length; i++) {
    if (hasExternalPred[i]) continue;
    const earliest = sccs[i]!.reduce(earlier);
    if (best === undefined || rank(earliest) < rank(best)) best = earliest;
  }
  return best ?? nodes.reduce(earlier);
}

/** Tarjan SCCs of the subgraph `successors` induces on `nodes`; deterministic given node and edge order. */
function stronglyConnected<T>(nodes: readonly T[], successors: (n: T) => Iterable<T>, present: Set<T>): T[][] {
  const index = new Map<T, number>();
  const low = new Map<T, number>();
  const onStack = new Set<T>();
  const stack: T[] = [];
  const sccs: T[][] = [];
  let counter = 0;

  const connect = (v: T) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of successors(v)) {
      if (!present.has(w)) continue;
      if (!index.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const scc: T[] = [];
      let w: T;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  };

  for (const v of nodes) if (!index.has(v)) connect(v);
  return sccs;
}
