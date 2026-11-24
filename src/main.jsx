import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Layout from "./components/Layout.jsx";
import "./styles.css";

// Each page loads its own code when first visited, so phones download less up front.
const Member = lazy(() => import("./pages/Member.jsx"));
const Bill = lazy(() => import("./pages/Bill.jsx"));
const MemberVotes = lazy(() => import("./pages/MemberVotes.jsx"));
const Methods = lazy(() => import("./pages/Methods.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Members = lazy(() => import("./pages/Members.jsx"));
const Bills = lazy(() => import("./pages/Bills.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));
const Committees = lazy(() => import("./pages/Committees.jsx"));
const Committee = lazy(() => import("./pages/Committee.jsx"));
const Week = lazy(() => import("./pages/Week.jsx"));
const Glossary = lazy(() => import("./pages/Glossary.jsx"));
const Quiz = lazy(() => import("./pages/Quiz.jsx"));
const Topics = lazy(() => import("./pages/Topics.jsx"));
const Topic = lazy(() => import("./pages/Topic.jsx"));
const Elections = lazy(() => import("./pages/Elections.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/members" element={<Members />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/week" element={<Week />} />
        <Route path="/glossary" element={<Glossary />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/topic/:slug" element={<Topic />} />
        <Route path="/elections" element={<Elections />} />
        <Route path="/committees" element={<Committees />} />
        <Route path="/committee/:id" element={<Committee />} />
        <Route path="/member/:bioguide" element={<Member />} />
        <Route path="/member/:bioguide/votes" element={<MemberVotes />} />
        <Route path="/bill/:congress/:type/:number" element={<Bill />} />
        <Route path="/methods" element={<Methods />} />
        <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
