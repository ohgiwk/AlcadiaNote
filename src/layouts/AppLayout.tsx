import {
  BarChart3,
  BookOpen,
  Compass,
  Library,
  Map,
  Menu,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { AuthDialog } from "../components/AuthDialog";
import { IconButton } from "../components/ui";
const links = [
  ["/home", "ホーム", Compass],
  ["/library", "本棚", Library],
  ["/roadmap", "ロードマップ", Map],
  ["/knowledge-map", "知識マップ", Sparkles],
  ["/dashboard", "学習記録", BarChart3],
] as const;
export function AppLayout() {
  const { user, error: authError } = useAuth();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [account, setAccount] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div className="app-shell">
      <aside className={`main-nav ${menu ? "open" : ""}`}>
        <Link className="brand" to="/home" onClick={() => setMenu(false)}>
          <span>
            <BookOpen size={19} />
          </span>
          <strong>Arcadia</strong>
        </Link>
        <nav>
          {links.map(([to, label, I]) => (
            <NavLink key={to} to={to} onClick={() => setMenu(false)}>
              <I size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="new-book" to="/create" onClick={() => setMenu(false)}>
          <Plus size={18} />
          新しい教科書
        </Link>
        <button
          className="profile"
          onClick={() => {
            setMenu(false);
            setAccount(true);
          }}
        >
          <div>{!user ? "!" : user.isAnonymous ? "G" : "✓"}</div>
          <span>
            <strong>
              {!user
                ? authError
                  ? "認証設定エラー"
                  : "Firebase未設定"
                : user.isAnonymous
                  ? "ログイン・新規登録"
                  : "ログイン中"}
            </strong>
            <small>
              {!user
                ? authError
                  ? "Authentication設定を確認"
                  : ".env.localを設定してください"
                : user.isAnonymous
                  ? null
                  : user.email}
            </small>
          </span>
        </button>
      </aside>
      <button
        type="button"
        className={`drawer-backdrop ${menu ? "open" : ""}`}
        aria-label="メニューを閉じる"
        aria-hidden={!menu}
        tabIndex={menu ? 0 : -1}
        onClick={() => setMenu(false)}
      />
      <main className="app-main">
        <header className="topbar">
          <IconButton
            label="メニュー"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </IconButton>
          <button className="global-search" onClick={() => setPalette(true)}>
            <Search size={17} />
            <span>教科書、ノート、キーワードを検索</span>
            <kbd>⌘ K</kbd>
          </button>
        </header>
        <Outlet />
      </main>
      {palette && (
        <div className="command-overlay" onMouseDown={() => setPalette(false)}>
          <div className="command" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <Search />
              <input autoFocus placeholder="どこへ移動しますか？" />
              <IconButton label="閉じる" onClick={() => setPalette(false)}>
                <X />
              </IconButton>
            </header>
            <p>クイックアクセス</p>
            {links.slice(0, 4).map(([to, label, I]) => (
              <button
                key={to}
                onClick={() => {
                  nav(to);
                  setPalette(false);
                }}
              >
                <I size={18} />
                {label}
                <span>↵</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <AuthDialog open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
