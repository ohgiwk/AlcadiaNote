import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import type { ComponentType } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";

const route = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(async () => ({ default: (await loader())[name] as ComponentType }));

const HomePage = route(() => import("./pages/HomePage"), "HomePage");
const CreatePage = route(() => import("./pages/CreatePage"), "CreatePage");
const LibraryPage = route(() => import("./pages/LibraryPage"), "LibraryPage");
const ReaderPage = route(() => import("./pages/ReaderPage"), "ReaderPage");
const QuizPage = route(() => import("./pages/QuizPage"), "QuizPage");
const FlashcardsPage = route(
  () => import("./pages/FlashcardsPage"),
  "FlashcardsPage",
);
const TextbookRoadmapPage = route(
  () => import("./pages/TextbookRoadmapPage"),
  "TextbookRoadmapPage",
);
const KnowledgeMapPage = route(
  () => import("./pages/LearningPages"),
  "KnowledgeMapPage",
);
const DashboardPage = route(
  () => import("./pages/LearningPages"),
  "DashboardPage",
);
function Splash() {
  const nav = useNavigate();
  useEffect(() => {
    const seen = sessionStorage.getItem("arcadia-seen");
    const id = setTimeout(
      () => {
        sessionStorage.setItem("arcadia-seen", "1");
        nav("/home");
      },
      seen ? 450 : 1800,
    );
    return () => clearTimeout(id);
  }, [nav]);
  return (
    <div className="splash">
      <div>
        <BookOpen />
        <Sparkles />
      </div>
      <h1>Arcadia</h1>
      <p>知識は、あなたと育つ。</p>
    </div>
  );
}
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="route-frame"
      >
        <Suspense
          fallback={<div className="app-loading">画面を読み込んでいます…</div>}
        >
          <Routes location={location}>
            <Route path="/" element={<Splash />} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/knowledge-map" element={<KnowledgeMapPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route
              path="/textbooks/:id/read/:pageId"
              element={<ReaderPage />}
            />
            <Route
              path="/textbooks/:id/roadmap"
              element={<TextbookRoadmapPage />}
            />
            <Route
              path="/textbooks/:id/chapters/:chapterId/quiz"
              element={<QuizPage />}
            />
            <Route
              path="/textbooks/:id/flashcards"
              element={<FlashcardsPage />}
            />
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
