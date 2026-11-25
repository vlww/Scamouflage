// Inline SVG icons (Lucide, ISC license). Only the icons imported here are bundled.
import {
  createElement, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, TriangleAlert, Lock, Cloud, CloudCog,
  Settings, Users, Image, ImageUp, Mail, ClipboardPaste, Link, Clock, BadgeDollarSign, KeyRound, EyeOff,
  Phone, Gift, Paperclip, Info, X, ChevronRight, SendHorizontal, MessageCircle, Laptop, Ban, Cpu, Copy,
  UserRound, Globe, Fingerprint, Sparkles, Check, RefreshCw, WifiOff, Share2, LogIn, Trash2, Radar,
} from 'lucide';

const ICONS = {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, TriangleAlert, Lock, Cloud, CloudCog, Settings, Users,
  Image, ImageUp, Mail, ClipboardPaste, Link, Clock, BadgeDollarSign, KeyRound, EyeOff, Phone, Gift,
  Paperclip, Info, X, ChevronRight, SendHorizontal, MessageCircle, Laptop, Ban, Cpu, Copy, UserRound, Globe,
  Fingerprint, Sparkles, Check, RefreshCw, WifiOff, Share2, LogIn, Trash2, Radar,
};

export function icon(name, size) {
  const node = ICONS[name];
  if (!node) return document.createTextNode('');
  const el = createElement(node);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  if (size) {
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }
  return el;
}

/** Replaces every [data-icon] placeholder's contents with its icon (keeps other children). */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (el.querySelector(':scope > svg.lucide')) continue;
    el.prepend(icon(el.dataset.icon, el.dataset.size));
  }
}

// Icon per warning-sign type.
export const FLAG_ICONS = {
  impersonation: 'UserRound',
  link_mismatch: 'Link',
  lookalike_domain: 'Globe',
  suspicious_link: 'Link',
  risky_domain: 'Globe',
  urgency: 'Clock',
  payment_request: 'BadgeDollarSign',
  credential_request: 'KeyRound',
  secrecy: 'EyeOff',
  call_now: 'Phone',
  too_good_to_be_true: 'Gift',
  attachment: 'Paperclip',
  other: 'TriangleAlert',
};
