import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, firebaseConfigured } from "./firebase";

type AuthValue = {
  user: User | null;
  loading: boolean;
  error: string;
  linkGoogle: () => Promise<void>;
};
const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  error: "",
  linkGoogle: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        if (!next && firebaseConfigured) {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            console.error(e);
            setError(
              e instanceof Error
                ? e.message
                : "Firebase Authenticationを開始できませんでした。",
            );
            setLoading(false);
          }
          return;
        }
        setUser(next);
        setLoading(false);
      }),
    [],
  );
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      error,
      linkGoogle: async () => {
        if (!auth.currentUser) throw new Error("ログイン情報がありません");
        await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      },
    }),
    [user, loading, error],
  );
  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="app-loading">Arcadiaを準備しています…</div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
