import About from "@/components/About";
import Contact from "@/components/Contact";
import GetInvolved from "@/components/GetInvolved";
import Hero from "@/components/Hero";
import Partners from "@/components/Partners";
import Program from "@/components/Program";
import Recap from "@/components/Recap";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Speakers from "@/components/Speakers";

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <About />
        <Speakers />
        <Program />
        <GetInvolved />
        <Partners />
        <Recap />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
