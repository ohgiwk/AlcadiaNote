import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryConstraint,
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
export function useCollection<T>(
  path: string,
  constraints: QueryConstraint[] = [orderBy("createdAt", "desc")],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (s) => {
        setData(s.docs.map((d) => clean<T>(d.id, d.data())));
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    // Query constraints are intentionally recreated by callers; path/auth changes remount the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return { data, loading, error };
}
export function useDocument<T>(path?: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path && firebaseConfigured));
  useEffect(() => {
    if (!path || !firebaseConfigured) return;
    return onSnapshot(doc(db, path), (s) => {
      setData(s.exists() ? clean<T>(s.id, s.data()) : null);
      setLoading(false);
    });
  }, [path]);
  return { data, loading };
}
