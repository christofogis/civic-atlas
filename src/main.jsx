import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Member from "./pages/Member.jsx";
import Bill from "./pages/Bill.jsx";
import MemberVotes from "./pages/MemberVotes.jsx";
import Methods from "./pages/Methods.jsx";
import Search from "./pages/Search.jsx";
import Members from "./pages/Members.jsx";
import Bills from "./pages/Bills.jsx";
import Compare from "./pages/Compare.jsx";
import Committees from "./pages/Committees.jsx";
import Committee from "./pages/Committee.jsx";
import Layout from "./components/Layout.jsx";
import Week from "./pages/Week.jsx";
import Glossary from "./pages/Glossary.jsx";
import NotFound from "./pages/NotFound.jsx";
import "./styles.css";

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
