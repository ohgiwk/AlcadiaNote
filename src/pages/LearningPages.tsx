import {
  ArrowUpRight,
  BookOpen,
  Brain,
  Flame,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { activities, edges, nodes } from "../mock/data";
import { StatCard } from "../components/ui";
export function RoadmapPage() {
  const roadmap = [
    ["産業革命以前のヨーロッパ", "農業社会と商業の発展", "done"],
    ["イギリス産業革命", "技術・資本・市場の結合", "current"],
    ["都市化と労働問題", "工場都市が生んだ課題", "next"],
    ["資本主義と社会主義", "新しい思想と社会運動", "next"],
  ];
  return (
    <div className="page">
      <section className="title-row">
        <div>
          <span className="eyebrow">LEARNING PATH</span>
          <h1>学習ロードマップ</h1>
          <p>知識は一本道ではなく、つながりながら深まっていきます。</p>
        </div>
        <div className="path-progress">
          <strong>2 / 6</strong>
          <span>ステップ完了</span>
        </div>
      </section>
      <div className="roadmap">
        {roadmap.map((x, i) => (
          <article className={x[2]} key={x[0]}>
            <div className="road-number">
              {x[2] === "done" ? (
                "✓"
              ) : x[2] === "current" ? (
                <Sparkles />
              ) : (
                <Lock />
              )}
            </div>
            <section>
              <span>STEP {String(i + 1).padStart(2, "0")}</span>
              <h2>{x[0]}</h2>
              <p>{x[1]}</p>
              <div className="skill-chips">
                <small>{i + 2}ページ</small>
                <small>{i + 1}クイズ</small>
              </div>
            </section>
            {x[2] === "current" && (
              <button>
                学習を続ける <ArrowUpRight />
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
export function KnowledgeMapPage() {
  return (
    <div className="page map-page">
      <section className="title-row">
        <div>
          <span className="eyebrow">KNOWLEDGE GRAPH</span>
          <h1>知識マップ</h1>
          <p>学んだこと同士のつながりを、俯瞰してみましょう。</p>
        </div>
        <div className="map-legend">
          <span>
            <i className="done" />
            学習済み
          </span>
          <span>
            <i className="current" />
            学習中
          </span>
          <span>
            <i />
            未学習
          </span>
        </div>
      </section>
      <div className="map-canvas">
        <svg viewBox="0 0 600 520" role="img" aria-label="産業革命の知識マップ">
          {edges.map((e) => {
            const a = nodes.find((n) => n.id === e.source)!;
            const b = nodes.find((n) => n.id === e.target)!;
            return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
          {nodes.map((n) => (
            <g
              className={n.status}
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
            >
              <circle r={n.type === "era" ? 62 : 48} />
              <text textAnchor="middle" dy="5">
                {n.label}
              </text>
            </g>
          ))}
        </svg>
        <div className="map-controls">
          <button aria-label="拡大">
            <Plus />
          </button>
          <button aria-label="縮小">
            <Minus />
          </button>
          <button aria-label="リセット">
            <RotateCcw />
          </button>
        </div>
        <aside>
          <span className="eyebrow">CURRENT TOPIC</span>
          <h3>産業革命</h3>
          <p>18世紀後半から始まった、生産技術と社会構造の大転換。</p>
          <strong>68% 理解</strong>
        </aside>
      </div>
    </div>
  );
}
export function DashboardPage() {
  return (
    <div className="page">
      <section className="title-row">
        <div>
          <span className="eyebrow">YOUR PROGRESS</span>
          <h1>学習記録</h1>
          <p>小さな積み重ねが、確かな理解に変わっています。</p>
        </div>
        <button className="date-picker">今週⌄</button>
      </section>
      <div className="stat-grid dashboard-stats">
        <StatCard
          label="総学習時間"
          value="18時間 42分"
          detail="今月 +4時間28分"
        />
        <StatCard label="連続学習" value="12日" detail="自己ベスト 15日" />
        <StatCard label="平均理解度" value="84%" detail="前週より +6%" />
        <StatCard label="習得した項目" value="47" detail="今週 +8" />
      </div>
      <div className="dashboard-grid">
        <section className="study-chart">
          <header>
            <div>
              <span className="eyebrow">STUDY TIME</span>
              <h2>今週の学習時間</h2>
            </div>
            <strong>4h 28m</strong>
          </header>
          <div className="bars">
            {[38, 54, 30, 78, 64, 90, 52].map((h, i) => (
              <div key={i}>
                <span style={{ height: `${h}%` }} />
                <small>{"月火水木金土日"[i]}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="understanding">
          <span className="eyebrow">MASTERY</span>
          <h2>章別の理解度</h2>
          {[
            ["変化の前夜", 94],
            ["蒸気が動かした世界", 78],
            ["都市と労働者", 42],
          ].map((x) => (
            <div key={x[0]}>
              <span>
                {x[0]}
                <strong>{x[1]}%</strong>
              </span>
              <div className="progress">
                <i style={{ width: `${x[1]}%` }} />
              </div>
            </div>
          ))}
        </section>
        <section className="activity">
          <span className="eyebrow">RECENT ACTIVITY</span>
          <h2>最近のアクティビティ</h2>
          {activities.map((x, i) => (
            <article key={x.id}>
              <div>
                {i === 0 ? <BookOpen /> : i === 1 ? <Target /> : <Brain />}
              </div>
              <span>
                <strong>{x.title}</strong>
                <small>{x.detail}</small>
              </span>
            </article>
          ))}
        </section>
        <section className="review-card">
          <Flame />
          <span className="eyebrow">REVIEW READY</span>
          <h2>今日の復習</h2>
          <p>忘れかけている知識が8件あります。5分で記憶を定着させましょう。</p>
          <a href="/textbooks/industrial/flashcards">復習をはじめる →</a>
        </section>
      </div>
    </div>
  );
}
