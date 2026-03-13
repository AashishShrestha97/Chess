import React from "react";
import Header from "../components/LandingPage/Header";
import FeaturesSection from "../components/LandingPage/FeaturesSection";
import CallToAction from "../components/LandingPage/CallToAction";
import Footer from "../components/LandingPage/Footer";
import "./LandingPage.css";

const LandingPage: React.FC = () => {
  React.useEffect(() => {
    document.body.setAttribute("data-public-page", "true");
    return () => document.body.removeAttribute("data-public-page");
  }, []);
  return (
    <>
      <Header />
      <main>
        <FeaturesSection />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;
