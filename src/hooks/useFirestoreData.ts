import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type OrderByDirection,
  type WhereFilterOp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, firebaseConfigured } from "../firebase";

const clean = <T>(id: string, data: DocumentData) =>
  ({
    id,
    ...data,
    createdAt:
      data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt ?? "",
    updatedAt:
      data.updatedAt?.toDate?.().toISOString?.() ?? data.updatedAt ?? "",
    startedAt:
      data.startedAt?.toDate?.().toISOString?.() ?? data.startedAt ?? "",
  }) as T;
type CollectionFilter = readonly [string, WhereFilterOp, unknown];
type CollectionOrder = readonly [string, OrderByDirection];

interface CollectionOptions {
  enabled?: boolean;
  filters?: readonly CollectionFilter[];
  order?: CollectionOrder | null;
}

export function useCollection<T>(
  path: string,
  options: CollectionOptions = {},
) {
  const enabled = options.enabled ?? true;
  const filtersKey = JSON.stringify(options.filters ?? []);
  const defaultOrder: CollectionOrder | null = options.filters
    ? null
    : ["createdAt", "desc"];
  const orderKey = JSON.stringify(
    options.order === undefined ? defaultOrder : options.order,
  );
  const requestKey = `${path}:${filtersKey}:${orderKey}`;
  const [state, setState] = useState<{
    key: string;
    data: T[];
    error: string;
  }>({ key: "", data: [], error: "" });
  useEffect(() => {
    if (!enabled || !firebaseConfigured) return;
    const filters = (JSON.parse(filtersKey) as CollectionFilter[]).map(
      ([field, operator, value]) => where(field, operator, value),
    );
    const parsedOrder = JSON.parse(orderKey) as CollectionOrder | null;
    const constraints = parsedOrder
      ? [...filters, orderBy(parsedOrder[0], parsedOrder[1])]
      : filters;
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (s) => {
        setState({
          key: requestKey,
          data: s.docs.map((d) => clean<T>(d.id, d.data())),
          error: "",
        });
      },
      (e) => {
        setState({ key: requestKey, data: [], error: e.message });
      },
    );
  }, [enabled, filtersKey, orderKey, path, requestKey]);
  const active = enabled && firebaseConfigured;
  const current = active && state.key === requestKey;
  return {
    data: current ? state.data : [],
    loading: active && !current,
    error: current ? state.error : "",
  };
}
export function useDocument<T>(path?: string) {
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!path || !firebaseConfigured) return;
    return onSnapshot(
      doc(db, path),
      (snapshot) => {
        setState({
          key: path,
          data: snapshot.exists()
            ? clean<T>(snapshot.id, snapshot.data())
            : null,
          error: "",
        });
      },
      (reason) => {
        setState({ key: path, data: null, error: reason.message });
      },
    );
  }, [path]);
  const active = Boolean(path && firebaseConfigured);
  const current = active && state.key === path;
  return {
    data: current ? state.data : null,
    loading: active && !current,
    error: current ? state.error : "",
  };
}
