"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Clock,
  Send,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  Card,
  H1,
  H2,
  H3,
  Lead,
  Body,
} from "@/components/design-system";

export function ContactFormClient() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    topic: "general",
    message: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-20 border-b border-[#E2DDD5]/60 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="brand" className="mb-4">
                We Are Here to Help
              </Badge>
              <H1 className="mb-6">
                Get in touch with the CareLoop team
              </H1>
              <Lead className="mb-4">
                Have questions about navigating care, coordinating for your family, or partnering with CareLoop? Reach out and a human member of our team will respond.
              </Lead>
            </div>
          </div>
        </section>

        {/* Emergency Warning Banner */}
        <section className="py-6 bg-[#FFFDF9] border-b border-amber-200">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3 text-xs sm:text-sm text-[#191716]">
              <ShieldAlert className="h-5 w-5 text-[#C87D2A] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#191716]">Emergency Notice: </span>
                <span className="text-[#5C5650]">
                  This contact form and CareLoop are not intended for medical emergencies or urgent clinical triage. If you are experiencing chest pain, severe bleeding, or any acute crisis, please dial <strong>911</strong> or proceed directly to an emergency department.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form & Information Grid */}
        <section className="py-16 bg-[#FAF8F5]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
              {/* Left Column: Direct Info */}
              <div className="md:col-span-5 space-y-6">
                <div>
                  <H2 className="text-xl font-bold mb-2">How can we assist you?</H2>
                  <Body className="text-xs text-[#5C5650] leading-relaxed">
                    Select the channel that matches your inquiry. We respect your time and respond promptly.
                  </Body>
                </div>

                <Card variant="elevated" padding="md" className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#191716]">Care Navigation Support</h4>
                      <p className="text-xs text-[#5C5650] mt-0.5">help@careloop.health</p>
                      <p className="text-[11px] text-[#8A8279] mt-0.5">Assistance with ongoing loops and onboarding</p>
                    </div>
                  </div>

                  <div className="border-t border-[#E2DDD5]/60 pt-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156]">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#191716]">Response Times</h4>
                      <p className="text-xs text-[#5C5650] mt-0.5">Monday – Friday: 8am – 8pm EST</p>
                      <p className="text-[11px] text-[#8A8279] mt-0.5">Average response within 1 business day</p>
                    </div>
                  </div>

                  <div className="border-t border-[#E2DDD5]/60 pt-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156]">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#191716]">Employers & Health Plans</h4>
                      <p className="text-xs text-[#5C5650] mt-0.5">partners@careloop.health</p>
                      <p className="text-[11px] text-[#8A8279] mt-0.5">Discuss covering CareLoop for your workforce</p>
                    </div>
                  </div>
                </Card>

                <div className="rounded-xl border border-[#E2DDD5] bg-white p-4 text-xs text-[#5C5650]">
                  <p className="font-semibold text-[#191716] mb-1">Looking for quick answers?</p>
                  <p className="mb-3">Our FAQ addresses the most common questions regarding insurance networks, family profiles, and costs.</p>
                  <Link href="/faq" className="text-xs font-semibold text-[#0E6156] inline-flex items-center gap-1 hover:underline">
                    <span>Browse Frequently Asked Questions</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Contact Form */}
              <div className="md:col-span-7">
                <Card variant="default" padding="xl" className="bg-white border-[#E2DDD5] shadow-soft">
                  {submitted ? (
                    <div className="py-12 text-center space-y-4">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF5F3] text-[#0E6156]">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <H3 className="text-xl font-bold">Message Received</H3>
                      <p className="text-xs text-[#5C5650] max-w-sm mx-auto leading-relaxed">
                        Thank you for reaching out, {formData.name || "there"}. A CareLoop team member will review your note and get back to you within one business day.
                      </p>
                      <div className="pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSubmitted(false);
                            setFormData({ name: "", email: "", topic: "general", message: "" });
                          }}
                        >
                          Send another message
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <h3 className="text-base font-bold text-[#191716] mb-4">Send a secure message</h3>

                      <div>
                        <label htmlFor="name" className="block text-xs font-semibold text-[#191716] mb-1">
                          Full Name
                        </label>
                        <input
                          id="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Sarah Jenkins"
                          className="w-full rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm text-[#191716] placeholder-[#8A8279] focus:border-[#0E6156] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6156]/20"
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-xs font-semibold text-[#191716] mb-1">
                          Email Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="sarah@example.com"
                          className="w-full rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm text-[#191716] placeholder-[#8A8279] focus:border-[#0E6156] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6156]/20"
                        />
                      </div>

                      <div>
                        <label htmlFor="topic" className="block text-xs font-semibold text-[#191716] mb-1">
                          Inquiry Topic
                        </label>
                        <select
                          id="topic"
                          value={formData.topic}
                          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                          className="w-full rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm text-[#191716] focus:border-[#0E6156] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6156]/20"
                        >
                          <option value="general">Help navigating care / Onboarding</option>
                          <option value="family">Managing care for family members</option>
                          <option value="insurance">Insurance & Network questions</option>
                          <option value="employer">Employer / Partner inquiries</option>
                          <option value="other">Other question</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-xs font-semibold text-[#191716] mb-1">
                          How can we help?
                        </label>
                        <textarea
                          id="message"
                          rows={4}
                          required
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Tell us what healthcare situation or questions you're navigating..."
                          className="w-full rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm text-[#191716] placeholder-[#8A8279] focus:border-[#0E6156] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6156]/20"
                        />
                      </div>

                      <div className="pt-2">
                        <Button
                          type="submit"
                          variant="primary"
                          className="w-full justify-center"
                          rightIcon={<Send className="h-4 w-4" />}
                        >
                          Send Message
                        </Button>
                      </div>

                      <p className="text-[11px] text-[#8A8279] text-center mt-3">
                        Your inquiry is protected by strict privacy safeguards. We will never share your contact details.
                      </p>
                    </form>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
