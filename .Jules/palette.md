# Palette's Journal - Critical UX & Accessibility Learnings

## 2026-08-11 - [Enhanced AI Assistant Chat Usability & Accessibility]
**Learning:** Conversational and floating drawers (like AI chat assistants) are high-engagement features, but they often suffer from poor focus management, lack of auto-scrolling on multi-line text streaming, and heavy reliance on pointer actions. By adding (1) automatic smooth scrolling via DOM ref anchors, (2) automated focus handling upon state transitions (focusing the search input on open), and (3) non-conflicting keyboard shortcuts like `Alt + A` or `Ctrl + I`, we dramatically lower cognitive load and improve keyboard navigation for screen readers and power users alike.
**Action:** When designing or updating modal drawers or chat systems in the design system, always implement a `messagesEndRef` auto-scroll anchor, bind state-based focus, and offer global keyboard overrides with proper active-element typing checks.

## 2026-08-11 - [Bespoke Institutional AI vs Generic Chatbot UI Patterns]
**Learning:** Generic, templated "chatbot" UIs with emojis, default colors, and basic styling feel foreign to high-fidelity, customized applications and reduce trust. Aligning the assistant's aesthetic—such as header colors (`#023246`), metadata, sub-branding (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam), customized suggestion chips with Lucide icons (`HelpCircle`, `Clock`, `FileText`), and message bubble branding—greatly increases system coherence and provides a premium, highly professional visual finish.
**Action:** Always avoid generic UI elements and default emojis in core interactive panels. Fully adopt the application's design system tokens, typography, and precise Lucide icon sets to maintain high visual polish.
