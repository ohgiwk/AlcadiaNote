import { LogIn, LogOut, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { Button, Sheet } from "./ui";

type Mode = "login" | "register";

export function AuthDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, linkGoogle, login, logout, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const permanentUser = user && !user.isAnonymous;

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmation("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") await register(email.trim(), password);
      else await login(email.trim(), password);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "認証に失敗しました。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function google() {
    setError("");
    setSubmitting(true);
    try {
      await linkGoogle();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "認証に失敗しました。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function leave() {
    setError("");
    setSubmitting(true);
    try {
      await logout();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ログアウトに失敗しました。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="アカウント" variant="dialog">
      <div className="auth-dialog-content">
        {permanentUser ? (
          <div className="auth-account">
            <div className="auth-avatar">
              {user.email?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>ログイン中</strong>
              <p>{user.email ?? user.displayName ?? "Googleアカウント"}</p>
            </div>
            {error && <p className="form-error">{error}</p>}
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void leave()}
            >
              <LogOut size={17} />
              {submitting ? "ログアウト中…" : "ログアウト"}
            </Button>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="認証方法">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
              >
                ログイン
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => changeMode("register")}
              >
                新規登録
              </button>
            </div>
            <p className="auth-description">
              {mode === "register"
                ? "現在のゲストデータを引き継いでアカウントを作成します。"
                : "登録済みのアカウントで本棚を開きます。"}
            </p>
            <form
              className="auth-form"
              onSubmit={(event) => void submit(event)}
            >
              <label>
                メールアドレス
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                パスワード
                <input
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {mode === "register" && (
                <label>
                  パスワード（確認）
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              )}
              {error && <p className="form-error">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {mode === "register" ? (
                  <UserPlus size={17} />
                ) : (
                  <LogIn size={17} />
                )}
                {submitting
                  ? "処理中…"
                  : mode === "register"
                    ? "アカウントを作成"
                    : "ログイン"}
              </Button>
            </form>
            <div className="auth-divider">
              <span>または</span>
            </div>
            <Button
              type="button"
              className="google-auth"
              disabled={submitting}
              onClick={() => void google()}
            >
              Googleで続ける
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
