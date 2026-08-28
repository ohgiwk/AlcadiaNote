import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
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
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  error: "",
  linkGoogle: async () => {},
  register: async () => {},
  login: async () => {},
  logout: async () => {},
});

function authErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "このメールアドレスはすでに登録されています。",
    "auth/invalid-credential":
      "メールアドレスまたはパスワードが正しくありません。",
    "auth/invalid-email": "メールアドレスの形式を確認してください。",
    "auth/missing-password": "パスワードを入力してください。",
    "auth/weak-password": "パスワードは6文字以上で入力してください。",
    "auth/too-many-requests":
      "試行回数が多すぎます。時間をおいてから再度お試しください。",
    "auth/network-request-failed": "ネットワーク接続を確認してください。",
    "auth/popup-closed-by-user": "Googleログインがキャンセルされました。",
  };
  return messages[code ?? ""] ?? "認証処理を完了できませんでした。";
}

async function asJapaneseAuthError(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    throw new Error(authErrorMessage(error), { cause: error });
  }
}

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
        await asJapaneseAuthError(async () => {
          const provider = new GoogleAuthProvider();
          if (auth.currentUser?.isAnonymous) {
            try {
              await linkWithPopup(auth.currentUser, provider);
              return;
            } catch (error) {
              if (
                (error as { code?: string })?.code !==
                "auth/credential-already-in-use"
              ) {
                throw error;
              }
            }
          }
          await signInWithPopup(auth, provider);
        });
      },
      register: async (email, password) => {
        await asJapaneseAuthError(async () => {
          const current = auth.currentUser;
          if (current?.isAnonymous) {
            await linkWithCredential(
              current,
              EmailAuthProvider.credential(email, password),
            );
            return;
          }
          await createUserWithEmailAndPassword(auth, email, password);
        });
      },
      login: async (email, password) => {
        await asJapaneseAuthError(() =>
          signInWithEmailAndPassword(auth, email, password),
        );
      },
      logout: async () => {
        await asJapaneseAuthError(() => signOut(auth));
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
