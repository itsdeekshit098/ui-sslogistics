"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Truck,
  Bus,
  Car,
  Package,
  MapPin,
  ShieldCheck,
  Clock,
  Phone,
  MessageCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { PartnerLogo } from "@/components/ui/partner-logo";

const services = [
  {
    title: "Employee Transport",
    description:
      "Safe and punctual pickup & drop services for KIA employees via buses and cabs.",
    icon: Bus,
  },
  {
    title: "Corporate Cars",
    description:
      "Premium fleet of cars for executive travel and client visits.",
    icon: Car,
  },
  {
    title: "Tempo Travellers",
    description: "Flexible group transport solutions for mid-sized teams.",
    icon: Truck,
  },
  {
    title: "Truck Logistics",
    description:
      "Reliable transport of auto parts between KIA plants and vendors.",
    icon: Package,
  },
];

const features = [
  {
    title: "Andhra Pradesh Focused",
    description:
      "Specialized operations across Anantapur and surrounding industrial hubs.",
    icon: MapPin,
  },
  {
    title: "Compliance & Safety",
    description:
      "Strict adherence to safety protocols and regulatory compliance.",
    icon: ShieldCheck,
  },
  {
    title: "24/7 Reliability",
    description:
      "Round-the-clock operations ensuring zero downtime for your business.",
    icon: Clock,
  },
];

