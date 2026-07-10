import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Questions from "./pages/Questions";
import FAQs from "./pages/FAQs";
import FAQDetail from "./pages/FAQDetail";
import QuestionDetail from "./pages/QuestionDetail";
import Categories from "./pages/Categories";
import Contributors from "./pages/Contributors";
import Bookmarks from "./pages/Bookmarks";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Landing from "./pages/Landing";
import Subscription from "./pages/Subscription";
import Admin from "./pages/Admin";
import ChatWidget from "./components/ChatWidget";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/faqs/:id" element={<FAQDetail />} />
        <Route path="/questions/:id" element={<QuestionDetail />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/contributors" element={<Contributors />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/subscription" element={<Subscription/>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <ChatWidget />
    </>
  );
}
export default App;