import { StrictMode, Suspense, lazy as lazyReact } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Layout from "./components/Layout.jsx";
import { LangProvider } from "./lib/i18n.jsx";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "./styles.css";
import { memberPage } from "./lib/memberPage.js";

// On a member page, start fetching its data now, while the page's own code is still downloading.
{
  const m = /^\/member\/([A-Z]\d{6})\/?$/.exec(window.location.pathname);
  if (m) memberPage(m[1]).catch(() => {});
}

// Each page loads its own code when first visited, so phones download less up front. If a
// page's code can't be fetched (usually because a new version was just deployed), reload once
// to pick up the new version instead of showing a broken page.
const lazy = (load) => lazyReact(() => load().catch((err) => {
  const key = "civic-atlas:reloaded";
  if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); window.location.reload(); return new Promise(() => {}); }
  throw err;
}).then((m) => { sessionStorage.removeItem("civic-atlas:reloaded"); return m; }));
const Member = lazy(() => import("./pages/Member.jsx"));
const Bill = lazy(() => import("./pages/Bill.jsx"));
const MemberVotes = lazy(() => import("./pages/MemberVotes.jsx"));
const Methods = lazy(() => import("./pages/Methods.jsx"));
const Status = lazy(() => import("./pages/Status.jsx"));
const YourWeek = lazy(() => import("./pages/YourWeek.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Members = lazy(() => import("./pages/Members.jsx"));
const Bills = lazy(() => import("./pages/Bills.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));
const Committees = lazy(() => import("./pages/Committees.jsx"));
const Committee = lazy(() => import("./pages/Committee.jsx"));
const Week = lazy(() => import("./pages/Week.jsx"));
const Issues = lazy(() => import("./pages/Issues.jsx"));
const Glossary = lazy(() => import("./pages/Glossary.jsx"));
const Quiz = lazy(() => import("./pages/Quiz.jsx"));
const Topics = lazy(() => import("./pages/Topics.jsx"));
const Topic = lazy(() => import("./pages/Topic.jsx"));
const Elections = lazy(() => import("./pages/Elections.jsx"));
const UpForElection = lazy(() => import("./pages/UpForElection.jsx"));
const StyleTest = lazy(() => import("./pages/StyleTest.jsx"));
const Corrections = lazy(() => import("./pages/Corrections.jsx"));
const Nominations = lazy(() => import("./pages/Nominations.jsx"));
const Leadership = lazy(() => import("./pages/Leadership.jsx"));
const ExplainStory = lazy(() => import("./pages/ExplainStory.jsx"));
const Hearing = lazy(() => import("./pages/Hearing.jsx"));
const Government = lazy(() => import("./pages/Government.jsx"));
const Budget = lazy(() => import("./pages/Budget.jsx"));
const Measures = lazy(() => import("./pages/Measures.jsx"));
const FirstTimeVoter = lazy(() => import("./pages/FirstTimeVoter.jsx"));
const Officials = lazy(() => import("./pages/Officials.jsx"));
const County = lazy(() => import("./pages/County.jsx"));
const StatePerson = lazy(() => import("./pages/StatePerson.jsx"));
const EmbedMember = lazy(() => import("./pages/EmbedMember.jsx"));
const MapPage = lazy(() => import("./pages/MapPage.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LangProvider>
    <BrowserRouter>
      <Routes>
        {/* Embeds render without the site header and footer. */}
        <Route path="/embed/member/:id" element={<Suspense fallback={null}><EmbedMember /></Suspense>} />
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
        <Route path="/issues" element={<Issues />} />
        <Route path="/elections" element={<Elections />} />
        <Route path="/on-the-ballot" element={<UpForElection />} />
        <Route path="/style-test" element={<StyleTest />} />
        <Route path="/corrections" element={<Corrections />} />
        <Route path="/nominations" element={<Nominations />} />
        <Route path="/leadership" element={<Leadership />} />
        <Route path="/story" element={<ExplainStory />} />
        <Route path="/hearing/:id" element={<Hearing />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/government" element={<Government />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/measures" element={<Measures />} />
        <Route path="/first-time-voter" element={<FirstTimeVoter />} />
        <Route path="/officials" element={<Officials />} />
        <Route path="/local/:id" element={<County />} />
        <Route path="/state/person/:id" element={<StatePerson />} />
        <Route path="/committees" element={<Committees />} />
        <Route path="/committee/:id" element={<Committee />} />
        <Route path="/member/:bioguide" element={<Member />} />
        <Route path="/member/:bioguide/votes" element={<MemberVotes />} />
        <Route path="/bill/:congress/:type/:number" element={<Bill />} />
        <Route path="/methods" element={<Methods />} />
        <Route path="/status" element={<Status />} />
        <Route path="/your-week" element={<YourWeek />} />
        <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LangProvider>
  </StrictMode>
);

// Installable app: register the service worker in production builds only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