export default function Home() {
  const [showContactOptions, setShowContactOptions] = useState(false);

  const handleContactClick = () => {
    if (window.innerWidth >= 768) {
      // Desktop: WhatsApp only
      window.open("https://wa.me/918143714450", "_blank");
    } else {
      // Mobile: Show options
      setShowContactOptions(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-48 md:pb-32 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-50 dark:bg-indigo-900/30 rounded-full blur-3xl opacity-60 mix-blend-multiply filter pointer-events-none" />
          <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-blue-50 dark:bg-blue-900/30 rounded-full blur-3xl opacity-60 mix-blend-multiply filter pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-50 dark:bg-purple-900/30 rounded-full blur-3xl opacity-60 mix-blend-multiply filter pointer-events-none" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border shadow-sm mb-8 hover:border-primary/50 transition-colors cursor-default">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
              <span className="text-sm font-medium text-muted-foreground">
                The Future of Automotive Logistics
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-6 md:mb-8 text-foreground leading-[1.1]">
              Enterprise Transport <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                Reimagined for Speed
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
              Seamless employee mobility and precision logistics for global
              automotive leaders. Operating with military precision in Andhra
              Pradesh.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button data-testid="app-(public)-button-1"
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 text-base font-medium transition-all hover:scale-105"
                onClick={handleContactClick}
              >
                Start Now
              </Button>
              <Button data-testid="app-(public)-button-2"
                size="lg"
                variant="ghost"
                className="w-full sm:w-auto h-12 px-8 rounded-full text-foreground hover:bg-muted text-base font-medium"
                onClick={handleContactClick}
              >
                Contact Sales →
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 md:py-24 bg-background relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Our Services
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Comprehensive transport solutions tailored for the automotive
              industry&apos;s demanding standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card data-testid="app-(public)-card-1" className="h-full bg-card border border-border shadow-[var(--card-shadow)] hover:shadow-lg transition-all duration-300 rounded-[var(--card-radius)] group cursor-pointer hover:-translate-y-1">
                  <CardHeader className="pb-4">
                    <div className="h-12 w-12 rounded-[var(--input-radius)] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                      <service.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      {service.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base text-muted-foreground leading-relaxed">
                      {service.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted Partners Section */}
      <section className="py-12 md:py-20 bg-muted/30 border-y border-border overflow-hidden">
        <div className="container mx-auto px-4 text-center mb-16">
          <p className="text-base font-bold text-muted-foreground uppercase tracking-[0.2em]">
            Trusted by Industry Leaders
          </p>
        </div>

        <div className="relative flex overflow-x-hidden group">
          {/* Gradient Masks */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-muted/30 dark:from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-muted/30 dark:from-background to-transparent z-10" />

          {/* Marquee Track */}
          <motion.div
            className="flex gap-12 items-center whitespace-nowrap"
            animate={{ x: [0, -1840] }} // (320px width + 48px gap) * 5 items = 1840
            transition={{
              repeat: Infinity,
              duration: 40,
              ease: "linear",
            }}
          >
            {/* First set of partners */}
            {["SLAP", "BOGOOK", "ACT", "SWIFT SUPPORT SERVICE", "SUPREME"].map(
              (partner, i) => (
                <div
                  key={`p1-${i}`}
                  className="relative h-24 w-48 md:h-40 md:w-80 flex items-center justify-center transition-all duration-300 hover:scale-110"
                >
                  <PartnerLogo
                    name={partner}
                    className="h-full w-full object-contain"
                  />
                </div>
              ),
            )}

            {/* Duplicate set for seamless loop */}
            {["SLAP", "BOGOOK", "ACT", "SWIFT SUPPORT SERVICE", "SUPREME"].map(
              (partner, i) => (
                <div
                  key={`p2-${i}`}
                  className="relative h-24 w-48 md:h-40 md:w-80 flex items-center justify-center transition-all duration-300 hover:scale-110"
                >
                  <PartnerLogo
                    name={partner}
                    className="h-full w-full object-contain"
                  />
                </div>
              ),
            )}

            {/* Triplicate set for wider screens */}
            {["SLAP", "BOGOOK", "ACT", "SWIFT SUPPORT SERVICE", "SUPREME"].map(
              (partner, i) => (
                <div
                  key={`p3-${i}`}
                  className="relative h-24 w-48 md:h-40 md:w-80 flex items-center justify-center transition-all duration-300 hover:scale-110"
                >
                  <PartnerLogo
                    name={partner}
                    className="h-full w-full object-contain"
                  />
                </div>
              ),
            )}
          </motion.div>
        </div>
      </section>

      {/* Operations Coverage */}
      <section className="py-16 md:py-32 bg-background overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-20 items-center">
            <div>
              <div className="inline-block mb-6 text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide uppercase text-sm">
                Operational Excellence
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 md:mb-8 text-foreground leading-tight">
                Precision Logistics. <br />
                <span className="text-muted-foreground">Zero Downtime.</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
                We operate with military precision to ensure your workforce and
                cargo reach their destinations on time, every time. Serving the
                heart of Andhra Pradesh&apos;s automotive belt.
              </p>

              <div className="space-y-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-6 group">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-muted flex items-center justify-center text-foreground group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-[400px] md:h-[600px] rounded-[var(--modal-radius)] overflow-hidden shadow-[var(--modal-shadow)] bg-muted border border-border group">
              <iframe
                src="https://maps.google.com/maps?q=14.1637,77.6187&z=15&output=embed"
                className="absolute inset-0 w-full h-full object-cover opacity-90 dark:opacity-75 transition-transform duration-700 group-hover:scale-105"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />

              <div className="absolute bottom-10 left-10 right-10">
                <div className="bg-card/95 backdrop-blur-xl p-6 rounded-[var(--card-radius)] shadow-[var(--card-shadow)] border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Live Operations
                    </span>
                  </div>
                  <p className="text-foreground font-bold text-lg">
                    Anantapur Industrial Hub
                  </p>
                  <p className="text-muted-foreground">
                    Covering KIA Motors, Mobis, and Vendor Park
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/10 pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-20 max-w-4xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 md:mb-8 text-foreground tracking-tight">
            Ready to Optimize Your Logistics?
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get in touch with our operations team to discuss your transport
            requirements and experience the difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button data-testid="app-(public)-button-3"
              size="lg"
              className="w-full sm:w-auto h-14 px-10 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 text-lg font-medium transition-all hover:-translate-y-1"
              onClick={handleContactClick}
            >
              Contact Us Today
            </Button>
          </div>
        </div>
      </section>
      {/* Mobile Contact Options Modal */}
      {showContactOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card rounded-[var(--modal-radius)] shadow-[var(--modal-shadow)] border border-border w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Contact Us</h3>
                <Button data-testid="app-(public)-button-4"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowContactOptions(false)}
                  className="rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid gap-4">
                <Button data-testid="app-(public)-button-5"
                  size="lg"
                  className="w-full gap-3 bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg"
                  asChild
                >
                  <a href="tel:8143714450">
                    <Phone className="h-5 w-5" />
                    Call Now
                  </a>
                </Button>

                <Button data-testid="app-(public)-button-6"
                  size="lg"
                  className="w-full gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white h-14 text-lg"
                  asChild
                >
                  <a
                    href="https://wa.me/918143714450"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
