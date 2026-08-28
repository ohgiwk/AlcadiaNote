import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";
import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { CreatePage } from "./pages/CreatePage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { HomePage } from "./pages/HomePage";
import {
  DashboardPage,
  KnowledgeMapPage,
  RoadmapPage,
} from "./pages/LearningPages";
import { LibraryPage } from "./pages/LibraryPage";
import { NotesPage } from "./pages/NotesPage";
import { QuizPage } from "./pages/QuizPage";
import { ReaderPage } from "./pages/ReaderPage";
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
        <Routes location={location}>
          <Route path="/" element={<Splash />} />
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/knowledge-map" element={<KnowledgeMapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route path="/textbooks/:id/read/:pageId" element={<ReaderPage />} />
          <Route path="/textbooks/:id/notes" element={<NotesPage />} />
          <Route path="/textbooks/:id/quiz" element={<QuizPage />} />
          <Route
            path="/textbooks/:id/flashcards"
            element={<FlashcardsPage />}
          />
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
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
